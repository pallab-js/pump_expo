import { createInMemoryDatabase } from '@/db';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  createProfile,
  checkProfilePin,
  countProfiles,
  listProfiles,
  getAccessibleStations,
  setProfileStations,
  getProfileStationIds,
  updateProfilePin,
  deleteProfile,
  getProfile,
} from '@/repositories/profileRepo';

async function seedStations(db: SQLiteDatabase): Promise<number[]> {
  const ids: number[] = [];
  for (const name of ['Alpha', 'Bravo', 'Charlie']) {
    const r = await db.runAsync('INSERT INTO station (name) VALUES (?)', [name]);
    ids.push(r.lastInsertRowId);
  }
  return ids;
}

describe('profileRepo', () => {
  it('creates a profile and verifies a correct PIN, rejects a wrong one', async () => {
    const db = await createInMemoryDatabase();
    const id = await createProfile(db, { name: 'Owner', role: 'owner', pin: '1234' });
    expect(await countProfiles(db)).toBe(1);
    expect(await checkProfilePin(db, id, '1234')).toBe(true);
    expect(await checkProfilePin(db, id, '0000')).toBe(false);
  });

  it('stores a hashed PIN (never plaintext)', async () => {
    const db = await createInMemoryDatabase();
    const id = await createProfile(db, { name: 'Owner', role: 'owner', pin: '4321' });
    const p = await getProfile(db, id);
    expect(p?.pin_hash).toBeDefined();
    expect(p?.pin_hash).not.toContain('4321');
    expect(p?.pin_hash?.length).toBeGreaterThan(16);
    expect(p?.pin_salt?.length).toBeGreaterThan(0);
  });

  it('updates a PIN', async () => {
    const db = await createInMemoryDatabase();
    const id = await createProfile(db, { name: 'Owner', role: 'owner', pin: '1111' });
    await updateProfilePin(db, id, '2222');
    expect(await checkProfilePin(db, id, '1111')).toBe(false);
    expect(await checkProfilePin(db, id, '2222')).toBe(true);
  });

  it('owner sees all stations; staff sees only assigned stations', async () => {
    const db = await createInMemoryDatabase();
    const [s1, s2, s3] = await seedStations(db);

    const ownerId = await createProfile(db, { name: 'Owner', role: 'owner', pin: '1234' });
    const staffId = await createProfile(db, {
      name: 'Staff',
      role: 'staff',
      pin: '5678',
      stationIds: [s1, s3],
    });

    const owner = await getProfile(db, ownerId);
    const staff = await getProfile(db, staffId);

    const ownerStations = await getAccessibleStations(db, owner!);
    expect(ownerStations.map((s) => s.id).sort()).toEqual([s1, s2, s3].sort());

    const staffStations = await getAccessibleStations(db, staff!);
    expect(staffStations.map((s) => s.id).sort()).toEqual([s1, s3].sort());
  });

  it('replaces a profile station assignment set', async () => {
    const db = await createInMemoryDatabase();
    const [s1, s2, s3] = await seedStations(db);
    const staffId = await createProfile(db, {
      name: 'Staff',
      role: 'staff',
      pin: '0000',
      stationIds: [s1],
    });
    await setProfileStations(db, staffId, [s2, s3]);
    expect((await getProfileStationIds(db, staffId)).sort()).toEqual([s2, s3].sort());
  });

  it('deletes a profile and cascades its station links', async () => {
    const db = await createInMemoryDatabase();
    const [s1] = await seedStations(db);
    const staffId = await createProfile(db, {
      name: 'Temp',
      role: 'staff',
      pin: '0000',
      stationIds: [s1],
    });
    await deleteProfile(db, staffId);
    expect(await getProfile(db, staffId)).toBeNull();
    expect(await getProfileStationIds(db, staffId)).toHaveLength(0);
    expect((await listProfiles(db)).length).toBe(0);
  });
});
