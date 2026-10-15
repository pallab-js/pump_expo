import { createInMemoryDatabase } from '@/db';
import type { SQLiteDatabase } from 'expo-sqlite';
import { createStation, listFuelTypes, createNozzle } from '@/repositories/stationRepo';
import { ensureDayRecord, saveMeterReading } from '@/repositories/entryRepo';
import { getTotals, getStationComparison } from '@/services/aggregation';

async function seed(db: SQLiteDatabase) {
  const s1 = await createStation(db, { name: 'Alpha' });
  const s2 = await createStation(db, { name: 'Bravo' });
  const fts = await listFuelTypes(db);
  const n1 = await createNozzle(db, { station_id: s1, fuel_type_id: fts[0].id, label: 'A1' });
  const n2 = await createNozzle(db, { station_id: s2, fuel_type_id: fts[0].id, label: 'B1' });
  const d1 = await ensureDayRecord(db, s1, '2026-10-01');
  const d2 = await ensureDayRecord(db, s2, '2026-10-01');
  await saveMeterReading(db, d1, { nozzle_id: n1, opening: 0, closing: 400, price: 100 }); // 40000
  await saveMeterReading(db, d2, { nozzle_id: n2, opening: 0, closing: 600, price: 100 }); // 60000
  return { s1, s2 };
}

const RANGE = { start: '2026-10-01', end: '2026-10-31' };

describe('reports consistency (scoped == dashboard)', () => {
  it('all-stations revenue equals the sum of per-station scoped revenue', async () => {
    const db = await createInMemoryDatabase();
    const { s1, s2 } = await seed(db);

    const all = await getTotals(db, RANGE);
    const only1 = await getTotals(db, RANGE, { stationIds: [s1] });
    const only2 = await getTotals(db, RANGE, { stationIds: [s2] });

    expect(all.totalRevenue).toBe(100000);
    expect(only1.totalRevenue).toBe(40000);
    expect(only2.totalRevenue).toBe(60000);
    expect(only1.totalRevenue + only2.totalRevenue).toBe(all.totalRevenue);
  });

  it('station comparison totals match scoped per-station totals', async () => {
    const db = await createInMemoryDatabase();
    const { s1 } = await seed(db);
    const cmp = await getStationComparison(db, RANGE);
    const scoped = await getTotals(db, RANGE, { stationIds: [s1] });
    const row = cmp.find((c) => c.stationId === s1);
    expect(row?.revenue).toBe(scoped.totalRevenue);
  });
});
