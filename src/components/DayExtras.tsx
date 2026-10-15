import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getDatabase } from '@/db';
import type { Tank, Staff, Expense, StockMovement, Shift, PaymentMethod, StockMovementType, ShiftName } from '@/db/types';
import { listTanks } from '@/repositories/stationRepo';
import {
  PAYMENT_METHODS,
  listPayments,
  savePayments,
  paymentsTotal,
  listExpenses,
  addExpense,
  deleteExpense,
  listStockMovements,
  addStockMovement,
  deleteStockMovement,
  listShifts,
  addShift,
  deleteShift,
  listStaff,
  addStaff,
} from '@/repositories/entryRepo';
import { useTheme } from '@/theme/useTheme';
import { Card } from './Card';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { Badge } from './Badge';

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  upi: 'UPI',
  credit: 'Credit',
};

const STOCK_TYPES: StockMovementType[] = ['opening', 'receipt', 'closing', 'adjustment'];
const SHIFT_NAMES: ShiftName[] = ['morning', 'evening', 'night', 'full'];

export function DayExtras({
  dayRecordId,
  stationId,
  readOnly,
}: {
  dayRecordId: number;
  stationId: number;
  readOnly?: boolean;
}) {
  const t = useTheme();

  const [payments, setPayments] = useState<Record<PaymentMethod, string>>({
    cash: '',
    card: '',
    upi: '',
    credit: '',
  });
  const [payTotal, setPayTotal] = useState(0);

  const [tanks, setTanks] = useState<Tank[]>([]);
  const [stock, setStock] = useState<StockMovement[]>([]);
  const [stockTank, setStockTank] = useState<number | null>(null);
  const [stockType, setStockType] = useState<StockMovementType>('receipt');
  const [stockQty, setStockQty] = useState('');

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expCat, setExpCat] = useState('');
  const [expAmt, setExpAmt] = useState('');

  const [staff, setStaff] = useState<Staff[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftStaff, setShiftStaff] = useState<number | null>(null);
  const [shiftName, setShiftName] = useState<ShiftName>('morning');
  const [newStaffName, setNewStaffName] = useState('');

  const load = useCallback(async () => {
    const db = await getDatabase();
    const pays = await listPayments(db, dayRecordId);
    const pmap: Record<PaymentMethod, string> = { cash: '', card: '', upi: '', credit: '' };
    for (const p of pays) pmap[p.method] = String(p.amount);
    setPayments(pmap);
    setPayTotal(await paymentsTotal(db, dayRecordId));

    const tk = await listTanks(db, stationId);
    setTanks(tk);
    if (stockTank === null && tk.length) setStockTank(tk[0].id);
    setStock(await listStockMovements(db, dayRecordId));

    setExpenses(await listExpenses(db, dayRecordId));

    const st = await listStaff(db, stationId);
    setStaff(st);
    if (shiftStaff === null && st.length) setShiftStaff(st[0].id);
    setShifts(await listShifts(db, dayRecordId));
  }, [dayRecordId, stationId, stockTank, shiftStaff]);

  useEffect(() => {
    load();
  }, [load]);

  const onSavePayments = async () => {
    const db = await getDatabase();
    const amounts: Partial<Record<PaymentMethod, number>> = {};
    for (const m of PAYMENT_METHODS) amounts[m] = Number(payments[m]) || 0;
    await savePayments(db, dayRecordId, amounts);
    await load();
  };

  const onAddStock = async () => {
    if (stockTank === null || !stockQty) return;
    const db = await getDatabase();
    await addStockMovement(db, dayRecordId, {
      tank_id: stockTank,
      type: stockType,
      quantity: Number(stockQty) || 0,
    });
    setStockQty('');
    await load();
  };

  const onAddExpense = async () => {
    if (!expCat.trim() || !expAmt) return;
    const db = await getDatabase();
    await addExpense(db, dayRecordId, { category: expCat.trim(), amount: Number(expAmt) || 0 });
    setExpCat('');
    setExpAmt('');
    await load();
  };

  const onAddStaff = async () => {
    if (!newStaffName.trim()) return;
    const db = await getDatabase();
    await addStaff(db, stationId, newStaffName.trim());
    setNewStaffName('');
    await load();
  };

  const onAddShift = async () => {
    const db = await getDatabase();
    await addShift(db, dayRecordId, { staff_id: shiftStaff, shift: shiftName });
    await load();
  };

  const tankLabel = (id: number) => tanks.find((x) => x.id === id)?.label ?? '?';
  const staffLabel = (id: number | null) =>
    id == null ? '—' : staff.find((s) => s.id === id)?.name ?? '?';

  return (
    <View style={styles.wrap}>
      {/* Payments */}
      <Text style={[styles.section, { color: t.colors.text }]}>Payments</Text>
      <Card>
        <View style={styles.payGrid}>
          {PAYMENT_METHODS.map((m) => (
            <View key={m} style={styles.payCell}>
              <Input
                label={METHOD_LABELS[m]}
                value={payments[m]}
                keyboardType="numeric"
                onChangeText={(v) => setPayments((p) => ({ ...p, [m]: v.replace(/[^0-9.]/g, '') }))}
              />
            </View>
          ))}
        </View>
        <View style={styles.rowBetween}>
          <Badge label={`Total ₹${payTotal.toFixed(0)}`} tone="primary" />
          {!readOnly ? <Button title="Save payments" onPress={onSavePayments} /> : null}
        </View>
      </Card>

      {/* Stock */}
      <Text style={[styles.section, { color: t.colors.text }]}>Stock movements</Text>
      {stock.map((m) => (
        <Card key={m.id} style={styles.listRow}>
          <View style={styles.flex}>
            <Text style={[styles.name, { color: t.colors.text }]}>
              {tankLabel(m.tank_id)} · {m.type}
            </Text>
            <Text style={[styles.muted, { color: t.colors.textMuted }]}>{m.quantity} units</Text>
          </View>
          {!readOnly ? (
            <Button
              title="✕"
              variant="ghost"
              onPress={async () => {
                const db = await getDatabase();
                await deleteStockMovement(db, m.id);
                await load();
              }}
            />
          ) : null}
        </Card>
      ))}
      {!readOnly && tanks.length > 0 ? (
        <Card>
          <Select label="Tank" options={tanks.map((tk) => ({ label: tk.label, value: tk.id }))} value={stockTank} onChange={setStockTank} />
          <View style={styles.gap} />
          <Select label="Type" options={STOCK_TYPES.map((s) => ({ label: s, value: s }))} value={stockType} onChange={setStockType} />
          <View style={styles.gap} />
          <View style={styles.rowEnd}>
            <View style={styles.flex}>
              <Input label="Quantity" value={stockQty} keyboardType="numeric" onChangeText={(v) => setStockQty(v.replace(/[^0-9.]/g, ''))} />
            </View>
            <Button title="Add" onPress={onAddStock} />
          </View>
        </Card>
      ) : null}

      {/* Expenses */}
      <Text style={[styles.section, { color: t.colors.text }]}>Expenses</Text>
      {expenses.map((e) => (
        <Card key={e.id} style={styles.listRow}>
          <View style={styles.flex}>
            <Text style={[styles.name, { color: t.colors.text }]}>{e.category}</Text>
            <Text style={[styles.muted, { color: t.colors.textMuted }]}>₹{e.amount}</Text>
          </View>
          {!readOnly ? (
            <Button
              title="✕"
              variant="ghost"
              onPress={async () => {
                const db = await getDatabase();
                await deleteExpense(db, e.id);
                await load();
              }}
            />
          ) : null}
        </Card>
      ))}
      {!readOnly ? (
        <Card>
          <View style={styles.rowEnd}>
            <View style={styles.flex2}>
              <Input label="Category" value={expCat} onChangeText={setExpCat} placeholder="e.g. Electricity" />
            </View>
            <View style={styles.flex}>
              <Input label="Amount" value={expAmt} keyboardType="numeric" onChangeText={(v) => setExpAmt(v.replace(/[^0-9.]/g, ''))} />
            </View>
            <Button title="Add" onPress={onAddExpense} />
          </View>
        </Card>
      ) : null}

      {/* Shifts */}
      <Text style={[styles.section, { color: t.colors.text }]}>Staff shifts</Text>
      {shifts.map((s) => (
        <Card key={s.id} style={styles.listRow}>
          <View style={styles.flex}>
            <Text style={[styles.name, { color: t.colors.text }]}>
              {staffLabel(s.staff_id)} · {s.shift}
            </Text>
          </View>
          {!readOnly ? (
            <Button
              title="✕"
              variant="ghost"
              onPress={async () => {
                const db = await getDatabase();
                await deleteShift(db, s.id);
                await load();
              }}
            />
          ) : null}
        </Card>
      ))}
      {!readOnly ? (
        <Card>
          {staff.length === 0 ? (
            <View style={styles.rowEnd}>
              <View style={styles.flex2}>
                <Input label="Add staff member" value={newStaffName} onChangeText={setNewStaffName} placeholder="e.g. Ramesh" />
              </View>
              <Button title="Add" onPress={onAddStaff} />
            </View>
          ) : (
            <>
              <Select label="Staff" options={staff.map((s) => ({ label: s.name, value: s.id }))} value={shiftStaff} onChange={setShiftStaff} />
              <View style={styles.gap} />
              <Select label="Shift" options={SHIFT_NAMES.map((s) => ({ label: s, value: s }))} value={shiftName} onChange={setShiftName} />
              <View style={styles.gap} />
              <View style={styles.rowBetween}>
                <Input label="Add staff" value={newStaffName} onChangeText={setNewStaffName} placeholder="new name" />
                <Button title="+ Staff" variant="secondary" onPress={onAddStaff} />
              </View>
              <View style={styles.gap} />
              <Button title="Add shift" onPress={onAddShift} />
            </>
          )}
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  section: { fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 4 },
  payGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  payCell: { width: '47%' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 10 },
  rowEnd: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  listRow: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1, gap: 2 },
  flex2: { flex: 2 },
  name: { fontSize: 15, fontWeight: '600' },
  muted: { fontSize: 13 },
  gap: { height: 10 },
});
