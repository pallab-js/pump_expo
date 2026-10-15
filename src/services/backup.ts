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

/** Serialize all app tables into a backup object. */
export async function exportBackup(db: SQLiteDatabase): Promise<BackupFile> {
  const data: Record<string, Array<Record<string, unknown>>> = {};
  for (const table of BACKUP_TABLES) {
    data[table] = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${table}`);
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

/**
 * Restore a backup: wipe all app tables and re-insert the backed-up rows.
 * Validates the file shape. Runs inside a transaction.
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
      for (const row of rows) {
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
