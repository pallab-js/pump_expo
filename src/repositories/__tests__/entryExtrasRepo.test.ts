import { createInMemoryDatabase } from '@/db';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  createStation,
  listFuelTypes,
  createNozzle,
  createTank,
} from '@/repositories/stationRepo';
import {
  ensureDayRecord,
  saveMeterReading,
  savePayments,
  listPayments,
  paymentsTotal,
  addExpense,
  listExpenses,
  deleteExpense,
  expensesTotal,
  addStockMovement,
  listStockMovements,
  stockBalance,
  addShift,
  listShifts,
  addStaff,
  listStaff,
  reconcileDay,
} from '@/repositories/entryRepo';

async function setup(db: SQLiteDatabase) {
  const sid = await createStation(db, { name: 'Depot' });
  const fts = await listFuelTypes(db);
  const ms = fts[0].id;
  const n1 = await createNozzle(db, { station_id: sid, fuel_type_id: ms, label: 'N1' });
  const tank = await createTank(db, {
    station_id: sid,
    fuel_type_id: ms,
    label: 'T1',
    capacity: 10000,
    low_threshold: 1500,
  });
  const dr = await ensureDayRecord(db, sid, '2026-10-10');
  return { sid, ms, n1, tank, dr };
}

describe('entryRepo (stock/payments/expenses/shifts)', () => {
  it('replaces payments and totals them', async () => {
    const db = await createInMemoryDatabase();
    const { dr } = await setup(db);
    await savePayments(db, dr, { cash: 20000, upi: 15000, card: 5000, credit: 0 });
    const payments = await listPayments(db, dr);
    expect(payments).toHaveLength(3); // credit=0 excluded
    expect(await paymentsTotal(db, dr)).toBe(40000);

    // replace
    await savePayments(db, dr, { cash: 10000 });
    expect(await listPayments(db, dr)).toHaveLength(1);
    expect(await paymentsTotal(db, dr)).toBe(10000);
  });

  it('reconciles payments against sales (variance)', async () => {
    const db = await createInMemoryDatabase();
    const { dr, n1 } = await setup(db);
    // 500 L @ 100 = 50000 sales
    await saveMeterReading(db, dr, { nozzle_id: n1, opening: 1000, closing: 1500, price: 100 });
    await savePayments(db, dr, { cash: 30000, upi: 20000 });
    const rec = await reconcileDay(db, dr);
    expect(rec.salesAmount).toBe(50000);
    expect(rec.paymentsTotal).toBe(50000);
    expect(rec.variance).toBe(0);

    await savePayments(db, dr, { cash: 30000 });
    const rec2 = await reconcileDay(db, dr);
    expect(rec2.variance).toBe(-20000); // underpaid vs sales
  });

  it('adds, lists, totals and deletes expenses', async () => {
    const db = await createInMemoryDatabase();
    const { dr } = await setup(db);
    const e1 = await addExpense(db, dr, { category: 'Electricity', amount: 1200 });
    await addExpense(db, dr, { category: 'Snacks', amount: 300, note: 'staff tea' });
    expect(await listExpenses(db, dr)).toHaveLength(2);
    expect(await expensesTotal(db, dr)).toBe(1500);
    await deleteExpense(db, e1);
    expect(await expensesTotal(db, dr)).toBe(300);
  });

  it('rejects an expense without a category or with a negative amount', async () => {
    const db = await createInMemoryDatabase();
    const { dr } = await setup(db);
    await expect(addExpense(db, dr, { category: '  ', amount: 100 })).rejects.toThrow(/category/i);
    await expect(addExpense(db, dr, { category: 'X', amount: -1 })).rejects.toThrow(/non-negative/i);
  });

  it('records stock movements and computes a balance', async () => {
    const db = await createInMemoryDatabase();
    const { dr, tank } = await setup(db);
    await addStockMovement(db, dr, { tank_id: tank, type: 'opening', quantity: 4000 });
    await addStockMovement(db, dr, { tank_id: tank, type: 'receipt', quantity: 6000, note: 'tanker' });
    const movements = await listStockMovements(db, dr);
    expect(movements).toHaveLength(2);
    expect(stockBalance(movements)).toBe(10000);

    // a physical closing count overrides the running balance
    await addStockMovement(db, dr, { tank_id: tank, type: 'closing', quantity: 5200 });
    expect(stockBalance(await listStockMovements(db, dr))).toBe(5200);
  });

  it('adds staff and assigns shifts', async () => {
    const db = await createInMemoryDatabase();
    const { sid, dr } = await setup(db);
    const staffId = await addStaff(db, sid, 'Ramesh', '9999999999');
    expect(await listStaff(db, sid)).toHaveLength(1);

    await addShift(db, dr, { staff_id: staffId, shift: 'morning' });
    await addShift(db, dr, { staff_id: staffId, shift: 'evening', note: 'overtime' });
    expect(await listShifts(db, dr)).toHaveLength(2);
  });
});
