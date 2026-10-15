import * as SQLite from 'expo-sqlite';
import { runMigrations } from '@/db';
import { migrations, SEED_FUEL_TYPES, LATEST_VERSION } from '@/db/migrations';

const EXPECTED_TABLES = [
  'profile',
  'profile_station',
  'station',
  'fuel_type',
  'tank',
  'nozzle',
  'fuel_price',
  'day_record',
  'meter_reading',
  'stock_movement',
  'payment',
  'expense',
  'staff',
  'shift',
  'schema_version',
];

async function listTables(db: SQLite.SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  );
  return rows.map((r) => r.name);
}

describe('migrations', () => {
  it('creates all expected tables', async () => {
    const db = await SQLite.openDatabaseAsync(':memory:');
    await runMigrations(db);
    const tables = await listTables(db);
    for (const t of EXPECTED_TABLES) {
      expect(tables).toContain(t);
    }
    await db.closeAsync();
  });

  it('seeds the default fuel types', async () => {
    const db = await SQLite.openDatabaseAsync(':memory:');
    await runMigrations(db);
    const rows = await db.getAllAsync<{ code: string }>(
      'SELECT code FROM fuel_type ORDER BY id'
    );
    expect(rows).toHaveLength(SEED_FUEL_TYPES.length);
    expect(rows.map((r) => r.code)).toEqual(
      SEED_FUEL_TYPES.map((f) => f.code)
    );
    await db.closeAsync();
  });

  it('is idempotent when run twice (no duplicate seeds or versions)', async () => {
    const db = await SQLite.openDatabaseAsync(':memory:');
    await runMigrations(db);
    await runMigrations(db);

    const fuelCount = await db.getFirstAsync<{ c: number }>(
      'SELECT COUNT(*) AS c FROM fuel_type'
    );
    expect(fuelCount?.c).toBe(SEED_FUEL_TYPES.length);

    const versionRows = await db.getAllAsync<{ version: number }>(
      'SELECT version FROM schema_version'
    );
    expect(versionRows).toHaveLength(migrations.length);
    expect(Math.max(...versionRows.map((r) => r.version))).toBe(LATEST_VERSION);
    await db.closeAsync();
  });
});
