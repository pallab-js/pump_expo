import { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getDatabase } from '@/db';
import type { Station } from '@/db/types';
import { getAccessibleStations } from '@/repositories/profileRepo';
import {
  getTotals,
  getFuelMix,
  getPaymentMix,
  getStationComparison,
  type KpiTotals,
  type FuelMixSlice,
  type PaymentMixSlice,
  type StationComparisonRow,
} from '@/services/aggregation';
import { useFilterStore } from '@/stores/filterStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useTheme } from '@/theme/useTheme';
import { Screen, Header, Card, Select, Badge, EmptyState , Spacer } from '@/components';
import { money, litresFmt } from '@/services/charts';
import { formatDisplay } from '@/services/dates';

export default function ReportsScreen() {
  const t = useTheme();
  const profile = useSessionStore((s) => s.profile);
  const { preset, start, end, setPreset } = useFilterStore();

  const [stations, setStations] = useState<Station[]>([]);
  const [stationFilter, setStationFilter] = useState<number | 'all'>('all');
  const [totals, setTotals] = useState<KpiTotals | null>(null);
  const [fuelMix, setFuelMix] = useState<FuelMixSlice[]>([]);
  const [payMix, setPayMix] = useState<PaymentMixSlice[]>([]);
  const [comparison, setComparison] = useState<StationComparisonRow[]>([]);
  const [fuelFilter, setFuelFilter] = useState<number | 'all'>('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    const db = await getDatabase();
    const accessible = await getAccessibleStations(db, profile);
    setStations(accessible);

    const allIds = accessible.map((s) => s.id);
    const scopeIds =
      stationFilter === 'all' ? (profile.role === 'owner' ? undefined : allIds) : [stationFilter];
    const opts = scopeIds ? { stationIds: scopeIds } : undefined;
    const range = { start, end };

    setTotals(await getTotals(db, range, opts));
    setFuelMix(await getFuelMix(db, range, opts));
    setPayMix(await getPaymentMix(db, range, opts));
    setComparison(await getStationComparison(db, range, opts));
    setLoading(false);
  }, [profile, start, end, stationFilter]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const shownFuel = fuelFilter === 'all' ? fuelMix : fuelMix.filter((f) => f.fuelTypeId === fuelFilter);
  const line = (label: string, value: string, color?: string) => (
    <View style={styles.line}>
      <Text style={[styles.key, { color: t.colors.textMuted }]}>{label}</Text>
      <Text style={[styles.val, { color: color ?? t.colors.text }]}>{value}</Text>
    </View>
  );

  if (stations.length === 0 && !loading) {
    return (
      <Screen onRefresh={load}>
        <Header title="Reports" subtitle="Filterable summaries" />
        <EmptyState icon="📈" title="No data" message="Add stations and record entries to see reports." />
      </Screen>
    );
  }

  return (
    <Screen loading={loading} onRefresh={load}>
      <Header title="Reports" subtitle={`${formatDisplay(start)} → ${formatDisplay(end)}`} />

      <Select
        label="Date range"
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
      <Select<number | 'all'>
        label="Station"
        options={[{ label: 'All', value: 'all' }, ...stations.map((s) => ({ label: s.name, value: s.id }))]}
        value={stationFilter}
        onChange={setStationFilter}
      />
      <Spacer />
      <Select<number | 'all'>
        label="Fuel type"
        options={[{ label: 'All', value: 'all' }, ...fuelMix.map((f) => ({ label: f.code, value: f.fuelTypeId }))]}
        value={fuelFilter}
        onChange={setFuelFilter}
      />

      <Spacer />
      <Card>
        <Text style={[styles.h, { color: t.colors.text }]}>Summary</Text>
        {line('Revenue', money(totals?.totalRevenue ?? 0), t.colors.primary)}
        {line('Volume', litresFmt(totals?.totalLitres ?? 0))}
        {line('Payments', money(totals?.totalPayments ?? 0))}
        {line('Expenses', money(totals?.totalExpenses ?? 0), t.colors.danger)}
        {line('Active days', String(totals?.activeDays ?? 0))}
      </Card>

      <Spacer />
      <Card>
        <Text style={[styles.h, { color: t.colors.text }]}>By fuel type</Text>
        {shownFuel.length === 0 ? (
          <Text style={[styles.muted, { color: t.colors.textMuted }]}>No sales in range.</Text>
        ) : (
          shownFuel.map((f) => (
            <View key={f.fuelTypeId} style={styles.fuelRow}>
              <Badge label={f.code} tone="primary" dotColor={f.color} />
              <Text style={[styles.val, { color: t.colors.text }]}>
                {litresFmt(f.litres)} · {money(f.revenue)}
              </Text>
            </View>
          ))
        )}
      </Card>

      <Spacer />
      <Card>
        <Text style={[styles.h, { color: t.colors.text }]}>By payment method</Text>
        {payMix.length === 0 ? (
          <Text style={[styles.muted, { color: t.colors.textMuted }]}>No payments in range.</Text>
        ) : (
          payMix.map((p) => line(p.method.toUpperCase(), money(p.amount)))
        )}
      </Card>

      {stationFilter === 'all' && comparison.length > 1 ? (
        <>
          <Spacer />
          <Card>
            <Text style={[styles.h, { color: t.colors.text }]}>By station</Text>
            {comparison.map((c) => line(c.name, `${litresFmt(c.litres)} · ${money(c.revenue)}`))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { height: 12 },
  h: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  key: { fontSize: 14 },
  val: { fontSize: 14, fontWeight: '600' },
  muted: { fontSize: 13, paddingVertical: 6 },
  fuelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
});
