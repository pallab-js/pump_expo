# Security Model

FuelPump Manager is a **local-first, offline, single-device** app. Its security model
reflects that: access control is a **local PIN gate**, not server authentication. All
threats below assume an attacker with **physical access to the device or to an exported
backup file** — there is no network/backend attack surface (the app makes no outbound
requests).

## Controls implemented

### Authentication (PIN)
- **Slow KDF, versioned.** PINs are stored as `v2$<iterations>$<hex>` — an iterated
  SHA-256 chain (`PIN_KDF_ITERATIONS` rounds) over a per-profile 16-byte CSPRNG salt
  (`expo-crypto`). This is far slower to brute-force than a single hash. The format is
  versioned so the KDF can be strengthened later. Legacy bare-SHA-256 (`v1`) hashes still
  verify and are **transparently re-hashed to v2 on the next successful unlock**.
- **Brute-force protection.** Each profile tracks `failed_attempts` and `locked_until`.
  After `MAX_PIN_ATTEMPTS` (5) consecutive wrong tries the profile is locked with
  **escalating backoff** (30s → 60s → 120s → … capped at 15 min). A correct PIN resets the
  counter. While locked, even a correct PIN is refused until the window elapses.
- **Auto-lock.** The session locks automatically when the app is backgrounded/inactive
  (`AppState`), so a shared counter device re-prompts for a PIN on resume.
- **PIN guidance.** 6-digit PINs are recommended in the UI (4-digit minimum still allowed).
- **Constant-time-ish comparison** of hashes avoids trivial early-exit timing leaks.

### Data access
- **Role scoping at the data layer.** Staff profiles only ever receive their assigned
  stations (`getAccessibleStations` JOINs `profile_station`); scoping is enforced in queries,
  not just hidden in the UI.

### Backup / restore
- **Credentials stripped on export.** `pin_hash`, `pin_salt`, `failed_attempts`, and
  `locked_until` are **removed** from exported backups, so a shared/leaked backup file
  contains no credential material.
- **Safe restore.** On restore, profiles get a `RESET_REQUIRED` placeholder (a new PIN must
  be set — the old PIN won't verify), `role` is constrained to `{owner, staff}`, and numeric
  columns are coerced to finite values. Identifiers are allow-listed + regex-validated and
  all values are parameterized (no SQL injection); the whole restore is one transaction.

### SQL
- All queries are **parameterized** (`?` placeholders). The only dynamic SQL uses table /
  column **identifiers** drawn from a hardcoded allow-list and validated by
  `^[A-Za-z_][A-Za-z0-9_]*$`.

## Residual risks (accepted / documented)
- **At-rest encryption** relies on the iOS app sandbox + device passcode (iOS file
  protection). The app does not add its own DB encryption. Enable a device passcode.
- **PIN is a convenience lock**, not server-grade identity. A determined attacker with the
  unlocked device has full access, as with any local app.
- **Dependency advisories** reported by `npm audit` are in **dev/build tooling** (Jest,
  Metro, Expo CLI), not in the shipped runtime path; they are tracked for the next Expo SDK
  upgrade rather than force-fixed (which would break the pinned SDK set).

## Reporting
This is a personal/offline project. For issues, open a GitHub issue describing the concern
(avoid including real PINs or backup files).
