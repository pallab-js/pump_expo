import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';
import { exportBackupJson, restoreBackupJson } from './backup';
import { todayISO } from './dates';

/**
 * Export the database to a JSON file in the cache directory and open the
 * iOS share sheet so the user can save it to Files/iCloud or send it.
 * Returns the file name written.
 */
export async function shareBackup(db: SQLiteDatabase): Promise<string> {
  const json = await exportBackupJson(db);
  const fileName = `fuelpump-backup-${todayISO()}.json`;
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(json);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Export FuelPump backup',
      UTI: 'public.json',
    });
  }
  return fileName;
}

/**
 * Let the user pick a backup JSON file and restore it into the database.
 * Returns true if a file was picked and restored, false if cancelled.
 */
export async function pickAndRestoreBackup(db: SQLiteDatabase): Promise<boolean> {
  const result = await File.pickFileAsync({ mimeTypes: ['application/json'] });
  // Single-file result shape: { canceled, assets? } or a File instance depending on API.
  const picked = normalizePickedFile(result);
  if (!picked) return false;
  const json = await picked.text();
  await restoreBackupJson(db, json);
  return true;
}

function normalizePickedFile(result: unknown): File | null {
  if (!result) return null;
  if (result instanceof File) return result;
  // Newer API returns { canceled: boolean, file?: File } or array
  const anyResult = result as { canceled?: boolean; file?: File; files?: File[] };
  if (anyResult.canceled) return null;
  if (anyResult.file instanceof File) return anyResult.file;
  if (Array.isArray(anyResult.files) && anyResult.files[0]) return anyResult.files[0];
  return null;
}
