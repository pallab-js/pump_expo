# System Design Architecture (SDA)

FuelPump Manager is a **local-first, single-device iOS app** built with React Native +
Expo. There is no backend: all data is captured and stored on the device in SQLite, and
the app works fully offline. Roles (Owner / Staff) are a local, PIN-gated data-scoping
convention rather than server authentication.

## Layered architecture

```mermaid
graph TD
    subgraph "iOS Device (Expo Go)"
        subgraph "Presentation Layer"
            UI[Expo Router screens<br/>Dashboard · Stations · Daily Entry · Reports · Settings]
            CH[react-native-gifted-charts<br/>line · bar · donut]
            KIT[UI kit<br/>Card · KPIStat · Button · Input · Select · Badge · Screen]
        end
        subgraph "State / Logic Layer"
            ST[Zustand stores<br/>session · theme · filters]
            SVC[Services<br/>aggregation · charts · crypto · dates · backup]
        end
        subgraph "Data Layer"
            REPO[Repositories<br/>profile · station · price · entry]
            MIG[Migration runner<br/>schema_version]
            DB[(expo-sqlite<br/>fuelpump.db)]
        end
    end

    UI --> ST
    UI --> KIT
    ST --> SVC
    SVC --> REPO
    REPO --> DB
    SVC --> CH
    MIG --> DB
```

## Data flow (core loop)

```mermaid
sequenceDiagram
    participant U as User
    participant S as Screen
    participant Svc as Service / Repo
    participant DB as SQLite

    U->>S: Enter meter readings
    S->>Svc: saveMeterReading() / getEffectivePrices()
    Svc->>DB: UPSERT meter_reading
    U->>S: Open Dashboard
    S->>Svc: getTotals / getSalesTrend / getFuelMix ...
    Svc->>DB: Aggregated SELECTs (date-range + station scope)
    DB-->>Svc: Rows
    Svc-->>S: KPI + chart data
    S-->>U: Cards & charts
```

## Navigation

```mermaid
graph LR
    GATE[AuthGate<br/>setup / profile pick / PIN] --> TABS
    subgraph TABS[Bottom Tabs]
      D[Dashboard]
      ST[Stations]
      E[Daily Entry]
      R[Reports]
      SET[Settings]
    end
    ST --> SD[station/:id<br/>tanks · nozzles · analytics]
    D --> SD
    SD --> PR[prices/:id]
    SET --> PROF[profiles]
```

## Key design decisions

- **Local-only storage.** Chosen per requirements. Roles are enforced by scoping queries
  (`getAccessibleStations`) and a PIN gate, not by a server.
- **Repository pattern.** Each entity group has a repository module; services compose
  repositories for aggregation. This keeps SQL in one layer and makes it unit-testable.
- **Injectable database.** `createInMemoryDatabase()` lets the entire data + service layer
  be unit-tested with real SQL (via a sql.js (WASM) backed `expo-sqlite` mock).
- **Derived analytics.** The dashboard/report numbers are computed on demand from base
  tables (meter readings, payments, expenses, stock movements) — no denormalized caches to
  keep in sync.
- **Backup as the durability story.** Because deleting the app erases the DB, Settings
  provides a JSON export/restore (share sheet + file picker).
