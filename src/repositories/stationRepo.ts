import type { SQLiteDatabase } from 'expo-sqlite';
import type { Station, Tank, Nozzle, FuelType } from '@/db/types';

/* ------------------------------- Stations ------------------------------- */

export interface StationInput {
  name: string;
  location?: string | null;
  code?: string | null;
  active?: boolean;
}

export async function listStations(db: SQLiteDatabase): Promise<Station[]> {
  return db.getAllAsync<Station>('SELECT * FROM station ORDER BY name');
}

export async function getStation(db: SQLiteDatabase, id: number): Promise<Station | null> {
  return db.getFirstAsync<Station>('SELECT * FROM station WHERE id = ?', [id]);
}

export async function createStation(db: SQLiteDatabase, input: StationInput): Promise<number> {
  if (!input.name?.trim()) throw new Error('Station name is required.');
  const res = await db.runAsync(
    'INSERT INTO station (name, location, code, active) VALUES (?, ?, ?, ?)',
    [input.name.trim(), input.location ?? null, input.code ?? null, input.active === false ? 0 : 1]
  );
  return res.lastInsertRowId;
}

export async function updateStation(
  db: SQLiteDatabase,
  id: number,
  input: StationInput
): Promise<void> {
  if (!input.name?.trim()) throw new Error('Station name is required.');
  await db.runAsync(
    'UPDATE station SET name = ?, location = ?, code = ?, active = ? WHERE id = ?',
    [input.name.trim(), input.location ?? null, input.code ?? null, input.active === false ? 0 : 1, id]
  );
}

export async function deleteStation(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM station WHERE id = ?', [id]);
}

/* -------------------------------- Fuel types ----------------------------- */

export async function listFuelTypes(db: SQLiteDatabase): Promise<FuelType[]> {
  return db.getAllAsync<FuelType>('SELECT * FROM fuel_type ORDER BY id');
}

/* --------------------------------- Tanks --------------------------------- */

export interface TankInput {
  station_id: number;
  fuel_type_id: number;
  label: string;
  capacity: number;
  low_threshold: number;
}

export async function listTanks(db: SQLiteDatabase, stationId: number): Promise<Tank[]> {
  return db.getAllAsync<Tank>('SELECT * FROM tank WHERE station_id = ? ORDER BY label', [stationId]);
}

export async function createTank(db: SQLiteDatabase, input: TankInput): Promise<number> {
  if (!input.label?.trim()) throw new Error('Tank label is required.');
  if (input.capacity < 0 || input.low_threshold < 0) throw new Error('Values must be non-negative.');
  const res = await db.runAsync(
    'INSERT INTO tank (station_id, fuel_type_id, label, capacity, low_threshold) VALUES (?, ?, ?, ?, ?)',
    [input.station_id, input.fuel_type_id, input.label.trim(), input.capacity, input.low_threshold]
  );
  return res.lastInsertRowId;
}

export async function updateTank(
  db: SQLiteDatabase,
  id: number,
  input: Omit<TankInput, 'station_id'>
): Promise<void> {
  await db.runAsync(
    'UPDATE tank SET fuel_type_id = ?, label = ?, capacity = ?, low_threshold = ? WHERE id = ?',
    [input.fuel_type_id, input.label.trim(), input.capacity, input.low_threshold, id]
  );
}

export async function deleteTank(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM tank WHERE id = ?', [id]);
}

/* -------------------------------- Nozzles -------------------------------- */

export interface NozzleInput {
  station_id: number;
  fuel_type_id: number;
  label: string;
  tank_id?: number | null;
}

export async function listNozzles(db: SQLiteDatabase, stationId: number): Promise<Nozzle[]> {
  return db.getAllAsync<Nozzle>('SELECT * FROM nozzle WHERE station_id = ? ORDER BY label', [stationId]);
}

export async function createNozzle(db: SQLiteDatabase, input: NozzleInput): Promise<number> {
  if (!input.label?.trim()) throw new Error('Nozzle label is required.');
  const res = await db.runAsync(
    'INSERT INTO nozzle (station_id, fuel_type_id, label, tank_id) VALUES (?, ?, ?, ?)',
    [input.station_id, input.fuel_type_id, input.label.trim(), input.tank_id ?? null]
  );
  return res.lastInsertRowId;
}

export async function updateNozzle(
  db: SQLiteDatabase,
  id: number,
  input: Omit<NozzleInput, 'station_id'>
): Promise<void> {
  await db.runAsync('UPDATE nozzle SET fuel_type_id = ?, label = ?, tank_id = ? WHERE id = ?', [
    input.fuel_type_id,
    input.label.trim(),
    input.tank_id ?? null,
    id,
  ]);
}

export async function deleteNozzle(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM nozzle WHERE id = ?', [id]);
}

/** Count of tanks and nozzles for a station (used in list summaries). */
export async function stationCounts(
  db: SQLiteDatabase,
  stationId: number
): Promise<{ tanks: number; nozzles: number }> {
  const tanks = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) AS c FROM tank WHERE station_id = ?',
    [stationId]
  );
  const nozzles = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) AS c FROM nozzle WHERE station_id = ?',
    [stationId]
  );
  return { tanks: tanks?.c ?? 0, nozzles: nozzles?.c ?? 0 };
}
