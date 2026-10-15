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
- Expo (SDK 56/57) + Expo Router (file-based navigation)
- TypeScript (strict)
- expo-sqlite (async API) for local storage
- react-native-gifted-charts for visualizations
- Zustand for state, date-fns for dates
- expo-crypto (PIN hashing), expo-file-system + expo-sharing (backup)

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
src/
  db/                # SQLite connection, schema, migrations
  repositories/      # Data-access layer (one per entity)
  services/          # Aggregation / KPI / validation logic
  stores/            # Zustand stores (session, filters, ...)
  components/        # Reusable UI kit
  theme/             # Theme tokens, light/dark
```

## Data & Privacy
All data lives on the device. Use **Settings → Backup** to export a JSON snapshot you can
restore later or keep in Files/iCloud. Deleting the app without a backup erases all data.
