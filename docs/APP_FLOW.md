# App Flow

## First launch → unlocked

```mermaid
stateDiagram-v2
    [*] --> Loading
    Loading --> Setup: no profiles exist
    Loading --> Pick: profiles exist
    Setup --> Unlocked: create Owner + set PIN
    Pick --> PinEntry: choose profile
    PinEntry --> Unlocked: correct PIN
    PinEntry --> Pick: back
    Unlocked --> Pick: Lock (Settings)
```

## Owner daily journey

```mermaid
flowchart TD
    A[Unlock as Owner] --> B[Dashboard: KPIs + charts]
    B --> C{Set things up?}
    C -- yes --> D[Stations: add outlet]
    D --> E[Station detail: add tanks + nozzles]
    E --> F[Manage Fuel Prices: set today's rates]
    C -- no --> G[Daily Entry]
    F --> G
    G --> H[Pick station + date]
    H --> I[Enter nozzle meters → auto litres & sales]
    I --> J[Add payments / stock / expenses / shifts]
    J --> K[Save]
    K --> B
    B --> L[Reports: filter by date/station/fuel]
    B --> M[Settings: theme, profiles, backup]
```

## Staff daily journey

```mermaid
flowchart TD
    A[Unlock as Staff] --> B[Dashboard: only assigned stations]
    B --> C[Daily Entry: assigned station]
    C --> D[Enter meters + payments + stock + expenses + shifts]
    D --> E[Save]
    E --> B
```

Staff cannot manage profiles or backups and only see their assigned stations throughout
(Dashboard, Daily Entry, Reports, Stations list).

## Data lifecycle

```mermaid
flowchart LR
    IN[Daily Entry] --> DB[(SQLite)]
    PRICES[Price mgmt] --> DB
    CONF[Stations/tanks/nozzles] --> DB
    DB --> AGG[Aggregation service]
    AGG --> DASH[Dashboard]
    AGG --> REP[Reports]
    DB --> BK[Backup export JSON]
    BK --> RESTORE[Restore import JSON]
    RESTORE --> DB
```
