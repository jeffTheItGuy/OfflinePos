import { getDb } from "./database";
import type { OutboxItem, OutboxKind } from "../types";

export async function enqueue(
  id: string,
  kind: OutboxKind,
  payload: object,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO outbox
       (id, kind, payload, status, attempts, next_attempt_at, created_at)
     VALUES (?, ?, ?, 'pending', 0, 0, ?)`,
    [id, kind, JSON.stringify(payload), Date.now()],
  );
}

export async function nextDue(limit = 10): Promise<OutboxItem[]> {
  const db = await getDb();
  return db.getAllAsync<OutboxItem>(
    `SELECT * FROM outbox
      WHERE status IN ('pending','syncing')
        AND next_attempt_at <= ?
      ORDER BY created_at ASC
      LIMIT ?`,
    [Date.now(), limit],
  );
}

export async function markSyncing(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE outbox SET status='syncing' WHERE id = ?", [id]);
}

export async function markDone(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM outbox WHERE id = ?", [id]);
}

export async function markFailed(
  id: string,
  err: string,
  delayMs: number,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE outbox
        SET status='pending',
            attempts = attempts + 1,
            last_error = ?,
            next_attempt_at = ?
      WHERE id = ?`,
    [err, Date.now() + delayMs, id],
  );
}

export async function pendingCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) as n FROM outbox WHERE status != 'done'",
  );
  return row?.n ?? 0;
}

export async function listPending(): Promise<OutboxItem[]> {
  const db = await getDb();
  return db.getAllAsync<OutboxItem>(
    "SELECT * FROM outbox WHERE status != 'done' ORDER BY created_at ASC",
  );
}
