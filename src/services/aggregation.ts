import type { SQLiteDatabase } from 'expo-sqlite';

export interface DateRange {
  start: string; // YYYY-MM-DD inclusive
  end: string; // YYYY-MM-DD inclusive
}

/** Optional scoping: restrict aggregation to a set of station ids. */
export interface AggOptions {
  stationIds?: number[];
}

function stationFilter(options?: AggOptions): { clause: string; params: number[] } {
  if (options?.stationIds && options.stationIds.length) {
    const placeholders = options.stationIds.map(() => '?').join(',');
    return { clause: `AND dr.station_id IN (${placeholders})`, params: options.stationIds };
  }
  return { clause: '', params: [] };
}

/* -------------------------------- Headline KPIs -------------------------- */

export interface KpiTotals {
  totalRevenue: number; // sum of meter sales
  totalLitres: number;
  totalExpenses: number;
  totalPayments: number;
  activeDays: number; // distinct day_records with data in range
}

export async function getTotals(
  db: SQLiteDatabase,
  range: DateRange,
  options?: AggOptions
): Promise<KpiTotals> {
  const f = stationFilter(options);

  const sales = await db.getFirstAsync<{ litres: number | null; revenue: number | null }>(
    `SELECT
       SUM(MAX(mr.closing - mr.opening - mr.test_litres, 0)) AS litres,
       SUM(MAX(mr.closing - mr.opening - mr.test_litres, 0) * mr.price) AS revenue
     FROM meter_reading mr
     JOIN day_record dr ON dr.id = mr.day_record_id
     WHERE dr.date BETWEEN ? AND ? ${f.clause}`,
    [range.start, range.end, ...f.params]
  );

  const expenses = await db.getFirstAsync<{ s: number | null }>(
    `SELECT SUM(e.amount) AS s FROM expense e
     JOIN day_record dr ON dr.id = e.day_record_id
     WHERE dr.date BETWEEN ? AND ? ${f.clause}`,
    [range.start, range.end, ...f.params]
  );

  const payments = await db.getFirstAsync<{ s: number | null }>(
    `SELECT SUM(p.amount) AS s FROM payment p
     JOIN day_record dr ON dr.id = p.day_record_id
     WHERE dr.date BETWEEN ? AND ? ${f.clause}`,
    [range.start, range.end, ...f.params]
  );

  const days = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(DISTINCT dr.id) AS c FROM day_record dr
     WHERE dr.date BETWEEN ? AND ? ${f.clause}`,
    [range.start, range.end, ...f.params]
  );

  return {
    totalRevenue: sales?.revenue ?? 0,
    totalLitres: sales?.litres ?? 0,
    totalExpenses: expenses?.s ?? 0,
    totalPayments: payments?.s ?? 0,
    activeDays: days?.c ?? 0,
  };
}

/* ------------------------------ Sales trend ------------------------------ */

export interface TrendPoint {
  date: string;
  litres: number;
  revenue: number;
}

/** Daily revenue & litres series across the range (only days with data). */
export async function getSalesTrend(
  db: SQLiteDatabase,
  range: DateRange,
  options?: AggOptions
): Promise<TrendPoint[]> {
  const f = stationFilter(options);
  const rows = await db.getAllAsync<{ date: string; litres: number; revenue: number }>(
    `SELECT dr.date AS date,
            SUM(MAX(mr.closing - mr.opening - mr.test_litres, 0)) AS litres,
            SUM(MAX(mr.closing - mr.opening - mr.test_litres, 0) * mr.price) AS revenue
     FROM meter_reading mr
     JOIN day_record dr ON dr.id = mr.day_record_id
     WHERE dr.date BETWEEN ? AND ? ${f.clause}
     GROUP BY dr.date
     ORDER BY dr.date`,
    [range.start, range.end, ...f.params]
  );
  return rows.map((r) => ({ date: r.date, litres: r.litres ?? 0, revenue: r.revenue ?? 0 }));
}

/* ------------------------------- Fuel mix -------------------------------- */

export interface FuelMixSlice {
  fuelTypeId: number;
  code: string;
  name: string;
  color: string;
  litres: number;
  revenue: number;
}

export async function getFuelMix(
  db: SQLiteDatabase,
  range: DateRange,
  options?: AggOptions
): Promise<FuelMixSlice[]> {
  const f = stationFilter(options);
  const rows = await db.getAllAsync<{
    fuel_type_id: number;
    code: string;
    name: string;
    color: string;
    litres: number;
    revenue: number;
  }>(
    `SELECT ft.id AS fuel_type_id, ft.code, ft.name, ft.color,
            SUM(MAX(mr.closing - mr.opening - mr.test_litres, 0)) AS litres,
            SUM(MAX(mr.closing - mr.opening - mr.test_litres, 0) * mr.price) AS revenue
     FROM meter_reading mr
     JOIN nozzle n ON n.id = mr.nozzle_id
     JOIN fuel_type ft ON ft.id = n.fuel_type_id
     JOIN day_record dr ON dr.id = mr.day_record_id
     WHERE dr.date BETWEEN ? AND ? ${f.clause}
     GROUP BY ft.id
     HAVING litres > 0
     ORDER BY revenue DESC`,
    [range.start, range.end, ...f.params]
  );
  return rows.map((r) => ({
    fuelTypeId: r.fuel_type_id,
    code: r.code,
    name: r.name,
    color: r.color,
    litres: r.litres ?? 0,
    revenue: r.revenue ?? 0,
  }));
}

/* ------------------------------ Payment mix ------------------------------ */

export interface PaymentMixSlice {
  method: string;
  amount: number;
}

export async function getPaymentMix(
  db: SQLiteDatabase,
  range: DateRange,
  options?: AggOptions
): Promise<PaymentMixSlice[]> {
  const f = stationFilter(options);
  const rows = await db.getAllAsync<{ method: string; amount: number }>(
    `SELECT p.method AS method, SUM(p.amount) AS amount
     FROM payment p
     JOIN day_record dr ON dr.id = p.day_record_id
     WHERE dr.date BETWEEN ? AND ? ${f.clause}
     GROUP BY p.method
     ORDER BY amount DESC`,
    [range.start, range.end, ...f.params]
  );
  return rows.map((r) => ({ method: r.method, amount: r.amount ?? 0 }));
}

/* -------------------------- Station comparison --------------------------- */

export interface StationComparisonRow {
  stationId: number;
  name: string;
  litres: number;
  revenue: number;
}

export async function getStationComparison(
  db: SQLiteDatabase,
  range: DateRange,
  options?: AggOptions
): Promise<StationComparisonRow[]> {
  const f = stationFilter(options);
  const rows = await db.getAllAsync<{
    station_id: number;
    name: string;
    litres: number;
    revenue: number;
  }>(
    `SELECT s.id AS station_id, s.name AS name,
            SUM(MAX(mr.closing - mr.opening - mr.test_litres, 0)) AS litres,
            SUM(MAX(mr.closing - mr.opening - mr.test_litres, 0) * mr.price) AS revenue
     FROM meter_reading mr
     JOIN day_record dr ON dr.id = mr.day_record_id
     JOIN station s ON s.id = dr.station_id
     WHERE dr.date BETWEEN ? AND ? ${f.clause}
     GROUP BY s.id
     ORDER BY revenue DESC`,
    [range.start, range.end, ...f.params]
  );
  return rows.map((r) => ({
    stationId: r.station_id,
    name: r.name,
    litres: r.litres ?? 0,
    revenue: r.revenue ?? 0,
  }));
}

/* ------------------------------ Stock levels ----------------------------- */

export interface StockLevelRow {
  tankId: number;
  stationId: number;
  stationName: string;
  label: string;
  fuelCode: string;
  capacity: number;
  lowThreshold: number;
  balance: number;
  isLow: boolean;
}

/**
 * Latest known stock balance per tank, derived from stock movements up to
 * `asOfDate`. Running balance: opening/receipt/adjustment add; a recorded
 * `closing` on the most recent day overrides.
 */
export async function getStockLevels(
  db: SQLiteDatabase,
  asOfDate: string,
  options?: AggOptions
): Promise<StockLevelRow[]> {
  const stationIn =
    options?.stationIds && options.stationIds.length
      ? `AND t.station_id IN (${options.stationIds.map(() => '?').join(',')})`
      : '';
  const params = options?.stationIds?.length ? options.stationIds : [];

  const tanks = await db.getAllAsync<{
    tank_id: number;
    station_id: number;
    station_name: string;
    label: string;
    fuel_code: string;
    capacity: number;
    low_threshold: number;
  }>(
    `SELECT t.id AS tank_id, t.station_id, s.name AS station_name, t.label,
            ft.code AS fuel_code, t.capacity, t.low_threshold
     FROM tank t
     JOIN station s ON s.id = t.station_id
     JOIN fuel_type ft ON ft.id = t.fuel_type_id
     WHERE 1=1 ${stationIn}
     ORDER BY s.name, t.label`,
    params
  );

  const result: StockLevelRow[] = [];
  for (const tk of tanks) {
    const movements = await db.getAllAsync<{ type: string; quantity: number }>(
      `SELECT sm.type, sm.quantity
       FROM stock_movement sm
       JOIN day_record dr ON dr.id = sm.day_record_id
       WHERE sm.tank_id = ? AND dr.date <= ?
       ORDER BY dr.date, sm.id`,
      [tk.tank_id, asOfDate]
    );
    let balance = 0;
    for (const m of movements) {
      if (m.type === 'opening' || m.type === 'receipt' || m.type === 'adjustment') balance += m.quantity;
      else if (m.type === 'closing') balance = m.quantity;
    }
    result.push({
      tankId: tk.tank_id,
      stationId: tk.station_id,
      stationName: tk.station_name,
      label: tk.label,
      fuelCode: tk.fuel_code,
      capacity: tk.capacity,
      lowThreshold: tk.low_threshold,
      balance,
      isLow: tk.low_threshold > 0 && balance <= tk.low_threshold,
    });
  }
  return result;
}
