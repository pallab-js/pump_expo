import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  DayRecord,
  MeterReading,
  Payment,
  Expense,
  StockMovement,
  Shift,
  Staff,
  PaymentMethod,
  StockMovementType,
  ShiftName,
} from '@/db/types';

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

/* ----------------------------- Payments ---------------------------------- */

export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'upi', 'credit'];

export async function listPayments(db: SQLiteDatabase, dayRecordId: number): Promise<Payment[]> {
  return db.getAllAsync<Payment>('SELECT * FROM payment WHERE day_record_id = ? ORDER BY id', [
    dayRecordId,
  ]);
}

/** Replace all payments for a day with the provided method→amount map (non-zero only). */
export async function savePayments(
  db: SQLiteDatabase,
  dayRecordId: number,
  amounts: Partial<Record<PaymentMethod, number>>
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM payment WHERE day_record_id = ?', [dayRecordId]);
    for (const method of PAYMENT_METHODS) {
      const amount = amounts[method];
      if (amount && amount > 0) {
        await db.runAsync('INSERT INTO payment (day_record_id, method, amount) VALUES (?, ?, ?)', [
          dayRecordId,
          method,
          amount,
        ]);
      }
    }
  });
}

export async function paymentsTotal(db: SQLiteDatabase, dayRecordId: number): Promise<number> {
  const row = await db.getFirstAsync<{ s: number | null }>(
    'SELECT SUM(amount) AS s FROM payment WHERE day_record_id = ?',
    [dayRecordId]
  );
  return row?.s ?? 0;
}

/* ----------------------------- Expenses ---------------------------------- */

export interface ExpenseInput {
  category: string;
  amount: number;
  note?: string | null;
}

export async function listExpenses(db: SQLiteDatabase, dayRecordId: number): Promise<Expense[]> {
  return db.getAllAsync<Expense>('SELECT * FROM expense WHERE day_record_id = ? ORDER BY id', [
    dayRecordId,
  ]);
}

export async function addExpense(
  db: SQLiteDatabase,
  dayRecordId: number,
  input: ExpenseInput
): Promise<number> {
  if (!input.category?.trim()) throw new Error('Expense category is required.');
  if (input.amount < 0) throw new Error('Amount must be non-negative.');
  const res = await db.runAsync(
    'INSERT INTO expense (day_record_id, category, amount, note) VALUES (?, ?, ?, ?)',
    [dayRecordId, input.category.trim(), input.amount, input.note ?? null]
  );
  return res.lastInsertRowId;
}

export async function deleteExpense(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM expense WHERE id = ?', [id]);
}

export async function expensesTotal(db: SQLiteDatabase, dayRecordId: number): Promise<number> {
  const row = await db.getFirstAsync<{ s: number | null }>(
    'SELECT SUM(amount) AS s FROM expense WHERE day_record_id = ?',
    [dayRecordId]
  );
  return row?.s ?? 0;
}

/* -------------------------- Stock movements ------------------------------ */

export interface StockMovementInput {
  tank_id: number;
  type: StockMovementType;
  quantity: number;
  note?: string | null;
}

export async function listStockMovements(
  db: SQLiteDatabase,
  dayRecordId: number
): Promise<StockMovement[]> {
  return db.getAllAsync<StockMovement>(
    'SELECT * FROM stock_movement WHERE day_record_id = ? ORDER BY id',
    [dayRecordId]
  );
}

export async function addStockMovement(
  db: SQLiteDatabase,
  dayRecordId: number,
  input: StockMovementInput
): Promise<number> {
  if (input.quantity < 0) throw new Error('Quantity must be non-negative.');
  const res = await db.runAsync(
    'INSERT INTO stock_movement (day_record_id, tank_id, type, quantity, note) VALUES (?, ?, ?, ?, ?)',
    [dayRecordId, input.tank_id, input.type, input.quantity, input.note ?? null]
  );
  return res.lastInsertRowId;
}

export async function deleteStockMovement(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM stock_movement WHERE id = ?', [id]);
}

/**
 * Running stock balance from a list of movements for a tank:
 *   opening/receipt/adjustment add to the balance; a recorded `closing`
 *   physical count overrides the running balance.
 */
export function stockBalance(movements: StockMovement[]): number {
  let balance = 0;
  for (const m of movements) {
    if (m.type === 'opening' || m.type === 'receipt' || m.type === 'adjustment') {
      balance += m.quantity;
    } else if (m.type === 'closing') {
      balance = m.quantity;
    }
  }
  return balance;
}

/* -------------------------------- Shifts --------------------------------- */

export interface ShiftInput {
  staff_id?: number | null;
  shift: ShiftName;
  note?: string | null;
}

export async function listShifts(db: SQLiteDatabase, dayRecordId: number): Promise<Shift[]> {
  return db.getAllAsync<Shift>('SELECT * FROM shift WHERE day_record_id = ? ORDER BY id', [
    dayRecordId,
  ]);
}

export async function addShift(
  db: SQLiteDatabase,
  dayRecordId: number,
  input: ShiftInput
): Promise<number> {
  const res = await db.runAsync(
    'INSERT INTO shift (day_record_id, staff_id, shift, note) VALUES (?, ?, ?, ?)',
    [dayRecordId, input.staff_id ?? null, input.shift, input.note ?? null]
  );
  return res.lastInsertRowId;
}

export async function deleteShift(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM shift WHERE id = ?', [id]);
}

/* --------------------------------- Staff --------------------------------- */

export async function listStaff(db: SQLiteDatabase, stationId: number): Promise<Staff[]> {
  return db.getAllAsync<Staff>(
    'SELECT * FROM staff WHERE station_id = ? AND active = 1 ORDER BY name',
    [stationId]
  );
}

export async function addStaff(
  db: SQLiteDatabase,
  stationId: number,
  name: string,
  phone?: string | null
): Promise<number> {
  if (!name?.trim()) throw new Error('Staff name is required.');
  const res = await db.runAsync('INSERT INTO staff (station_id, name, phone) VALUES (?, ?, ?)', [
    stationId,
    name.trim(),
    phone ?? null,
  ]);
  return res.lastInsertRowId;
}

export async function deleteStaff(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM staff WHERE id = ?', [id]);
}

/* ---------------------------- Day reconciliation ------------------------- */

export interface DayReconciliation {
  salesAmount: number;
  paymentsTotal: number;
  expensesTotal: number;
  /** payments - sales (0 means fully reconciled). */
  variance: number;
}

export async function reconcileDay(
  db: SQLiteDatabase,
  dayRecordId: number
): Promise<DayReconciliation> {
  const sales = await computeDaySales(db, dayRecordId);
  const payments = await paymentsTotal(db, dayRecordId);
  const expenses = await expensesTotal(db, dayRecordId);
  return {
    salesAmount: sales.totalAmount,
    paymentsTotal: payments,
    expensesTotal: expenses,
    variance: payments - sales.totalAmount,
  };
}
