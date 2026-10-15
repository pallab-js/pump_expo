import { createInMemoryDatabase } from '@/db';
import type { SQLiteDatabase } from 'expo-sqlite';
import { createStation, listFuelTypes } from '@/repositories/stationRepo';
import {
  setPrice,
  listPrices,
  getEffectivePrice,
  getEffectivePrices,
} from '@/repositories/priceRepo';

async function setup(db: SQLiteDatabase) {
  const sid = await createStation(db, { name: 'Depot' });
  const fts = await listFuelTypes(db);
  return { sid, ms: fts[0].id, hsd: fts[1].id };
}

describe('priceRepo', () => {
  it('returns the latest price on-or-before the requested date', async () => {
    const db = await createInMemoryDatabase();
    const { sid, ms } = await setup(db);
    await setPrice(db, { station_id: sid, fuel_type_id: ms, price: 100, effective_date: '2026-01-01' });
    await setPrice(db, { station_id: sid, fuel_type_id: ms, price: 105, effective_date: '2026-02-01' });
    await setPrice(db, { station_id: sid, fuel_type_id: ms, price: 110, effective_date: '2026-03-01' });

    expect(await getEffectivePrice(db, sid, ms, '2026-02-15')).toBe(105);
    expect(await getEffectivePrice(db, sid, ms, '2026-03-01')).toBe(110);
    expect(await getEffectivePrice(db, sid, ms, '2026-03-10')).toBe(110);
  });

  it('returns null when no price exists on-or-before the date', async () => {
    const db = await createInMemoryDatabase();
    const { sid, ms } = await setup(db);
    await setPrice(db, { station_id: sid, fuel_type_id: ms, price: 100, effective_date: '2026-05-01' });
    expect(await getEffectivePrice(db, sid, ms, '2026-04-30')).toBeNull();
  });

  it('upserts the price for the same station+fuel+date', async () => {
    const db = await createInMemoryDatabase();
    const { sid, ms } = await setup(db);
    await setPrice(db, { station_id: sid, fuel_type_id: ms, price: 100, effective_date: '2026-01-01' });
    await setPrice(db, { station_id: sid, fuel_type_id: ms, price: 101.5, effective_date: '2026-01-01' });
    expect(await listPrices(db, sid)).toHaveLength(1);
    expect(await getEffectivePrice(db, sid, ms, '2026-01-01')).toBe(101.5);
  });

  it('resolves effective prices for multiple fuel types at once', async () => {
    const db = await createInMemoryDatabase();
    const { sid, ms, hsd } = await setup(db);
    await setPrice(db, { station_id: sid, fuel_type_id: ms, price: 100, effective_date: '2026-01-01' });
    await setPrice(db, { station_id: sid, fuel_type_id: ms, price: 108, effective_date: '2026-02-01' });
    await setPrice(db, { station_id: sid, fuel_type_id: hsd, price: 90, effective_date: '2026-01-15' });

    const prices = await getEffectivePrices(db, sid, '2026-02-10');
    expect(prices[ms]).toBe(108);
    expect(prices[hsd]).toBe(90);
  });

  it('rejects a negative price', async () => {
    const db = await createInMemoryDatabase();
    const { sid, ms } = await setup(db);
    await expect(
      setPrice(db, { station_id: sid, fuel_type_id: ms, price: -5, effective_date: '2026-01-01' })
    ).rejects.toThrow(/non-negative/i);
  });
});
