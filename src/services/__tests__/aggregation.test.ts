import { createInMemoryDatabase } from '@/db';
import type { SQLiteDatabase } from 'expo-sqlite';
import { createStation, listFuelTypes, createNozzle, createTank } from '@/repositories/stationRepo';
import { ensureDayRecord, saveMeterReading, savePayments, addExpense, addStockMovement } from '@/repositories/entryRepo';
import {
  getTotals,
  getSalesTrend,
  getFuelMix,
  getPaymentMix,
  getStationComparison,
  getStockLevels,
} from '@/services/aggregation';

interface Fixture {
  s1: number;
  s2: number;
  ms: number;
  hsd: number;
  tankS1: number;
}

async function seed(db: SQLiteDatabase): Promise<Fixture> {
  const s1 = await createStation(db, { name: 'Alpha' });
  const s2 = await createStation(db, { name: 'Bravo' });
  const fts = await listFuelTypes(db);
  const ms = fts[0].id;
  const hsd = fts[1].id;

  const n1 = await createNozzle(db, { station_id: s1, fuel_type_id: ms, label: 'A-MS' });
  const n2 = await createNozzle(db, { station_id: s1, fuel_type_id: hsd, label: 'A-HSD' });
  const n3 = await createNozzle(db, { station_id: s2, fuel_type_id: ms, label: 'B-MS' });
  const tankS1 = await createTank(db, { station_id: s1, fuel_type_id: ms, label: 'A-T1', capacity: 10000, low_threshold: 2000 });

  // Day 1 (2026-10-01)
  const d1s1 = await ensureDayRecord(db, s1, '2026-10-01');
  await saveMeterReading(db, d1s1, { nozzle_id: n1, opening: 0, closing: 500, price: 100 }); // 500L @100 = 50000 MS
  await saveMeterReading(db, d1s1, { nozzle_id: n2, opening: 0, closing: 300, price: 90 });  // 300L @90 = 27000 HSD
  await savePayments(db, d1s1, { cash: 40000, upi: 37000 });
  await addExpense(db, d1s1, { category: 'Power', amount: 1000 });
  await addStockMovement(db, d1s1, { tank_id: tankS1, type: 'opening', quantity: 8000 });

  const d1s2 = await ensureDayRecord(db, s2, '2026-10-01');
  await saveMeterReading(db, d1s2, { nozzle_id: n3, opening: 0, closing: 200, price: 100 }); // 200L @100 = 20000 MS

  // Day 2 (2026-10-02) station 1 only
  const d2s1 = await ensureDayRecord(db, s1, '2026-10-02');
  await saveMeterReading(db, d2s1, { nozzle_id: n1, opening: 500, closing: 1000, price: 100 }); // 500L @100 = 50000 MS
  await savePayments(db, d2s1, { card: 50000 });
  await addStockMovement(db, d2s1, { tank_id: tankS1, type: 'receipt', quantity: 1000 });

  return { s1, s2, ms, hsd, tankS1 };
}

const RANGE = { start: '2026-10-01', end: '2026-10-31' };

describe('aggregation service', () => {
  it('computes headline totals across all stations', async () => {
    const db = await createInMemoryDatabase();
    await seed(db);
    const totals = await getTotals(db, RANGE);
    // Revenue: 50000+27000 (s1 d1) + 20000 (s2 d1) + 50000 (s1 d2) = 147000
    expect(totals.totalRevenue).toBe(147000);
    // Litres: 500+300 + 200 + 500 = 1500
    expect(totals.totalLitres).toBe(1500);
    expect(totals.totalExpenses).toBe(1000);
    expect(totals.totalPayments).toBe(40000 + 37000 + 50000);
    expect(totals.activeDays).toBe(3);
  });

  it('scopes totals to given station ids', async () => {
    const db = await createInMemoryDatabase();
    const { s2 } = await seed(db);
    const totals = await getTotals(db, RANGE, { stationIds: [s2] });
    expect(totals.totalRevenue).toBe(20000);
    expect(totals.totalLitres).toBe(200);
  });

  it('builds a daily sales trend', async () => {
    const db = await createInMemoryDatabase();
    await seed(db);
    const trend = await getSalesTrend(db, RANGE);
    expect(trend).toHaveLength(2);
    expect(trend[0]).toEqual({ date: '2026-10-01', litres: 1000, revenue: 97000 });
    expect(trend[1]).toEqual({ date: '2026-10-02', litres: 500, revenue: 50000 });
  });

  it('computes fuel mix by litres and revenue', async () => {
    const db = await createInMemoryDatabase();
    const { ms, hsd } = await seed(db);
    const mix = await getFuelMix(db, RANGE);
    const msSlice = mix.find((m) => m.fuelTypeId === ms);
    const hsdSlice = mix.find((m) => m.fuelTypeId === hsd);
    expect(msSlice?.litres).toBe(1200); // 500+200+500
    expect(msSlice?.revenue).toBe(120000);
    expect(hsdSlice?.litres).toBe(300);
    expect(hsdSlice?.revenue).toBe(27000);
  });

  it('computes payment mix', async () => {
    const db = await createInMemoryDatabase();
    await seed(db);
    const mix = await getPaymentMix(db, RANGE);
    const map = Object.fromEntries(mix.map((m) => [m.method, m.amount]));
    expect(map.cash).toBe(40000);
    expect(map.upi).toBe(37000);
    expect(map.card).toBe(50000);
  });

  it('ranks stations by revenue', async () => {
    const db = await createInMemoryDatabase();
    const { s1, s2 } = await seed(db);
    const cmp = await getStationComparison(db, RANGE);
    expect(cmp[0].stationId).toBe(s1); // 127000
    expect(cmp[0].revenue).toBe(127000);
    expect(cmp[1].stationId).toBe(s2); // 20000
  });

  it('computes stock levels and flags low stock', async () => {
    const db = await createInMemoryDatabase();
    const { tankS1 } = await seed(db);
    const levels = await getStockLevels(db, '2026-10-31');
    const t1 = levels.find((l) => l.tankId === tankS1);
    expect(t1?.balance).toBe(9000); // opening 8000 + receipt 1000
    expect(t1?.isLow).toBe(false); // threshold 2000

    // after a low closing count, it should flag low
    const d3 = await ensureDayRecord(db, t1!.stationId, '2026-10-03');
    await addStockMovement(db, d3, { tank_id: tankS1, type: 'closing', quantity: 1500 });
    const levels2 = await getStockLevels(db, '2026-10-31');
    expect(levels2.find((l) => l.tankId === tankS1)?.balance).toBe(1500);
    expect(levels2.find((l) => l.tankId === tankS1)?.isLow).toBe(true);
  });
});
