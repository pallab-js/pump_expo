import { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getDatabase } from '@/db';
import type { Station, Nozzle, FuelType, MeterReading } from '@/db/types';
import { getAccessibleStations } from '@/repositories/profileRepo';
import { listNozzles, listFuelTypes } from '@/repositories/stationRepo';
import { getEffectivePrices } from '@/repositories/priceRepo';
import {
  ensureDayRecord,
  listMeterReadings,
  saveMeterReading,
  readingLitres,
} from '@/repositories/entryRepo';
import { useSessionStore } from '@/stores/sessionStore';
import { useTheme } from '@/theme/useTheme';
import { Screen, Header, Card, Button, Input, Select, Badge, EmptyState } from '@/components';
import { todayISO, formatDisplay, daysAgoISO } from '@/services/dates';

interface NozzleRow {
  nozzle: Nozzle;
  opening: string;
  closing: string;
  test: string;
  price: number;
}

export default function EntryScreen() {
  const t = useTheme();
  const profile = useSessionStore((s) => s.profile);

  const [stations, setStations] = useState<Station[]>([]);
  const [stationId, setStationId] = useState<number | null>(null);
  const [date, setDate] = useState(todayISO());
  const [fuelTypes, setFuelTypes] = useState<FuelType[]>([]);
  const [rows, setRows] = useState<NozzleRow[]>([]);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load accessible stations once focused.
  const loadStations = useCallback(async () => {
    if (!profile) return;
    const db = await getDatabase();
    const list = await getAccessibleStations(db, profile);
    setStations(list);
    setFuelTypes(await listFuelTypes(db));
    if (stationId === null && list.length) setStationId(list[0].id);
  }, [profile, stationId]);

  useFocusEffect(
    useCallback(() => {
      loadStations();
    }, [loadStations])
  );

  // Load nozzles + existing readings for the chosen station/date.
  const loadEntry = useCallback(async () => {
    if (stationId === null) return;
    const db = await getDatabase();
    const nozzles = await listNozzles(db, stationId);
    const prices = await getEffectivePrices(db, stationId, date);
    const dr = await ensureDayRecord(db, stationId, date);
    const existing = await listMeterReadings(db, dr);
    const byNozzle: Record<number, MeterReading> = {};
    for (const r of existing) byNozzle[r.nozzle_id] = r;

    setRows(
      nozzles.map((n) => {
        const r = byNozzle[n.id];
        return {
          nozzle: n,
          opening: r ? String(r.opening) : '',
          closing: r ? String(r.closing) : '',
          test: r && r.test_litres ? String(r.test_litres) : '',
          price: r ? r.price : prices[n.fuel_type_id] ?? 0,
        };
      })
    );
  }, [stationId, date]);

  useFocusEffect(
    useCallback(() => {
      loadEntry();
    }, [loadEntry])
  );

  const fuelCode = (id: number) => fuelTypes.find((f) => f.id === id)?.code ?? '?';

  const updateRow = (nozzleId: number, patch: Partial<NozzleRow>) => {
    setRows((prev) => prev.map((r) => (r.nozzle.id === nozzleId ? { ...r, ...patch } : r)));
  };

  const totals = useMemo(() => {
    let litres = 0;
    let amount = 0;
    for (const r of rows) {
      const o = Number(r.opening) || 0;
      const c = Number(r.closing) || 0;
      const tl = Number(r.test) || 0;
      const l = readingLitres({ opening: o, closing: c, test_litres: tl });
      litres += l;
      amount += l * r.price;
    }
    return { litres, amount };
  }, [rows]);

  const saveAll = async () => {
    if (stationId === null) return;
    setError(null);
    try {
      const db = await getDatabase();
      const dr = await ensureDayRecord(db, stationId, date);
      for (const r of rows) {
        if (r.opening === '' && r.closing === '') continue;
        await saveMeterReading(db, dr, {
          nozzle_id: r.nozzle.id,
          opening: Number(r.opening) || 0,
          closing: Number(r.closing) || 0,
          test_litres: Number(r.test) || 0,
          price: r.price,
        });
      }
      setSavedMsg(`Saved readings for ${formatDisplay(date)}`);
      await loadEntry();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const dateOptions = [
    { label: 'Today', value: todayISO() },
    { label: 'Yesterday', value: daysAgoISO(1) },
    { label: '2 days ago', value: daysAgoISO(2) },
    { label: '3 days ago', value: daysAgoISO(3) },
  ];

  return (
    <Screen>
      <Header title="Daily Entry" subtitle="Meter readings → litres & sales" />

      {stations.length === 0 ? (
        <EmptyState icon="⛽" title="No stations" message="Add a station before recording entries." />
      ) : (
        <>
          <Select
            label="Station"
            options={stations.map((s) => ({ label: s.name, value: s.id }))}
            value={stationId}
            onChange={setStationId}
          />
          <View style={styles.gap} />
          <Select label="Date" options={dateOptions} value={date} onChange={setDate} />

          <View style={styles.gap} />

          {rows.length === 0 ? (
            <EmptyState icon="🔧" title="No nozzles" message="Set up nozzles for this station first." />
          ) : (
            <View style={styles.list}>
              {rows.map((r) => {
                const o = Number(r.opening) || 0;
                const c = Number(r.closing) || 0;
                const tl = Number(r.test) || 0;
                const litres = readingLitres({ opening: o, closing: c, test_litres: tl });
                const amount = litres * r.price;
                return (
                  <Card key={r.nozzle.id}>
                    <View style={styles.rowHead}>
                      <Text style={[styles.nozzleName, { color: t.colors.text }]}>{r.nozzle.label}</Text>
                      <Badge label={`${fuelCode(r.nozzle.fuel_type_id)} · ₹${r.price}`} tone="primary" />
                    </View>
                    <View style={styles.inputs}>
                      <View style={styles.flex}>
                        <Input label="Opening" value={r.opening} keyboardType="numeric" onChangeText={(v) => updateRow(r.nozzle.id, { opening: v.replace(/[^0-9.]/g, '') })} />
                      </View>
                      <View style={styles.flex}>
                        <Input label="Closing" value={r.closing} keyboardType="numeric" onChangeText={(v) => updateRow(r.nozzle.id, { closing: v.replace(/[^0-9.]/g, '') })} />
                      </View>
                      <View style={styles.flex}>
                        <Input label="Test (L)" value={r.test} keyboardType="numeric" onChangeText={(v) => updateRow(r.nozzle.id, { test: v.replace(/[^0-9.]/g, '') })} />
                      </View>
                    </View>
                    <View style={styles.computed}>
                      <Text style={[styles.muted, { color: t.colors.textMuted }]}>
                        {litres.toFixed(2)} L
                      </Text>
                      <Text style={[styles.amount, { color: t.colors.accent }]}>₹{amount.toFixed(2)}</Text>
                    </View>
                  </Card>
                );
              })}
            </View>
          )}

          {rows.length > 0 ? (
            <>
              <View style={styles.gap} />
              <Card style={styles.totalCard}>
                <Text style={[styles.totalLabel, { color: t.colors.textMuted }]}>Day total</Text>
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLitres, { color: t.colors.text }]}>{totals.litres.toFixed(2)} L</Text>
                  <Text style={[styles.totalAmount, { color: t.colors.primary }]}>₹{totals.amount.toFixed(2)}</Text>
                </View>
              </Card>
              <View style={styles.gap} />
              <Button title="Save readings" onPress={saveAll} />
              {savedMsg ? <Text style={[styles.saved, { color: t.colors.success }]}>{savedMsg}</Text> : null}
              {error ? <Text style={[styles.err, { color: t.colors.danger }]}>{error}</Text> : null}
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { height: 12 },
  list: { gap: 12 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  nozzleName: { fontSize: 16, fontWeight: '700' },
  inputs: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  computed: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  muted: { fontSize: 14, fontWeight: '600' },
  amount: { fontSize: 16, fontWeight: '700' },
  totalCard: { backgroundColor: undefined },
  totalLabel: { fontSize: 13, fontWeight: '500' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, alignItems: 'center' },
  totalLitres: { fontSize: 20, fontWeight: '700' },
  totalAmount: { fontSize: 22, fontWeight: '800' },
  saved: { marginTop: 10, fontWeight: '600' },
  err: { marginTop: 10, fontWeight: '600' },
});
