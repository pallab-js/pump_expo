import type { SQLiteDatabase } from 'expo-sqlite';
import type { Station } from '@/db/types';

/** List all stations (full CRUD added in the station-management task). */
export async function listStations(db: SQLiteDatabase): Promise<Station[]> {
  return db.getAllAsync<Station>('SELECT * FROM station ORDER BY name');
}
