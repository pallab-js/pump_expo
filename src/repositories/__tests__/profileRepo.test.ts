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
  MAX_PIN_ATTEMPTS,
  lockoutSeconds,
} from '@/repositories/profileRepo';
import * as Crypto from 'expo-crypto';

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
    expect((await checkProfilePin(db, id, '1234')).ok).toBe(true);
    expect((await checkProfilePin(db, id, '0000')).ok).toBe(false);
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
    expect((await checkProfilePin(db, id, '1111')).ok).toBe(false);
    expect((await checkProfilePin(db, id, '2222')).ok).toBe(true);
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

  it('locks the profile after MAX_PIN_ATTEMPTS wrong tries', async () => {
    const db = await createInMemoryDatabase();
    const id = await createProfile(db, { name: 'Owner', role: 'owner', pin: '1234' });

    let res;
    for (let i = 0; i < MAX_PIN_ATTEMPTS; i++) {
      res = await checkProfilePin(db, id, '0000');
    }
    expect(res!.locked).toBe(true);
    expect(res!.retryAfter).toBeGreaterThan(0);

    // Even a correct PIN is refused while locked.
    const duringLock = await checkProfilePin(db, id, '1234');
    expect(duringLock.ok).toBe(false);
    expect(duringLock.locked).toBe(true);
  });

  it('counts down attemptsLeft before a lockout', async () => {
    const db = await createInMemoryDatabase();
    const id = await createProfile(db, { name: 'Owner', role: 'owner', pin: '1234' });
    const first = await checkProfilePin(db, id, '0000');
    expect(first.ok).toBe(false);
    expect(first.locked).toBe(false);
    expect(first.attemptsLeft).toBe(MAX_PIN_ATTEMPTS - 1);
  });

  it('allows unlock again after the lockout window elapses', async () => {
    const db = await createInMemoryDatabase();
    const id = await createProfile(db, { name: 'Owner', role: 'owner', pin: '1234' });
    const t0 = new Date('2026-01-01T00:00:00Z');
    for (let i = 0; i < MAX_PIN_ATTEMPTS; i++) {
      await checkProfilePin(db, id, '0000', t0);
    }
    // Far in the future, past the lockout window.
    const later = new Date(t0.getTime() + 60 * 60 * 1000);
    const res = await checkProfilePin(db, id, '1234', later);
    expect(res.ok).toBe(true);
  });

  it('resets the failed counter on a successful unlock', async () => {
    const db = await createInMemoryDatabase();
    const id = await createProfile(db, { name: 'Owner', role: 'owner', pin: '1234' });
    await checkProfilePin(db, id, '0000');
    await checkProfilePin(db, id, '1234'); // success resets
    const p = await getProfile(db, id);
    expect(p?.failed_attempts).toBe(0);
    expect(p?.locked_until).toBeNull();
  });

  it('transparently migrates a legacy v1 hash to v2 on successful verify', async () => {
    const db = await createInMemoryDatabase();
    // Insert a profile with a legacy bare-SHA256 hash directly.
    const salt = 'deadbeef';
    const legacy = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${salt}:1234`
    );
    const res = await db.runAsync(
      "INSERT INTO profile (name, role, pin_hash, pin_salt) VALUES ('Legacy','owner',?,?)",
      [legacy, salt]
    );
    const id = res.lastInsertRowId;

    const check = await checkProfilePin(db, id, '1234');
    expect(check.ok).toBe(true);

    const p = await getProfile(db, id);
    expect(p?.pin_hash.startsWith('v2$')).toBe(true); // upgraded
    // New hash still verifies.
    const again = await checkProfilePin(db, id, '1234');
    expect(again.ok).toBe(true);
  });

  it('escalates lockout duration across tiers', () => {
    expect(lockoutSeconds(0)).toBe(0);
    expect(lockoutSeconds(MAX_PIN_ATTEMPTS)).toBe(30);
    expect(lockoutSeconds(MAX_PIN_ATTEMPTS * 2)).toBe(60);
    expect(lockoutSeconds(MAX_PIN_ATTEMPTS * 3)).toBe(120);
    expect(lockoutSeconds(MAX_PIN_ATTEMPTS * 100)).toBe(15 * 60); // capped
  });
});
