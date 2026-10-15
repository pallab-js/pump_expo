# Technical Requirements Document (TRD)

## Platform & stack
- **Runtime:** iOS via **Expo Go** (also runs under the standard Expo dev client).
- **SDK:** Expo **SDK 57** (React Native 0.86, React 19.2).
- **Language:** TypeScript (strict).
- **Navigation:** Expo Router (file-based; bottom tabs + stacks, typed routes).
- **Storage:** `expo-sqlite` (async API) — local relational database `fuelpump.db`.
- **State:** Zustand (session, theme, filters).
- **Charts:** `react-native-gifted-charts` (+ `react-native-svg`).
- **Dates:** `date-fns`.
- **Crypto:** `expo-crypto` (SHA-256 PIN hashing with per-profile salt).
- **Backup I/O:** `expo-file-system` (File/Paths API) + `expo-sharing`.

## Project structure
```
app/                      # Expo Router routes
  (tabs)/                 # Dashboard, Stations, Daily Entry, Reports, Settings
  station/[id].tsx        # Station detail (config + analytics)
  prices/[id].tsx         # Fuel price management
  profiles.tsx            # Profile management (owner)
  gallery / db-debug / kpi-debug  # Developer screens
src/
  db/                     # connection, schema, migrations, types
  repositories/           # profile, station, price, entry
  services/               # aggregation, charts, crypto, dates, backup(+IO)
  stores/                 # session, theme, filter (Zustand)
  components/             # UI kit + AuthGate + DayExtras
  theme/                  # tokens + useTheme
__mocks__/                # expo-sqlite (better-sqlite3), expo-crypto (node:crypto)
```

## Persistence & migrations
- A `schema_version` table tracks applied migrations; `runMigrations()` applies pending
  versions in order and is idempotent.
- Foreign keys are enabled (`PRAGMA foreign_keys = ON`); WAL journal mode.
- Cascade rules: deleting a station cascades its tanks/nozzles/day records; deleting a tank
  sets dependent `nozzle.tank_id` to NULL.

## Data integrity rules
- Meter litres = `max(0, closing − opening − test_litres)`; `closing ≥ opening` enforced.
- Prices are effective-dated and non-negative; the resolver picks the latest price with
  `effective_date ≤ date`.
- One `day_record` per `(station, date)`; one `meter_reading` per `(day_record, nozzle)`.
- Payments are stored per method; day reconciliation reports `variance = payments − sales`.

## Testing
- **Framework:** Jest (`jest-expo` preset) + `@testing-library/react-native` (v12.9).
- **Database tests** run **real SQL** via a `better-sqlite3`-backed `expo-sqlite` mock, so
  repositories and services are genuinely exercised.
- Coverage includes migrations, profile/role scoping, station CRUD + cascades, price
  resolution, entry math, payments/expenses/stock/shifts, aggregation across stations/days,
  chart mappers, filter store, and backup round-trip.
- Commands: `npm test`, `npm run typecheck`.

## Build / run verification
- `npx expo start` to run on device via Expo Go.
- `npx expo export --platform ios` is used as a CI-free bundle check.

## Continuous integration
- **GitHub Actions** (`.github/workflows/ci.yml`) runs on every push/PR to `main`:
  `npm ci` → `npm run typecheck` → `npm test -- --ci --coverage` → `expo export --platform ios`.
- A root `.npmrc` sets `legacy-peer-deps=true` so `npm ci` resolves the dependency tree the
  same way locally and in CI. `better-sqlite3` (test engine) builds natively on
  `ubuntu-latest`.

## Known constraints
- Peer-dependency alignment requires `--legacy-peer-deps` for a few JS-only packages;
  native module versions are pinned to the SDK 57 set.
- `react-native-worklets` is pinned to the SDK-aligned version for Reanimated 4.
