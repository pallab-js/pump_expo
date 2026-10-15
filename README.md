# FuelPump Manager

A local-first iOS mobile app (React Native + Expo) to manage multiple fuel pump retail
outlets from a single central dashboard. All data is stored on-device with SQLite. No
backend, works fully offline.

## Features
- Central dashboard with KPI cards and charts (sales trends, station comparison, fuel mix,
  payment mix, stock levels with low-stock alerts).
- Multi-station management: stations, tanks, nozzles.
- Daily entry: nozzle meter readings → auto-computed litres & sales, stock movements,
  payment split (cash/card/UPI/credit), expenses, staff shifts.
- Daily fuel price management.
- Reports with date/station/fuel filters.
- PIN-protected local roles: Owner (full access) and Manager/Staff (scoped).
- JSON backup/restore. Light/dark theme.

## Tech Stack
- Expo (SDK 57, React Native 0.86, React 19) + Expo Router (file-based navigation)
- TypeScript (strict)
- expo-sqlite (async API) for local storage
- react-native-gifted-charts (+ expo-linear-gradient) for visualizations
- Zustand for state, date-fns for dates
- expo-crypto (PIN hashing), expo-file-system + expo-sharing (backup)

## Documentation
Full planning and design docs live in [`docs/`](docs/):
- [Architecture (SDA)](docs/ARCHITECTURE.md)
- [Product Requirements (PRD)](docs/PRD.md)
- [Technical Requirements (TRD)](docs/TRD.md)
- [Database Schema](docs/SCHEMA.md)
- [App Flow](docs/APP_FLOW.md)

## Getting Started

### Prerequisites
- Node.js 20+ and npm
- The **Expo Go** app on your iPhone (from the App Store)
- Your computer and iPhone on the same Wi-Fi network

### Install & Run
```bash
npm install
npx expo start
```
Scan the QR code shown in the terminal with your iPhone camera to open the app in Expo Go.

### Testing
```bash
npm test          # run unit tests
npm run typecheck # TypeScript check
```

## Project Structure
```
app/                 # Expo Router screens (file-based routes)
  (tabs)/            # Dashboard, Stations, Daily Entry, Reports, Settings
  station/[id].tsx   # Station detail: tanks, nozzles, analytics
  prices/[id].tsx    # Fuel price management
  profiles.tsx       # Profile management (owner)
src/
  db/                # SQLite connection, schema, migrations, types
  repositories/      # Data-access layer (profile, station, price, entry)
  services/          # Aggregation / charts / crypto / dates / backup
  stores/            # Zustand stores (session, theme, filters)
  components/        # Reusable UI kit + AuthGate + DayExtras
  theme/             # Theme tokens, light/dark
```

## First run & roles
On first launch you create an **Owner** profile with a PIN. The Owner can add stations,
tanks, nozzles, prices, and additional **Staff** profiles scoped to specific stations.
Staff unlock with their own PIN and only see their assigned stations.

## Data & Privacy
All data lives on the device. Use **Settings → Backup** to export a JSON snapshot you can
restore later or keep in Files/iCloud. Deleting the app without a backup erases all data.
