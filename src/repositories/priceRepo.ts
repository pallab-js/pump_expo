import type { SQLiteDatabase } from 'expo-sqlite';
import type { FuelPrice } from '@/db/types';

export interface SetPriceInput {
  station_id: number;
  fuel_type_id: number;
  price: number;
  effective_date: string; // YYYY-MM-DD
}

/**
 * Insert or update the price for a station+fuel+date.
 * (UNIQUE(station_id, fuel_type_id, effective_date) makes this an upsert.)
 */
export async function setPrice(db: SQLiteDatabase, input: SetPriceInput): Promise<void> {
  if (input.price < 0) throw new Error('Price must be non-negative.');
  await db.runAsync(
    `INSERT INTO fuel_price (station_id, fuel_type_id, price, effective_date)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(station_id, fuel_type_id, effective_date)
     DO UPDATE SET price = excluded.price`,
    [input.station_id, input.fuel_type_id, input.price, input.effective_date]
  );
}

/** All price rows for a station (most recent first). */
export async function listPrices(db: SQLiteDatabase, stationId: number): Promise<FuelPrice[]> {
  return db.getAllAsync<FuelPrice>(
    'SELECT * FROM fuel_price WHERE station_id = ? ORDER BY effective_date DESC, fuel_type_id',
    [stationId]
  );
}

/**
 * Resolve the effective price for a station+fuel on a given date:
 * the latest price whose effective_date <= date. Returns null if none.
 */
export async function getEffectivePrice(
  db: SQLiteDatabase,
  stationId: number,
  fuelTypeId: number,
  date: string
): Promise<number | null> {
  const row = await db.getFirstAsync<{ price: number }>(
    `SELECT price FROM fuel_price
     WHERE station_id = ? AND fuel_type_id = ? AND effective_date <= ?
     ORDER BY effective_date DESC
     LIMIT 1`,
    [stationId, fuelTypeId, date]
  );
  return row?.price ?? null;
}

/** Current effective prices for all fuel types at a station on a date. */
export async function getEffectivePrices(
  db: SQLiteDatabase,
  stationId: number,
  date: string
): Promise<Record<number, number>> {
  const rows = await db.getAllAsync<{ fuel_type_id: number; price: number }>(
    `SELECT fp.fuel_type_id, fp.price
     FROM fuel_price fp
     JOIN (
       SELECT fuel_type_id, MAX(effective_date) AS d
       FROM fuel_price
       WHERE station_id = ? AND effective_date <= ?
       GROUP BY fuel_type_id
     ) latest ON latest.fuel_type_id = fp.fuel_type_id AND latest.d = fp.effective_date
     WHERE fp.station_id = ?`,
    [stationId, date, stationId]
  );
  const map: Record<number, number> = {};
  for (const r of rows) map[r.fuel_type_id] = r.price;
  return map;
}
