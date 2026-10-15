import type { SQLiteDatabase } from 'expo-sqlite';
import type { Profile, Role, Station } from '@/db/types';
import { generateSalt, hashPin, verifyPin } from '@/services/crypto';

export interface CreateProfileInput {
  name: string;
  role: Role;
  pin: string;
  stationIds?: number[];
}

/** Count all profiles (used to decide first-run setup). */
export async function countProfiles(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM profile');
  return row?.c ?? 0;
}

export async function listProfiles(db: SQLiteDatabase): Promise<Profile[]> {
  return db.getAllAsync<Profile>('SELECT * FROM profile ORDER BY role, name');
}

export async function getProfile(db: SQLiteDatabase, id: number): Promise<Profile | null> {
  return db.getFirstAsync<Profile>('SELECT * FROM profile WHERE id = ?', [id]);
}

export async function createProfile(
  db: SQLiteDatabase,
  input: CreateProfileInput
): Promise<number> {
  const salt = await generateSalt();
  const pin_hash = await hashPin(input.pin, salt);

  let newId = 0;
  await db.withTransactionAsync(async () => {
    const res = await db.runAsync(
      'INSERT INTO profile (name, role, pin_hash, pin_salt) VALUES (?, ?, ?, ?)',
      [input.name, input.role, pin_hash, salt]
    );
    newId = res.lastInsertRowId;
    if (input.stationIds?.length) {
      for (const sid of input.stationIds) {
        await db.runAsync(
          'INSERT OR IGNORE INTO profile_station (profile_id, station_id) VALUES (?, ?)',
          [newId, sid]
        );
      }
    }
  });
  return newId;
}

export async function updateProfilePin(
  db: SQLiteDatabase,
  id: number,
  newPin: string
): Promise<void> {
  const salt = await generateSalt();
  const pin_hash = await hashPin(newPin, salt);
  await db.runAsync('UPDATE profile SET pin_hash = ?, pin_salt = ? WHERE id = ?', [
    pin_hash,
    salt,
    id,
  ]);
}

export async function deleteProfile(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM profile WHERE id = ?', [id]);
}

/** Verify a PIN for a profile. Returns true on match. */
export async function checkProfilePin(
  db: SQLiteDatabase,
  id: number,
  pin: string
): Promise<boolean> {
  const p = await getProfile(db, id);
  if (!p) return false;
  return verifyPin(pin, p.pin_salt, p.pin_hash);
}

/** Replace the set of stations assigned to a (staff) profile. */
export async function setProfileStations(
  db: SQLiteDatabase,
  profileId: number,
  stationIds: number[]
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM profile_station WHERE profile_id = ?', [profileId]);
    for (const sid of stationIds) {
      await db.runAsync(
        'INSERT OR IGNORE INTO profile_station (profile_id, station_id) VALUES (?, ?)',
        [profileId, sid]
      );
    }
  });
}

/**
 * Return the stations a profile may access.
 * Owners see all stations; staff see only assigned stations.
 */
export async function getAccessibleStations(
  db: SQLiteDatabase,
  profile: Pick<Profile, 'id' | 'role'>
): Promise<Station[]> {
  if (profile.role === 'owner') {
    return db.getAllAsync<Station>('SELECT * FROM station ORDER BY name');
  }
  return db.getAllAsync<Station>(
    `SELECT s.* FROM station s
     JOIN profile_station ps ON ps.station_id = s.id
     WHERE ps.profile_id = ?
     ORDER BY s.name`,
    [profile.id]
  );
}

/** Convenience: list the station ids assigned to a profile. */
export async function getProfileStationIds(
  db: SQLiteDatabase,
  profileId: number
): Promise<number[]> {
  const rows = await db.getAllAsync<{ station_id: number }>(
    'SELECT station_id FROM profile_station WHERE profile_id = ?',
    [profileId]
  );
  return rows.map((r) => r.station_id);
}
