import * as SQLite from "expo-sqlite";

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync("harbor.db");
  await _db.execAsync("PRAGMA journal_mode = WAL;");
  await _db.execAsync("PRAGMA foreign_keys = ON;");
  return _db;
}
