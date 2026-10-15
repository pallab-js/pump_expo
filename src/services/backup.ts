import type { SQLiteDatabase } from 'expo-sqlite';

/** Tables included in a backup, in FK-safe insertion order for restore. */
export const BACKUP_TABLES = [
  'fuel_type',
  'profile',
  'station',
  'profile_station',
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
] as const;

export interface BackupFile {
  app: 'fuelpump-manager';
  version: number;
  exportedAt: string;
  data: Record<string, Array<Record<string, unknown>>>;
}

export const BACKUP_FORMAT_VERSION = 1;

/** Columns stripped from `profile` rows on export (credential material). */
const PROFILE_SENSITIVE_COLUMNS = ['pin_hash', 'pin_salt', 'failed_attempts', 'locked_until'];

/** A placeholder hash written on restore for profiles whose PIN was stripped. */
export const RESTORE_PIN_PLACEHOLDER = 'RESET_REQUIRED';

/** Serialize all app tables into a backup object (PIN credentials removed). */
export async function exportBackup(db: SQLiteDatabase): Promise<BackupFile> {
  const data: Record<string, Array<Record<string, unknown>>> = {};
  for (const table of BACKUP_TABLES) {
    const rows = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${table}`);
    if (table === 'profile') {
      // Never export PIN hashes/salts or lockout state.
      data[table] = rows.map((row) => {
        const clean: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(row)) {
          if (!PROFILE_SENSITIVE_COLUMNS.includes(k)) clean[k] = v;
        }
        return clean;
      });
    } else {
      data[table] = rows;
    }
  }
  return {
    app: 'fuelpump-manager',
    version: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

/** Serialize a backup to a JSON string. */
export async function exportBackupJson(db: SQLiteDatabase): Promise<string> {
  return JSON.stringify(await exportBackup(db), null, 2);
}

function quoteIdent(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) throw new Error(`Unsafe identifier: ${name}`);
  return name;
}

/** Validate a profile row's critical fields on restore. */
function sanitizeProfileRow(row: Record<string, unknown>): Record<string, unknown> {
  const role = row.role === 'owner' || row.role === 'staff' ? row.role : 'staff';
  // PIN columns were stripped on export; set safe placeholders so the restored
  // profile must set a new PIN (verifyPin will fail against the placeholder).
  return {
    ...row,
    role,
    pin_hash: RESTORE_PIN_PLACEHOLDER,
    pin_salt: RESTORE_PIN_PLACEHOLDER,
    failed_attempts: 0,
    locked_until: null,
  };
}

/** Validate that a numeric-looking value is finite; otherwise 0. */
function sanitizeNumbers(
  row: Record<string, unknown>,
  numericCols: string[]
): Record<string, unknown> {
  const out = { ...row };
  for (const col of numericCols) {
    if (col in out) {
      const n = Number(out[col]);
      out[col] = Number.isFinite(n) ? n : 0;
    }
  }
  return out;
}

const NUMERIC_COLUMNS: Record<string, string[]> = {
  tank: ['capacity', 'low_threshold'],
  fuel_price: ['price'],
  meter_reading: ['opening', 'closing', 'test_litres', 'price'],
  stock_movement: ['quantity'],
  payment: ['amount'],
  expense: ['amount'],
};

/**
 * Restore a backup: wipe all app tables and re-insert the backed-up rows.
 * Validates the file shape and critical field values. Runs inside a
 * transaction. Profiles are restored without PIN credentials (a new PIN must
 * be set), and `role` is constrained to the allowed enum.
 */
export async function restoreBackup(db: SQLiteDatabase, backup: BackupFile): Promise<void> {
  if (!backup || backup.app !== 'fuelpump-manager' || typeof backup.data !== 'object') {
    throw new Error('Invalid backup file.');
  }

  await db.withTransactionAsync(async () => {
    // Delete in reverse FK order.
    for (const table of [...BACKUP_TABLES].reverse()) {
      await db.runAsync(`DELETE FROM ${quoteIdent(table)}`);
    }
    // Insert in forward FK order.
    for (const table of BACKUP_TABLES) {
      const rows = backup.data[table] ?? [];
      for (const rawRow of rows) {
        let row = rawRow;
        if (table === 'profile') row = sanitizeProfileRow(row);
        if (NUMERIC_COLUMNS[table]) row = sanitizeNumbers(row, NUMERIC_COLUMNS[table]);

        const cols = Object.keys(row);
        if (cols.length === 0) continue;
        const placeholders = cols.map(() => '?').join(',');
        const colList = cols.map(quoteIdent).join(',');
        const values = cols.map((c) => row[c] as never);
        await db.runAsync(
          `INSERT INTO ${quoteIdent(table)} (${colList}) VALUES (${placeholders})`,
          values
        );
      }
    }
  });
}

/** Parse + restore from a JSON string. */
export async function restoreBackupJson(db: SQLiteDatabase, json: string): Promise<void> {
  let parsed: BackupFile;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Backup file is not valid JSON.');
  }
  await restoreBackup(db, parsed);
}
