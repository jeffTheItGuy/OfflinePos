import * as Crypto from "expo-crypto";
import { getDb } from "./database";
import type { Staff } from "../types";

// Local verifier: SHA-256(salt + pin). This is NOT the server's pbkdf2 hash
// — the server intentionally never ships pin_hash. A staff member must log
// in ONLINE once per device to seed their local verifier.
async function localVerifier(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${pin}`,
  );
}

async function deviceSalt(): Promise<string> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM meta WHERE key = 'device_salt'",
  );
  return row?.value ?? "no-salt";
}

export async function cacheStaffList(staff: Staff[]): Promise<void> {
  const db = await getDb();
  for (const s of staff) {
    await db.runAsync(
      `INSERT INTO staff_cache (id, name, role)
         VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name, role=excluded.role`,
      [s.id, s.name, s.role],
    );
  }
  // Remove staff the server no longer returns.
  const ids = staff.map((s) => s.id);
  if (ids.length === 0) {
    await db.runAsync("DELETE FROM staff_cache");
  } else {
    const placeholders = ids.map(() => "?").join(",");
    await db.runAsync(
      `DELETE FROM staff_cache WHERE id NOT IN (${placeholders})`,
      ids,
    );
  }
}

export async function seedVerifier(staffId: string, pin: string): Promise<void> {
  const db = await getDb();
  const salt = await deviceSalt();
  const verifier = await localVerifier(pin, salt);
  await db.runAsync(
    "UPDATE staff_cache SET pin_verifier = ? WHERE id = ?",
    [verifier, staffId],
  );
}

export async function offlineLogin(pin: string): Promise<Staff | null> {
  const db = await getDb();
  const salt = await deviceSalt();
  const verifier = await localVerifier(pin, salt);

  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    role: "waiter" | "manager";
    pin_verifier: string | null;
  }>("SELECT id, name, role, pin_verifier FROM staff_cache");

  const match = rows.find((c) => c.pin_verifier === verifier);
  if (!match) return null;
  return { id: match.id, name: match.name, role: match.role };
}

export async function getCachedStaff(): Promise<Staff[]> {
  const db = await getDb();
  return db.getAllAsync<Staff>(
    "SELECT id, name, role FROM staff_cache ORDER BY name",
  );
}
