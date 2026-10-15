import { createInMemoryDatabase } from '@/db';
import { seedDemoData, hasAnyStations } from '@/services/seed';
import { listStations, listTanks, listNozzles } from '@/repositories/stationRepo';
import { getTotals, getStationComparison, getStockLevels } from '@/services/aggregation';
import { daysAgoISO, todayISO } from '@/services/dates';

describe('seedDemoData', () => {
  it('creates stations with tanks and nozzles', async () => {
    const db = await createInMemoryDatabase();
    expect(await hasAnyStations(db)).toBe(false);

    const res = await seedDemoData(db);
    expect(res.stations).toBe(3);
    expect(res.days).toBe(14);

    const stations = await listStations(db);
    expect(stations).toHaveLength(3);

    for (const s of stations) {
      expect((await listTanks(db, s.id)).length).toBeGreaterThanOrEqual(2);
      expect((await listNozzles(db, s.id)).length).toBeGreaterThanOrEqual(4);
    }
    expect(await hasAnyStations(db)).toBe(true);
  });

  it('produces non-zero aggregates over the seeded window', async () => {
    const db = await createInMemoryDatabase();
    await seedDemoData(db);

    const range = { start: daysAgoISO(14), end: todayISO() };
    const totals = await getTotals(db, range);
    expect(totals.totalRevenue).toBeGreaterThan(0);
    expect(totals.totalLitres).toBeGreaterThan(0);
    expect(totals.totalPayments).toBeGreaterThan(0);
    expect(totals.activeDays).toBeGreaterThan(0);

    const comparison = await getStationComparison(db, range);
    expect(comparison).toHaveLength(3);
    comparison.forEach((c) => expect(c.revenue).toBeGreaterThan(0));

    const stock = await getStockLevels(db, todayISO());
    expect(stock.length).toBeGreaterThanOrEqual(6);
  });
});
