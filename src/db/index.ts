import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { migrations, LATEST_VERSION } from './migrations';

export const DB_NAME = 'fuelpump.db';

let dbInstance: SQLiteDatabase | null = null;

/**
 * Run the schema_version-tracked migrations against a database.
 * Safe to call repeatedly: already-applied versions are skipped.
 */
export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const row = await db.getFirstAsync<{ v: number | null }>(
    'SELECT MAX(version) AS v FROM schema_version'
  );
  const current = row?.v ?? 0;

  for (const migration of migrations) {
    if (migration.version > current) {
      await migration.up(db);
      await db.runAsync('INSERT INTO schema_version (version) VALUES (?)', [
        migration.version,
      ]);
    }
  }
}

/**
 * Open (once) the on-device database and ensure migrations are applied.
 * Subsequent calls return the cached instance.
 */
export async function getDatabase(): Promise<SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await runMigrations(db);
  dbInstance = db;
  return db;
}

/** Current target schema version. */
export function latestSchemaVersion(): number {
  return LATEST_VERSION;
}

/**
 * Reset the cached instance (used by tests and backup/restore flows).
 * Does not delete the on-device file.
 */
export function _resetDatabaseCache(): void {
  dbInstance = null;
}

/**
 * Create a fresh in-memory database with migrations applied.
 * Intended for unit tests.
 */
export async function createInMemoryDatabase(): Promise<SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(':memory:');
  await runMigrations(db);
  return db;
}
