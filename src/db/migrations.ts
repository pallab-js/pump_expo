import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * A single migration step. `up` receives the open database and should perform
 * all DDL/DML for that version. Migrations run in order and are idempotent at
 * the runner level (tracked by the `schema_version` table).
 */
export interface Migration {
  version: number;
  name: string;
  up: (db: SQLiteDatabase) => Promise<void>;
}

/** Seed fuel types inserted on first migration. */
export const SEED_FUEL_TYPES: Array<{
  code: string;
  name: string;
  unit: string;
  color: string;
}> = [
  { code: 'MS', name: 'Petrol (MS)', unit: 'L', color: '#2E8B57' },
  { code: 'HSD', name: 'Diesel (HSD)', unit: 'L', color: '#1E6FB8' },
  { code: 'XP', name: 'Premium (XP)', unit: 'L', color: '#E0A500' },
  { code: 'CNG', name: 'CNG', unit: 'kg', color: '#7B4FB5' },
];

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS profile (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('owner','staff')),
          pin_hash TEXT NOT NULL,
          pin_salt TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS station (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          location TEXT,
          code TEXT,
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS profile_station (
          profile_id INTEGER NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
          station_id INTEGER NOT NULL REFERENCES station(id) ON DELETE CASCADE,
          PRIMARY KEY (profile_id, station_id)
        );

        CREATE TABLE IF NOT EXISTS fuel_type (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          unit TEXT NOT NULL DEFAULT 'L',
          color TEXT NOT NULL DEFAULT '#888888'
        );

        CREATE TABLE IF NOT EXISTS tank (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          station_id INTEGER NOT NULL REFERENCES station(id) ON DELETE CASCADE,
          fuel_type_id INTEGER NOT NULL REFERENCES fuel_type(id),
          label TEXT NOT NULL,
          capacity REAL NOT NULL DEFAULT 0,
          low_threshold REAL NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS nozzle (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          station_id INTEGER NOT NULL REFERENCES station(id) ON DELETE CASCADE,
          fuel_type_id INTEGER NOT NULL REFERENCES fuel_type(id),
          label TEXT NOT NULL,
          tank_id INTEGER REFERENCES tank(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS fuel_price (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          station_id INTEGER NOT NULL REFERENCES station(id) ON DELETE CASCADE,
          fuel_type_id INTEGER NOT NULL REFERENCES fuel_type(id),
          price REAL NOT NULL,
          effective_date TEXT NOT NULL,
          UNIQUE (station_id, fuel_type_id, effective_date)
        );

        CREATE TABLE IF NOT EXISTS day_record (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          station_id INTEGER NOT NULL REFERENCES station(id) ON DELETE CASCADE,
          date TEXT NOT NULL,
          note TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE (station_id, date)
        );

        CREATE TABLE IF NOT EXISTS meter_reading (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          day_record_id INTEGER NOT NULL REFERENCES day_record(id) ON DELETE CASCADE,
          nozzle_id INTEGER NOT NULL REFERENCES nozzle(id) ON DELETE CASCADE,
          opening REAL NOT NULL DEFAULT 0,
          closing REAL NOT NULL DEFAULT 0,
          test_litres REAL NOT NULL DEFAULT 0,
          price REAL NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS stock_movement (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          day_record_id INTEGER NOT NULL REFERENCES day_record(id) ON DELETE CASCADE,
          tank_id INTEGER NOT NULL REFERENCES tank(id) ON DELETE CASCADE,
          type TEXT NOT NULL CHECK (type IN ('opening','receipt','closing','adjustment')),
          quantity REAL NOT NULL DEFAULT 0,
          note TEXT
        );

        CREATE TABLE IF NOT EXISTS payment (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          day_record_id INTEGER NOT NULL REFERENCES day_record(id) ON DELETE CASCADE,
          method TEXT NOT NULL CHECK (method IN ('cash','card','upi','credit')),
          amount REAL NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS expense (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          day_record_id INTEGER NOT NULL REFERENCES day_record(id) ON DELETE CASCADE,
          category TEXT NOT NULL,
          amount REAL NOT NULL DEFAULT 0,
          note TEXT
        );

        CREATE TABLE IF NOT EXISTS staff (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          station_id INTEGER NOT NULL REFERENCES station(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          phone TEXT,
          active INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS shift (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          day_record_id INTEGER NOT NULL REFERENCES day_record(id) ON DELETE CASCADE,
          staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
          shift TEXT NOT NULL CHECK (shift IN ('morning','evening','night','full')),
          note TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_day_record_station_date ON day_record(station_id, date);
        CREATE INDEX IF NOT EXISTS idx_fuel_price_lookup ON fuel_price(station_id, fuel_type_id, effective_date);
        CREATE INDEX IF NOT EXISTS idx_meter_reading_day ON meter_reading(day_record_id);
        CREATE INDEX IF NOT EXISTS idx_stock_movement_day ON stock_movement(day_record_id);
        CREATE INDEX IF NOT EXISTS idx_payment_day ON payment(day_record_id);
        CREATE INDEX IF NOT EXISTS idx_expense_day ON expense(day_record_id);
        CREATE INDEX IF NOT EXISTS idx_shift_day ON shift(day_record_id);
      `);

      // Seed fuel types (idempotent via INSERT OR IGNORE on unique code).
      for (const ft of SEED_FUEL_TYPES) {
        await db.runAsync(
          `INSERT OR IGNORE INTO fuel_type (code, name, unit, color) VALUES (?, ?, ?, ?)`,
          [ft.code, ft.name, ft.unit, ft.color]
        );
      }
    },
  },
  {
    version: 2,
    name: 'pin_bruteforce_tracking',
    up: async (db) => {
      // Track failed PIN attempts and a lockout window per profile.
      // ALTER TABLE ADD COLUMN is not idempotent, so guard on existing columns.
      const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(profile)`);
      const names = new Set(cols.map((c) => c.name));
      if (!names.has('failed_attempts')) {
        await db.execAsync(
          `ALTER TABLE profile ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0;`
        );
      }
      if (!names.has('locked_until')) {
        await db.execAsync(`ALTER TABLE profile ADD COLUMN locked_until TEXT;`);
      }
    },
  },
];

export const LATEST_VERSION = migrations[migrations.length - 1]?.version ?? 0;
