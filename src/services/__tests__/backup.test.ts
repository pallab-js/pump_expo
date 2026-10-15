import { createInMemoryDatabase } from '@/db';
import type { SQLiteDatabase } from 'expo-sqlite';
import { createStation, listFuelTypes, createNozzle, createTank, listStations } from '@/repositories/stationRepo';
import { createProfile, listProfiles, checkProfilePin } from '@/repositories/profileRepo';
import { ensureDayRecord, saveMeterReading, savePayments, addExpense, listMeterReadings } from '@/repositories/entryRepo';
import { exportBackup, exportBackupJson, restoreBackup, restoreBackupJson } from '@/services/backup';

async function seed(db: SQLiteDatabase) {
  const sid = await createStation(db, { name: 'Alpha', location: 'NH-1' });
  const fts = await listFuelTypes(db);
  const n1 = await createNozzle(db, { station_id: sid, fuel_type_id: fts[0].id, label: 'N1' });
  await createTank(db, { station_id: sid, fuel_type_id: fts[0].id, label: 'T1', capacity: 10000, low_threshold: 2000 });
  await createProfile(db, { name: 'Owner', role: 'owner', pin: '1234' });
  const dr = await ensureDayRecord(db, sid, '2026-10-10');
  await saveMeterReading(db, dr, { nozzle_id: n1, opening: 0, closing: 500, price: 100 });
  await savePayments(db, dr, { cash: 50000 });
  await addExpense(db, dr, { category: 'Power', amount: 1000 });
  return { sid };
}

describe('backup/restore', () => {
  it('exports a well-formed backup with all tables', async () => {
    const db = await createInMemoryDatabase();
    await seed(db);
    const backup = await exportBackup(db);
    expect(backup.app).toBe('fuelpump-manager');
    expect(backup.data.station).toHaveLength(1);
    expect(backup.data.fuel_type.length).toBeGreaterThanOrEqual(4);
    expect(backup.data.meter_reading).toHaveLength(1);
    expect(backup.data.payment).toHaveLength(1);
  });

  it('round-trips: export → wipe → restore reproduces the data', async () => {
    const db = await createInMemoryDatabase();
    await seed(db);
    const json = await exportBackupJson(db);

    // Wipe everything by restoring an empty-data backup... instead, delete stations (cascades)
    const dbStationsBefore = await listStations(db);
    expect(dbStationsBefore).toHaveLength(1);

    // Corrupt current state: add an extra station
    await createStation(db, { name: 'ShouldBeRemoved' });
    expect(await listStations(db)).toHaveLength(2);

    // Restore from the earlier snapshot
    await restoreBackupJson(db, json);

    const stationsAfter = await listStations(db);
    expect(stationsAfter).toHaveLength(1);
    expect(stationsAfter[0].name).toBe('Alpha');

    const profiles = await listProfiles(db);
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe('Owner');

    // meter reading restored for the restored day record
    const dr = await ensureDayRecord(db, stationsAfter[0].id, '2026-10-10');
    const readings = await listMeterReadings(db, dr);
    expect(readings).toHaveLength(1);
    expect(readings[0].closing).toBe(500);
  });

  it('strips PIN credentials from the exported backup', async () => {
    const db = await createInMemoryDatabase();
    await seed(db);
    const backup = await exportBackup(db);
    const profileRows = backup.data.profile;
    expect(profileRows.length).toBeGreaterThan(0);
    for (const row of profileRows) {
      expect(row.pin_hash).toBeUndefined();
      expect(row.pin_salt).toBeUndefined();
      expect(row.locked_until).toBeUndefined();
      expect(row.failed_attempts).toBeUndefined();
    }
    // Ensure the raw JSON contains no credential material either.
    const json = await exportBackupJson(db);
    expect(json).not.toContain('pin_hash');
    expect(json).not.toContain('pin_salt');
  });

  it('restores profiles with a reset-required placeholder (no usable PIN)', async () => {
    const db = await createInMemoryDatabase();
    await seed(db);
    const json = await exportBackupJson(db);
    await restoreBackupJson(db, json);
    const profiles = await listProfiles(db);
    const owner = profiles[0];
    expect(owner.pin_hash).toBe('RESET_REQUIRED');
    // The original PIN must no longer verify after restore.
    expect((await checkProfilePin(db, owner.id, '1234')).ok).toBe(false);
  });

  it('sanitizes an invalid role on restore to a safe default', async () => {
    const db = await createInMemoryDatabase();
    await seed(db);
    const backup = await exportBackup(db);
    // Tamper: set an illegal role.
    (backup.data.profile[0] as Record<string, unknown>).role = 'superadmin';
    await restoreBackup(db, backup);
    const profiles = await listProfiles(db);
    expect(['owner', 'staff']).toContain(profiles[0].role);
  });

  it('coerces non-finite numeric values on restore', async () => {
    const db = await createInMemoryDatabase();
    await seed(db);
    const backup = await exportBackup(db);
    if (backup.data.expense.length) {
      (backup.data.expense[0] as Record<string, unknown>).amount = 'NaN-ish';
    }
    await restoreBackup(db, backup);
    const rows = await db.getAllAsync<{ amount: number }>('SELECT amount FROM expense');
    rows.forEach((r) => expect(Number.isFinite(r.amount)).toBe(true));
  });

  it('rejects an invalid backup file', async () => {
    const db = await createInMemoryDatabase();
    await expect(restoreBackupJson(db, 'not json')).rejects.toThrow(/valid JSON/i);
    await expect(restoreBackup(db, { app: 'other' } as never)).rejects.toThrow(/Invalid backup/i);
  });
});
