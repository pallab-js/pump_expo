import { createInMemoryDatabase } from '@/db';
import type { SQLiteDatabase } from 'expo-sqlite';
import { createStation, listFuelTypes, createNozzle } from '@/repositories/stationRepo';
import {
  ensureDayRecord,
  getDayRecord,
  listDayRecords,
  saveMeterReading,
  listMeterReadings,
  computeDaySales,
  readingLitres,
  readingAmount,
} from '@/repositories/entryRepo';

async function setup(db: SQLiteDatabase) {
  const sid = await createStation(db, { name: 'Depot' });
  const fts = await listFuelTypes(db);
  const ms = fts[0].id;
  const hsd = fts[1].id;
  const n1 = await createNozzle(db, { station_id: sid, fuel_type_id: ms, label: 'N1' });
  const n2 = await createNozzle(db, { station_id: sid, fuel_type_id: hsd, label: 'N2' });
  return { sid, ms, hsd, n1, n2 };
}

describe('entryRepo', () => {
  it('computes litres and amount for a reading', () => {
    expect(readingLitres({ opening: 1000, closing: 1500, test_litres: 0 })).toBe(500);
    expect(readingLitres({ opening: 1000, closing: 1500, test_litres: 20 })).toBe(480);
    expect(readingAmount({ opening: 1000, closing: 1500, test_litres: 0, price: 100 })).toBe(50000);
  });

  it('clamps negative net litres to zero', () => {
    expect(readingLitres({ opening: 1000, closing: 1000, test_litres: 50 })).toBe(0);
  });

  it('creates a single day record per station+date (idempotent)', async () => {
    const db = await createInMemoryDatabase();
    const { sid } = await setup(db);
    const id1 = await ensureDayRecord(db, sid, '2026-10-10');
    const id2 = await ensureDayRecord(db, sid, '2026-10-10');
    expect(id1).toBe(id2);
    expect(await getDayRecord(db, sid, '2026-10-10')).not.toBeNull();
  });

  it('rejects closing < opening', async () => {
    const db = await createInMemoryDatabase();
    const { sid, n1 } = await setup(db);
    const dr = await ensureDayRecord(db, sid, '2026-10-10');
    await expect(
      saveMeterReading(db, dr, { nozzle_id: n1, opening: 500, closing: 400, price: 100 })
    ).rejects.toThrow(/less than opening/i);
  });

  it('upserts a reading per nozzle (no duplicates)', async () => {
    const db = await createInMemoryDatabase();
    const { sid, n1 } = await setup(db);
    const dr = await ensureDayRecord(db, sid, '2026-10-10');
    await saveMeterReading(db, dr, { nozzle_id: n1, opening: 1000, closing: 1200, price: 100 });
    await saveMeterReading(db, dr, { nozzle_id: n1, opening: 1000, closing: 1300, price: 100 });
    const readings = await listMeterReadings(db, dr);
    expect(readings).toHaveLength(1);
    expect(readings[0].closing).toBe(1300);
  });

  it('aggregates day sales per fuel type and overall', async () => {
    const db = await createInMemoryDatabase();
    const { sid, ms, hsd, n1, n2 } = await setup(db);
    const dr = await ensureDayRecord(db, sid, '2026-10-10');
    // MS: 500 L @ 100 = 50000
    await saveMeterReading(db, dr, { nozzle_id: n1, opening: 1000, closing: 1500, price: 100 });
    // HSD: 300 L @ 90 = 27000
    await saveMeterReading(db, dr, { nozzle_id: n2, opening: 2000, closing: 2300, price: 90 });

    const summary = await computeDaySales(db, dr);
    expect(summary.totalLitres).toBe(800);
    expect(summary.totalAmount).toBe(77000);
    expect(summary.perFuel[ms]).toEqual({ litres: 500, amount: 50000 });
    expect(summary.perFuel[hsd]).toEqual({ litres: 300, amount: 27000 });
  });

  it('lists day records most-recent first', async () => {
    const db = await createInMemoryDatabase();
    const { sid } = await setup(db);
    await ensureDayRecord(db, sid, '2026-10-08');
    await ensureDayRecord(db, sid, '2026-10-10');
    await ensureDayRecord(db, sid, '2026-10-09');
    const dates = (await listDayRecords(db, sid)).map((d) => d.date);
    expect(dates).toEqual(['2026-10-10', '2026-10-09', '2026-10-08']);
  });
});
