# Product Requirements Document (PRD)

## Overview
FuelPump Manager is a local-first iOS app for managing multiple fuel pump retail outlets
from a single central dashboard. It runs fully offline; all data is stored on-device.

## Target users
- **Owner** — full access to every station, the central dashboard, reports, price
  management, profile management, and backup/restore.
- **Manager / Staff** — PIN-gated access scoped to assigned stations; records daily entries
  and views scoped dashboards/reports. Cannot manage profiles or backups.

## Problem
Owners of 2–10 outlets lack a simple, offline way to record each station's daily
operations and compare performance in one place, without a cloud subscription or
connectivity.

## Goals
- Record complete daily operations per station: nozzle meter readings (→ litres & sales),
  tank stock movements, payment split, expenses, and staff shifts.
- Manage stations, tanks, nozzles, and daily fuel prices.
- Provide a polished central dashboard with KPI cards and charts (revenue trend, fuel mix,
  payment mix, station comparison, stock levels + low-stock alerts).
- Offer filterable reports (date range, station, fuel type).
- Protect access with local PIN-gated roles.
- Allow JSON backup/restore to guard against data loss.

## Non-goals (MVP)
- Cloud sync or multi-device real-time collaboration.
- Server-side authentication / user accounts.
- Android-specific polish (code is cross-platform but iOS is the target).
- Push notifications, payments integration, tax/invoice generation.

## Functional requirements
1. **First run** creates an Owner profile with a PIN.
2. **Auth gate** requires selecting a profile and entering its PIN to unlock.
3. **Stations**: owner can create/edit/delete; staff see only assigned stations.
4. **Tanks & nozzles**: configured per station; nozzles link to a fuel type (and optionally
   a tank).
5. **Prices**: per station, per fuel type, effective-dated; the latest on-or-before a date
   applies.
6. **Daily entry**: per station per date; meter opening/closing/test → auto litres & sales;
   plus payments, stock movements, expenses, staff shifts.
7. **Dashboard**: role-scoped KPIs and charts over a selectable date range.
8. **Reports**: summaries filterable by date range, station, and fuel type.
9. **Settings**: theme (system/light/dark), profile management (owner), backup/restore
   (owner).

## Success criteria
- Full feature set above works on a real iPhone via Expo Go.
- Polished, modern UI with light/dark themes.
- Core data math (litres, sales, aggregates, reconciliation, stock balances) is covered by
  passing unit tests.
