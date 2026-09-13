import { getDb } from "./database";

export async function runMigrations(): Promise<void> {
  const db = await getDb();

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS device_settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      category    TEXT NOT NULL,
      available   INTEGER NOT NULL DEFAULT 1,
      version     INTEGER NOT NULL DEFAULT 1
    );

    -- Step 4: configurable tables, synced exactly like menu_items.
    CREATE TABLE IF NOT EXISTS tables (
      id        TEXT PRIMARY KEY,
      name      TEXT NOT NULL,
      section   TEXT NOT NULL,
      available INTEGER NOT NULL DEFAULT 1,
      version   INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS staff_cache (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      role         TEXT NOT NULL,
      pin_verifier TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id             TEXT PRIMARY KEY,
      order_no       TEXT,
      local_no       TEXT NOT NULL,
      table_name     TEXT NOT NULL,
      status         TEXT NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      subtotal_cents INTEGER NOT NULL DEFAULT 0,
      tax_cents      INTEGER NOT NULL DEFAULT 0,
      total_cents    INTEGER NOT NULL,
      staff_id       TEXT,
      created_at     TEXT NOT NULL,
      synced         INTEGER NOT NULL DEFAULT 0,
      payload        TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      order_id     TEXT NOT NULL,
      menu_item_id TEXT,
      name         TEXT NOT NULL,
      quantity     INTEGER NOT NULL,
      price_cents  INTEGER NOT NULL,
      notes        TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS outbox (
      id              TEXT PRIMARY KEY,
      kind            TEXT NOT NULL,
      payload         TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'pending',
      attempts        INTEGER NOT NULL DEFAULT 0,
      next_attempt_at INTEGER NOT NULL DEFAULT 0,
      last_error      TEXT,
      created_at      INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_outbox_due
      ON outbox(status, next_attempt_at);

    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Migrations for existing installs: add columns if missing.
  const alter = async (sql: string) => {
    try {
      await db.execAsync(sql);
    } catch {
      // Column already exists — ignore.
    }
  };

  await alter(
    `ALTER TABLE orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid'`,
  );
  await alter(`ALTER TABLE orders ADD COLUMN void_reason TEXT`);
  // Step 3: tax breakdown columns.
  await alter(
    `ALTER TABLE orders ADD COLUMN subtotal_cents INTEGER NOT NULL DEFAULT 0`,
  );
  await alter(
    `ALTER TABLE orders ADD COLUMN tax_cents INTEGER NOT NULL DEFAULT 0`,
  );
}

export async function getMeta(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM meta WHERE key = ?",
    [key],
  );
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO meta (key, value) VALUES (?, ?) " +
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value],
  );
}