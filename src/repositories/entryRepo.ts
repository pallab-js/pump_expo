import type { SQLiteDatabase } from 'expo-sqlite';
import type { DayRecord, MeterReading } from '@/db/types';

/* ------------------------------ Day records ------------------------------ */

/** Get the day record for a station+date, or null. */
export async function getDayRecord(
  db: SQLiteDatabase,
  stationId: number,
  date: string
): Promise<DayRecord | null> {
  return db.getFirstAsync<DayRecord>(
    'SELECT * FROM day_record WHERE station_id = ? AND date = ?',
    [stationId, date]
  );
}

/** Get or create the day record for a station+date, returning its id. */
export async function ensureDayRecord(
  db: SQLiteDatabase,
  stationId: number,
  date: string
): Promise<number> {
  const existing = await getDayRecord(db, stationId, date);
  if (existing) return existing.id;
  const res = await db.runAsync('INSERT INTO day_record (station_id, date) VALUES (?, ?)', [
    stationId,
    date,
  ]);
  return res.lastInsertRowId;
}

export async function listDayRecords(
  db: SQLiteDatabase,
  stationId: number,
  limit = 60
): Promise<DayRecord[]> {
  return db.getAllAsync<DayRecord>(
    'SELECT * FROM day_record WHERE station_id = ? ORDER BY date DESC LIMIT ?',
    [stationId, limit]
  );
}

/* ----------------------------- Meter readings ---------------------------- */

export interface MeterReadingInput {
  nozzle_id: number;
  opening: number;
  closing: number;
  test_litres?: number;
  price: number;
}

/** Net litres dispensed by a reading (never negative). */
export function readingLitres(r: Pick<MeterReading, 'opening' | 'closing' | 'test_litres'>): number {
  const gross = r.closing - r.opening;
  const net = gross - (r.test_litres ?? 0);
  return net > 0 ? net : 0;
}

/** Sale amount for a reading. */
export function readingAmount(
  r: Pick<MeterReading, 'opening' | 'closing' | 'test_litres' | 'price'>
): number {
  return readingLitres(r) * r.price;
}

export async function listMeterReadings(
  db: SQLiteDatabase,
  dayRecordId: number
): Promise<MeterReading[]> {
  return db.getAllAsync<MeterReading>(
    'SELECT * FROM meter_reading WHERE day_record_id = ? ORDER BY id',
    [dayRecordId]
  );
}

/**
 * Upsert a nozzle's meter reading for a day record.
 * Validates closing >= opening. One reading per (day_record, nozzle).
 */
export async function saveMeterReading(
  db: SQLiteDatabase,
  dayRecordId: number,
  input: MeterReadingInput
): Promise<void> {
  if (input.closing < input.opening) {
    throw new Error('Closing reading cannot be less than opening.');
  }
  if (input.price < 0) throw new Error('Price must be non-negative.');

  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM meter_reading WHERE day_record_id = ? AND nozzle_id = ?',
    [dayRecordId, input.nozzle_id]
  );
  const test = input.test_litres ?? 0;
  if (existing) {
    await db.runAsync(
      'UPDATE meter_reading SET opening = ?, closing = ?, test_litres = ?, price = ? WHERE id = ?',
      [input.opening, input.closing, test, input.price, existing.id]
    );
  } else {
    await db.runAsync(
      'INSERT INTO meter_reading (day_record_id, nozzle_id, opening, closing, test_litres, price) VALUES (?, ?, ?, ?, ?, ?)',
      [dayRecordId, input.nozzle_id, input.opening, input.closing, test, input.price]
    );
  }
}

export interface DaySalesSummary {
  totalLitres: number;
  totalAmount: number;
  perFuel: Record<number, { litres: number; amount: number }>;
}

/**
 * Compute total litres & sales for a day record, grouped by fuel type.
 * Joins meter readings → nozzle (for fuel type).
 */
export async function computeDaySales(
  db: SQLiteDatabase,
  dayRecordId: number
): Promise<DaySalesSummary> {
  const rows = await db.getAllAsync<{
    fuel_type_id: number;
    opening: number;
    closing: number;
    test_litres: number;
    price: number;
  }>(
    `SELECT n.fuel_type_id, mr.opening, mr.closing, mr.test_litres, mr.price
     FROM meter_reading mr
     JOIN nozzle n ON n.id = mr.nozzle_id
     WHERE mr.day_record_id = ?`,
    [dayRecordId]
  );

  const summary: DaySalesSummary = { totalLitres: 0, totalAmount: 0, perFuel: {} };
  for (const r of rows) {
    const litres = readingLitres(r);
    const amount = litres * r.price;
    summary.totalLitres += litres;
    summary.totalAmount += amount;
    const bucket = summary.perFuel[r.fuel_type_id] ?? { litres: 0, amount: 0 };
    bucket.litres += litres;
    bucket.amount += amount;
    summary.perFuel[r.fuel_type_id] = bucket;
  }
  return summary;
}
