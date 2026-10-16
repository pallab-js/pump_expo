import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { LineChart, PieChart, BarChart } from 'react-native-gifted-charts';
import { getDatabase } from '@/db';
import { getAccessibleStations } from '@/repositories/profileRepo';
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
import { useSessionStore } from '@/stores/sessionStore';
import { useTheme } from '@/theme/useTheme';
import { Screen, Header, Card, KPIStat, Select, Badge, EmptyState , Spacer } from '@/components';
import {
  money,
  litresFmt,
  toLineData,
  toFuelPie,
  toPaymentPie,
  toComparisonBars,
  stockFillRatio,
} from '@/services/charts';

export default function DashboardScreen() {
  const t = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const profile = useSessionStore((s) => s.profile);
  const { preset, start, end, setPreset } = useFilterStore();

  const [stationIds, setStationIds] = useState<number[] | undefined>(undefined);
  const [totals, setTotals] = useState<KpiTotals | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [fuelMix, setFuelMix] = useState<FuelMixSlice[]>([]);
  const [payMix, setPayMix] = useState<PaymentMixSlice[]>([]);
  const [comparison, setComparison] = useState<StationComparisonRow[]>([]);
  const [stock, setStock] = useState<StockLevelRow[]>([]);
  const [hasStations, setHasStations] = useState(true);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    const db = await getDatabase();
    // Scope staff to their stations; owner sees all.
    const accessible = await getAccessibleStations(db, profile);
    setHasStations(accessible.length > 0);
    const ids = profile.role === 'owner' ? undefined : accessible.map((s) => s.id);
    setStationIds(ids);

    const range = { start, end };
    const opts = ids ? { stationIds: ids } : undefined;
    setTotals(await getTotals(db, range, opts));
    setTrend(await getSalesTrend(db, range, opts));
    setFuelMix(await getFuelMix(db, range, opts));
    setPayMix(await getPaymentMix(db, range, opts));
    setComparison(await getStationComparison(db, range, opts));
    setStock(await getStockLevels(db, end, opts));
    setLoading(false);
  }, [profile, start, end]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const chartWidth = width - 32 - 32; // screen padding + card padding
  const paymentPalette = [t.colors.chart1, t.colors.chart2, t.colors.chart3, t.colors.chart4];
  const lowCount = stock.filter((s) => s.isLow).length;

  // Chart data mappers
  const lineData = toLineData(trend);
  const fuelPie = toFuelPie(fuelMix);
  const payPie = toPaymentPie(payMix, paymentPalette);
  const barData = toComparisonBars(comparison, paymentPalette);

  if (!hasStations && !loading) {
    return (
      <Screen onRefresh={load}>
        <Header title="Dashboard" subtitle="Central overview" />
        <EmptyState
          icon="⛽"
          title="Welcome to FuelPump Manager"
          message="Add your first station to start seeing KPIs and charts."
          actionLabel="Go to Stations"
          onAction={() => router.push('/stations')}
        />
      </Screen>
    );
  }

  return (
    <Screen loading={loading} onRefresh={load}>
      <Header title="Dashboard" subtitle={profile?.role === 'owner' ? 'All outlets' : 'Your outlets'} />

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

      {/* KPI cards */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCell}>
          <KPIStat label="Revenue" value={money(totals?.totalRevenue ?? 0)} sublabel={`${totals?.activeDays ?? 0} active days`} icon="cash-outline" />
        </View>
        <View style={styles.kpiCell}>
          <KPIStat label="Volume" value={litresFmt(totals?.totalLitres ?? 0)} accent={t.colors.accent} icon="water-outline" />
        </View>
      </View>
      <Spacer />
      <View style={styles.kpiRow}>
        <View style={styles.kpiCell}>
          <KPIStat label="Payments" value={money(totals?.totalPayments ?? 0)} icon="card-outline" />
        </View>
        <View style={styles.kpiCell}>
          <KPIStat label="Expenses" value={money(totals?.totalExpenses ?? 0)} accent={t.colors.danger} icon="receipt-outline" />
        </View>
      </View>

      <Spacer />

      {/* Sales trend */}
      <Card>
        <Text style={[styles.chartTitle, { color: t.colors.text }]}>Revenue trend</Text>
        {lineData.length > 1 ? (
          <LineChart
            data={lineData}
            width={chartWidth - 20}
            height={180}
            thickness={3}
            color={t.colors.primary}
            dataPointsColor={t.colors.primary}
            startFillColor={t.colors.primary}
            endFillColor={t.colors.surface}
            areaChart
            startOpacity={0.3}
            endOpacity={0.02}
            yAxisTextStyle={{ color: t.colors.textMuted, fontSize: 10 }}
            xAxisLabelTextStyle={{ color: t.colors.textMuted, fontSize: 9 }}
            rulesColor={t.colors.border}
            yAxisColor={t.colors.border}
            xAxisColor={t.colors.border}
            noOfSections={4}
          />
        ) : (
          <Text style={[styles.muted, { color: t.colors.textMuted }]}>
            Not enough data to plot a trend yet.
          </Text>
        )}
      </Card>

      <Spacer />

      {/* Fuel mix + Payment mix */}
      <View style={styles.pieRow}>
        <Card style={styles.pieCard}>
          <Text style={[styles.chartTitle, { color: t.colors.text }]}>Fuel mix</Text>
          {fuelPie.length ? (
            <View style={styles.pieWrap}>
              <PieChart data={fuelPie} donut radius={64} innerRadius={38} innerCircleColor={t.colors.surface} />
              <View style={styles.legend}>
                {fuelMix.map((f) => (
                  <View key={f.fuelTypeId} style={styles.legendRow}>
                    <View style={[styles.dot, { backgroundColor: f.color }]} />
                    <Text style={[styles.legendText, { color: t.colors.textMuted }]}>{f.code}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <Text style={[styles.muted, { color: t.colors.textMuted }]}>No sales.</Text>
          )}
        </Card>

        <Card style={styles.pieCard}>
          <Text style={[styles.chartTitle, { color: t.colors.text }]}>Payment mix</Text>
          {payPie.length ? (
            <View style={styles.pieWrap}>
              <PieChart data={payPie} donut radius={64} innerRadius={38} innerCircleColor={t.colors.surface} />
              <View style={styles.legend}>
                {payMix.map((p, i) => (
                  <View key={p.method} style={styles.legendRow}>
                    <View style={[styles.dot, { backgroundColor: paymentPalette[i % paymentPalette.length] }]} />
                    <Text style={[styles.legendText, { color: t.colors.textMuted }]}>{p.method}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <Text style={[styles.muted, { color: t.colors.textMuted }]}>No payments.</Text>
          )}
        </Card>
      </View>

      <Spacer />

      {/* Station comparison */}
      {comparison.length > 0 ? (
        <Card>
          <Text style={[styles.chartTitle, { color: t.colors.text }]}>Station comparison (revenue)</Text>
          <BarChart
            data={barData}
            width={chartWidth - 20}
            height={160}
            barWidth={28}
            spacing={24}
            frontColor={t.colors.primary}
            yAxisTextStyle={{ color: t.colors.textMuted, fontSize: 10 }}
            xAxisLabelTextStyle={{ color: t.colors.textMuted, fontSize: 9 }}
            rulesColor={t.colors.border}
            yAxisColor={t.colors.border}
            xAxisColor={t.colors.border}
            noOfSections={4}
          />
        </Card>
      ) : null}

      <Spacer />

      {/* Stock levels */}
      <Card>
        <View style={styles.stockHead}>
          <Text style={[styles.chartTitle, { color: t.colors.text }]}>Stock levels</Text>
          {lowCount > 0 ? <Badge label={`${lowCount} low`} tone="danger" /> : <Badge label="All OK" tone="success" />}
        </View>
        {stock.length === 0 ? (
          <Text style={[styles.muted, { color: t.colors.textMuted }]}>No tanks configured.</Text>
        ) : (
          stock.map((s) => {
            const pct = stockFillRatio(s.balance, s.capacity);
            return (
              <View key={s.tankId} style={styles.stockRow}>
                <View style={styles.stockInfo}>
                  <Text style={[styles.stockLabel, { color: t.colors.text }]}>
                    {s.stationName} · {s.label}
                  </Text>
                  <Text style={[styles.muted, { color: s.isLow ? t.colors.danger : t.colors.textMuted }]}>
                    {s.fuelCode} · {s.balance.toFixed(0)}/{s.capacity.toFixed(0)}
                    {s.isLow ? ' ⚠' : ''}
                  </Text>
                </View>
                <View style={[styles.barTrack, { backgroundColor: t.colors.surfaceAlt }]}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${pct * 100}%`, backgroundColor: s.isLow ? t.colors.danger : t.colors.accent },
                    ]}
                  />
                </View>
              </View>
            );
          })
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { height: 12 },
  kpiRow: { flexDirection: 'row', gap: 12 },
  kpiCell: { flex: 1 },
  chartTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  muted: { fontSize: 13, paddingVertical: 8 },
  pieRow: { flexDirection: 'row', gap: 12 },
  pieCard: { flex: 1, alignItems: 'flex-start' },
  pieWrap: { alignItems: 'center', gap: 10, alignSelf: 'center' },
  legend: { gap: 4 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12 },
  stockHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  stockRow: { marginBottom: 12, gap: 6 },
  stockInfo: { flexDirection: 'row', justifyContent: 'space-between' },
  stockLabel: { fontSize: 14, fontWeight: '600' },
  barTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
});
