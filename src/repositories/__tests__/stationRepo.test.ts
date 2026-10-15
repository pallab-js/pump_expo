import { createInMemoryDatabase } from '@/db';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  createStation,
  updateStation,
  deleteStation,
  getStation,
  listStations,
  listFuelTypes,
  createTank,
  listTanks,
  updateTank,
  deleteTank,
  createNozzle,
  listNozzles,
  deleteNozzle,
  stationCounts,
} from '@/repositories/stationRepo';

async function firstFuelTypeId(db: SQLiteDatabase): Promise<number> {
  const fts = await listFuelTypes(db);
  return fts[0].id;
}

describe('stationRepo', () => {
  it('creates, reads, updates and deletes a station', async () => {
    const db = await createInMemoryDatabase();
    const id = await createStation(db, { name: 'Highway Pump', location: 'NH-48', code: 'HP1' });
    let s = await getStation(db, id);
    expect(s?.name).toBe('Highway Pump');
    expect(s?.active).toBe(1);

    await updateStation(db, id, { name: 'Highway Pump 2', active: false });
    s = await getStation(db, id);
    expect(s?.name).toBe('Highway Pump 2');
    expect(s?.active).toBe(0);

    await deleteStation(db, id);
    expect(await getStation(db, id)).toBeNull();
  });

  it('rejects a station without a name', async () => {
    const db = await createInMemoryDatabase();
    await expect(createStation(db, { name: '   ' })).rejects.toThrow(/name is required/i);
  });

  it('lists stations alphabetically', async () => {
    const db = await createInMemoryDatabase();
    await createStation(db, { name: 'Zeta' });
    await createStation(db, { name: 'Alpha' });
    const names = (await listStations(db)).map((s) => s.name);
    expect(names).toEqual(['Alpha', 'Zeta']);
  });

  it('seeds four fuel types', async () => {
    const db = await createInMemoryDatabase();
    expect(await listFuelTypes(db)).toHaveLength(4);
  });

  it('adds tanks and nozzles under a station and counts them', async () => {
    const db = await createInMemoryDatabase();
    const sid = await createStation(db, { name: 'Depot' });
    const ft = await firstFuelTypeId(db);

    const tankId = await createTank(db, {
      station_id: sid,
      fuel_type_id: ft,
      label: 'T1',
      capacity: 10000,
      low_threshold: 1500,
    });
    await createNozzle(db, { station_id: sid, fuel_type_id: ft, label: 'N1', tank_id: tankId });
    await createNozzle(db, { station_id: sid, fuel_type_id: ft, label: 'N2', tank_id: tankId });

    expect(await listTanks(db, sid)).toHaveLength(1);
    expect(await listNozzles(db, sid)).toHaveLength(2);
    expect(await stationCounts(db, sid)).toEqual({ tanks: 1, nozzles: 2 });
  });

  it('updates and deletes a tank', async () => {
    const db = await createInMemoryDatabase();
    const sid = await createStation(db, { name: 'Depot' });
    const ft = await firstFuelTypeId(db);
    const tankId = await createTank(db, {
      station_id: sid,
      fuel_type_id: ft,
      label: 'T1',
      capacity: 5000,
      low_threshold: 800,
    });
    await updateTank(db, tankId, { fuel_type_id: ft, label: 'T1-upd', capacity: 6000, low_threshold: 900 });
    const t = (await listTanks(db, sid))[0];
    expect(t.label).toBe('T1-upd');
    expect(t.capacity).toBe(6000);

    await deleteTank(db, tankId);
    expect(await listTanks(db, sid)).toHaveLength(0);
  });

  it('rejects negative tank values', async () => {
    const db = await createInMemoryDatabase();
    const sid = await createStation(db, { name: 'Depot' });
    const ft = await firstFuelTypeId(db);
    await expect(
      createTank(db, { station_id: sid, fuel_type_id: ft, label: 'T', capacity: -1, low_threshold: 0 })
    ).rejects.toThrow(/non-negative/i);
  });

  it('cascades tanks and nozzles when the station is deleted', async () => {
    const db = await createInMemoryDatabase();
    const sid = await createStation(db, { name: 'Depot' });
    const ft = await firstFuelTypeId(db);
    const tankId = await createTank(db, {
      station_id: sid,
      fuel_type_id: ft,
      label: 'T1',
      capacity: 5000,
      low_threshold: 800,
    });
    await createNozzle(db, { station_id: sid, fuel_type_id: ft, label: 'N1', tank_id: tankId });

    await deleteStation(db, sid);
    expect(await listTanks(db, sid)).toHaveLength(0);
    expect(await listNozzles(db, sid)).toHaveLength(0);
  });

  it('nullifies nozzle.tank_id when its tank is deleted (SET NULL)', async () => {
    const db = await createInMemoryDatabase();
    const sid = await createStation(db, { name: 'Depot' });
    const ft = await firstFuelTypeId(db);
    const tankId = await createTank(db, {
      station_id: sid,
      fuel_type_id: ft,
      label: 'T1',
      capacity: 5000,
      low_threshold: 800,
    });
    const nozzleId = await createNozzle(db, {
      station_id: sid,
      fuel_type_id: ft,
      label: 'N1',
      tank_id: tankId,
    });
    await deleteTank(db, tankId);
    const nozzle = (await listNozzles(db, sid)).find((n) => n.id === nozzleId);
    expect(nozzle?.tank_id).toBeNull();

    await deleteNozzle(db, nozzleId);
    expect(await listNozzles(db, sid)).toHaveLength(0);
  });
});
