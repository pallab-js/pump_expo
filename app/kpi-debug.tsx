import { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect, Stack } from 'expo-router';
import { getDatabase } from '@/db';
import {
  getTotals,
  getSalesTrend,
  getFuelMix,
  getPaymentMix,
  getStationComparison,
  getStockLevels,
  type KpiTotals,
  type TrendPoint,
  type FuelMixSlice,
  type PaymentMixSlice,
  type StationComparisonRow,
  type StockLevelRow,
} from '@/services/aggregation';
import { useFilterStore } from '@/stores/filterStore';
import { useTheme } from '@/theme/useTheme';
import { Screen, Header, Card, Select , Spacer } from '@/components';
import { formatDisplay } from '@/services/dates';

export default function KpiDebugScreen() {
  const t = useTheme();
  const { preset, start, end, setPreset } = useFilterStore();

  const [totals, setTotals] = useState<KpiTotals | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [fuelMix, setFuelMix] = useState<FuelMixSlice[]>([]);
  const [payMix, setPayMix] = useState<PaymentMixSlice[]>([]);
  const [comparison, setComparison] = useState<StationComparisonRow[]>([]);
  const [stock, setStock] = useState<StockLevelRow[]>([]);

  const load = useCallback(async () => {
    const db = await getDatabase();
    const range = { start, end };
    setTotals(await getTotals(db, range));
    setTrend(await getSalesTrend(db, range));
    setFuelMix(await getFuelMix(db, range));
    setPayMix(await getPaymentMix(db, range));
    setComparison(await getStationComparison(db, range));
    setStock(await getStockLevels(db, end));
  }, [start, end]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const line = (key: string, label: string, value: string) => (
    <View key={key} style={styles.line}>
      <Text style={[styles.key, { color: t.colors.textMuted }]}>{label}</Text>
      <Text style={[styles.val, { color: t.colors.text }]}>{value}</Text>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: 'KPI Debug' }} />
      <Screen>
        <Header title="KPI Debug" subtitle={`${formatDisplay(start)} → ${formatDisplay(end)}`} />

        <Select
          label="Range"
          options={[
            { label: 'Today', value: 'today' },
            { label: '7 days', value: '7d' },
            { label: '30 days', value: '30d' },
            { label: 'This month', value: 'month' },
          ]}
          value={preset}
          onChange={setPreset}
        />

        <Spacer />
        <Card>
          <Text style={[styles.h, { color: t.colors.text }]}>Totals</Text>
          {totals ? (
            <>
              {line('rev', 'Revenue', `₹${totals.totalRevenue.toFixed(2)}`)}
              {line('lit', 'Litres', totals.totalLitres.toFixed(2))}
              {line('pay', 'Payments', `₹${totals.totalPayments.toFixed(2)}`)}
              {line('exp', 'Expenses', `₹${totals.totalExpenses.toFixed(2)}`)}
              {line('days', 'Active days', String(totals.activeDays))}
            </>
          ) : null}
        </Card>

        <Spacer />
        <Card>
          <Text style={[styles.h, { color: t.colors.text }]}>Sales trend ({trend.length})</Text>
          {trend.map((p) => line(`tr-${p.date}`, formatDisplay(p.date), `${p.litres.toFixed(0)} L · ₹${p.revenue.toFixed(0)}`))}
        </Card>

        <Spacer />
        <Card>
          <Text style={[styles.h, { color: t.colors.text }]}>Fuel mix</Text>
          {fuelMix.map((f) => line(`fm-${f.fuelTypeId}`, f.code, `${f.litres.toFixed(0)} L · ₹${f.revenue.toFixed(0)}`))}
        </Card>

        <Spacer />
        <Card>
          <Text style={[styles.h, { color: t.colors.text }]}>Payment mix</Text>
          {payMix.map((p) => line(`pm-${p.method}`, p.method, `₹${p.amount.toFixed(0)}`))}
        </Card>

        <Spacer />
        <Card>
          <Text style={[styles.h, { color: t.colors.text }]}>Station comparison</Text>
          {comparison.map((c) => line(`cmp-${c.stationId}`, c.name, `${c.litres.toFixed(0)} L · ₹${c.revenue.toFixed(0)}`))}
        </Card>

        <Spacer />
        <Card>
          <Text style={[styles.h, { color: t.colors.text }]}>Stock levels</Text>
          {stock.map((s) =>
            line(`stk-${s.tankId}`, `${s.stationName} · ${s.label} (${s.fuelCode})`, `${s.balance.toFixed(0)}${s.isLow ? ' ⚠ LOW' : ''}`)
          )}
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  gap: { height: 12 },
  h: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  key: { fontSize: 14 },
  val: { fontSize: 14, fontWeight: '600' },
});
