import type { SQLiteDatabase } from 'expo-sqlite';
import {
  createStation,
  createTank,
  createNozzle,
  listFuelTypes,
  listStations,
} from '@/repositories/stationRepo';
import { setPrice } from '@/repositories/priceRepo';
import {
  ensureDayRecord,
  saveMeterReading,
  savePayments,
  addExpense,
  addStockMovement,
  addStaff,
  addShift,
} from '@/repositories/entryRepo';
import { daysAgoISO } from '@/services/dates';

/** A fuel type lookup by code for convenience. */
async function fuelMap(db: SQLiteDatabase): Promise<Record<string, number>> {
  const fts = await listFuelTypes(db);
  const map: Record<string, number> = {};
  for (const f of fts) map[f.code] = f.id;
  return map;
}

function rand(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

interface SeedResult {
  stations: number;
  days: number;
}

/** Base prices per fuel code (rupees). */
const BASE_PRICE: Record<string, number> = { MS: 104.5, HSD: 91.2, XP: 112.3, CNG: 76.0 };

/** Per-station daily nozzle throughput range (litres). */
const STATION_PROFILES = [
  { name: 'Highway Pump', location: 'NH-48, Km 23', code: 'HP-01', scale: 1.0 },
  { name: 'City Center Fuels', location: 'MG Road', code: 'CC-02', scale: 0.7 },
  { name: 'Airport Road Station', location: 'Airport Rd', code: 'AR-03', scale: 1.3 },
];

const DAYS = 14;

/**
 * Populate the database with demo data: 3 stations (each with tanks + nozzles),
 * daily fuel prices, and {@link DAYS} days of realistic daily entries.
 * Returns counts. Safe no-op intent: caller should guard against re-seeding.
 */
export async function seedDemoData(db: SQLiteDatabase): Promise<SeedResult> {
  const fuels = await fuelMap(db);
  const today = 0;

  for (const profile of STATION_PROFILES) {
    const stationId = await createStation(db, {
      name: profile.name,
      location: profile.location,
      code: profile.code,
    });

    // Tanks: one per MS/HSD, plus XP at the larger stations.
    const msTank = await createTank(db, {
      station_id: stationId,
      fuel_type_id: fuels.MS,
      label: 'Tank MS',
      capacity: 20000,
      low_threshold: 4000,
    });
    const hsdTank = await createTank(db, {
      station_id: stationId,
      fuel_type_id: fuels.HSD,
      label: 'Tank HSD',
      capacity: 20000,
      low_threshold: 4000,
    });
    const hasXP = profile.scale >= 1.0;
    const xpTank = hasXP
      ? await createTank(db, {
          station_id: stationId,
          fuel_type_id: fuels.XP,
          label: 'Tank XP',
          capacity: 10000,
          low_threshold: 2000,
        })
      : null;

    // Nozzles (2 MS, 2 HSD, 1 XP where available).
    const nozzles: Array<{ id: number; fuel: string; tank: number }> = [];
    nozzles.push({ id: await createNozzle(db, { station_id: stationId, fuel_type_id: fuels.MS, label: 'MS-1', tank_id: msTank }), fuel: 'MS', tank: msTank });
    nozzles.push({ id: await createNozzle(db, { station_id: stationId, fuel_type_id: fuels.MS, label: 'MS-2', tank_id: msTank }), fuel: 'MS', tank: msTank });
    nozzles.push({ id: await createNozzle(db, { station_id: stationId, fuel_type_id: fuels.HSD, label: 'HSD-1', tank_id: hsdTank }), fuel: 'HSD', tank: hsdTank });
    nozzles.push({ id: await createNozzle(db, { station_id: stationId, fuel_type_id: fuels.HSD, label: 'HSD-2', tank_id: hsdTank }), fuel: 'HSD', tank: hsdTank });
    if (xpTank) {
      nozzles.push({ id: await createNozzle(db, { station_id: stationId, fuel_type_id: fuels.XP, label: 'XP-1', tank_id: xpTank }), fuel: 'XP', tank: xpTank });
    }

    // Prices effective from the first seeded day (slightly varied per station).
    const priceDate = daysAgoISO(DAYS - 1);
    for (const code of Object.keys(BASE_PRICE)) {
      if (!fuels[code]) continue;
      const jitter = (Math.random() - 0.5) * 2; // ±1
      await setPrice(db, {
        station_id: stationId,
        fuel_type_id: fuels[code],
        price: Math.round((BASE_PRICE[code] + jitter) * 100) / 100,
        effective_date: priceDate,
      });
    }

    // Staff.
    const staffA = await addStaff(db, stationId, 'Ramesh');
    const staffB = await addStaff(db, stationId, 'Suresh');

    // Opening stock on day 0 of the window.
    const openDay = await ensureDayRecord(db, stationId, daysAgoISO(DAYS - 1));
    await addStockMovement(db, openDay, { tank_id: msTank, type: 'opening', quantity: 16000 });
    await addStockMovement(db, openDay, { tank_id: hsdTank, type: 'opening', quantity: 15000 });
    if (xpTank) await addStockMovement(db, openDay, { tank_id: xpTank, type: 'opening', quantity: 7000 });

    // Running meter positions per nozzle.
    const meterPos: Record<number, number> = {};
    for (const n of nozzles) meterPos[n.id] = rand(10000, 50000);

    for (let d = DAYS - 1; d >= today; d--) {
      const date = daysAgoISO(d);
      const dr = await ensureDayRecord(db, stationId, date);

      let daySales = 0;
      for (const n of nozzles) {
        const base = n.fuel === 'HSD' ? 700 : n.fuel === 'XP' ? 180 : 450;
        const litres = Math.max(0, Math.round(base * profile.scale * (0.7 + Math.random() * 0.6)));
        const opening = meterPos[n.id];
        const closing = opening + litres;
        meterPos[n.id] = closing;
        const price = BASE_PRICE[n.fuel];
        await saveMeterReading(db, dr, { nozzle_id: n.id, opening, closing, test_litres: 0, price });
        daySales += litres * price;
      }

      // Payments split roughly reconciling to sales.
      const cash = Math.round(daySales * (0.35 + Math.random() * 0.1));
      const upi = Math.round(daySales * (0.3 + Math.random() * 0.1));
      const card = Math.round(daySales * (0.15 + Math.random() * 0.08));
      const credit = Math.max(0, Math.round(daySales - cash - upi - card));
      await savePayments(db, dr, { cash, upi, card, credit });

      // Occasional tanker receipts (every ~4 days).
      if (d % 4 === 0) {
        await addStockMovement(db, dr, { tank_id: msTank, type: 'receipt', quantity: 8000, note: 'Tanker' });
        await addStockMovement(db, dr, { tank_id: hsdTank, type: 'receipt', quantity: 8000, note: 'Tanker' });
      }

      // A couple of expenses.
      await addExpense(db, dr, { category: 'Electricity', amount: rand(600, 1400) });
      if (Math.random() > 0.5) {
        await addExpense(db, dr, { category: 'Maintenance', amount: rand(300, 2000) });
      }

      // Shifts.
      await addShift(db, dr, { staff_id: staffA, shift: 'morning' });
      await addShift(db, dr, { staff_id: staffB, shift: 'evening' });
    }

    // A recorded physical closing today so stock levels look live.
    const todayDr = await ensureDayRecord(db, stationId, daysAgoISO(today));
    await addStockMovement(db, todayDr, { tank_id: msTank, type: 'closing', quantity: rand(3000, 14000) });
    await addStockMovement(db, todayDr, { tank_id: hsdTank, type: 'closing', quantity: rand(3000, 14000) });
    if (xpTank) await addStockMovement(db, todayDr, { tank_id: xpTank, type: 'closing', quantity: rand(1000, 6000) });
  }

  return { stations: STATION_PROFILES.length, days: DAYS };
}

/** True if any stations already exist (used to avoid duplicate seeding). */
export async function hasAnyStations(db: SQLiteDatabase): Promise<boolean> {
  return (await listStations(db)).length > 0;
}
