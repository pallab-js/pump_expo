import type { SQLiteDatabase } from 'expo-sqlite';
import type { Profile, Role, Station } from '@/db/types';
import { generateSalt, hashPin, verifyPin, isLegacyHash } from '@/services/crypto';

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

/** Brute-force policy. */
export const MAX_PIN_ATTEMPTS = 5;
export const LOCKOUT_BASE_SECONDS = 30; // escalates with each lockout tier

export interface PinCheckResult {
  ok: boolean;
  locked: boolean;
  /** Seconds remaining on lockout (when locked). */
  retryAfter: number;
  /** Attempts remaining before the next lockout (when not locked and wrong). */
  attemptsLeft: number;
}

/** Seconds of lockout for a given cumulative failed-attempt count. */
export function lockoutSeconds(failedAttempts: number): number {
  const tier = Math.floor(failedAttempts / MAX_PIN_ATTEMPTS); // 1,2,3...
  if (tier <= 0) return 0;
  // 30s, 60s, 120s, 240s ... capped at 15 min.
  return Math.min(LOCKOUT_BASE_SECONDS * 2 ** (tier - 1), 15 * 60);
}

/**
 * Verify a PIN with brute-force protection.
 * - Enforces a lockout window after repeated failures (escalating backoff).
 * - On success, resets the counter and transparently re-hashes legacy (v1)
 *   PINs to the current KDF.
 * `now` is injectable for testing.
 */
export async function checkProfilePin(
  db: SQLiteDatabase,
  id: number,
  pin: string,
  now: Date = new Date()
): Promise<PinCheckResult> {
  const p = await getProfile(db, id);
  if (!p) return { ok: false, locked: false, retryAfter: 0, attemptsLeft: MAX_PIN_ATTEMPTS };

  // Honor an active lockout.
  if (p.locked_until) {
    const until = new Date(p.locked_until).getTime();
    if (until > now.getTime()) {
      return {
        ok: false,
        locked: true,
        retryAfter: Math.ceil((until - now.getTime()) / 1000),
        attemptsLeft: 0,
      };
    }
  }

  const ok = await verifyPin(pin, p.pin_salt, p.pin_hash);

  if (ok) {
    // Reset counters; migrate legacy hash to the current KDF.
    if (isLegacyHash(p.pin_hash)) {
      const salt = await generateSalt();
      const pin_hash = await hashPin(pin, salt);
      await db.runAsync(
        'UPDATE profile SET pin_hash = ?, pin_salt = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?',
        [pin_hash, salt, id]
      );
    } else {
      await db.runAsync(
        'UPDATE profile SET failed_attempts = 0, locked_until = NULL WHERE id = ?',
        [id]
      );
    }
    return { ok: true, locked: false, retryAfter: 0, attemptsLeft: MAX_PIN_ATTEMPTS };
  }

  // Wrong PIN: increment, and lock if a new tier boundary is reached.
  const failed = (p.failed_attempts ?? 0) + 1;
  const lockSecs = failed % MAX_PIN_ATTEMPTS === 0 ? lockoutSeconds(failed) : 0;
  const lockedUntil =
    lockSecs > 0 ? new Date(now.getTime() + lockSecs * 1000).toISOString() : p.locked_until ?? null;

  await db.runAsync('UPDATE profile SET failed_attempts = ?, locked_until = ? WHERE id = ?', [
    failed,
    lockedUntil,
    id,
  ]);

  return {
    ok: false,
    locked: lockSecs > 0,
    retryAfter: lockSecs,
    attemptsLeft: lockSecs > 0 ? 0 : MAX_PIN_ATTEMPTS - (failed % MAX_PIN_ATTEMPTS),
  };
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
