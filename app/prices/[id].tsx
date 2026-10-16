import { useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect, useLocalSearchParams, Stack } from 'expo-router';
import { getDatabase } from '@/db';
import type { FuelType, FuelPrice, Station } from '@/db/types';
import { getStation, listFuelTypes } from '@/repositories/stationRepo';
import { setPrice, listPrices, getEffectivePrices } from '@/repositories/priceRepo';
import { useSessionStore } from '@/stores/sessionStore';
import { useTheme } from '@/theme/useTheme';
import { Screen, Header, Card, Button, Input, Badge , Spacer } from '@/components';
import { todayISO, formatDisplay } from '@/services/dates';

export default function PricesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const stationId = Number(id);
  const t = useTheme();
  const isOwner = useSessionStore((s) => s.profile?.role === 'owner');

  const [station, setStation] = useState<Station | null>(null);
  const [fuelTypes, setFuelTypes] = useState<FuelType[]>([]);
  const [current, setCurrent] = useState<Record<number, number>>({});
  const [history, setHistory] = useState<FuelPrice[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [date] = useState(todayISO());
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const db = await getDatabase();
    setStation(await getStation(db, stationId));
    const fts = await listFuelTypes(db);
    setFuelTypes(fts);
    setCurrent(await getEffectivePrices(db, stationId, date));
    setHistory(await listPrices(db, stationId));
  }, [stationId, date]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const saveFuel = async (ft: FuelType) => {
    const raw = drafts[ft.id];
    if (raw === undefined || raw === '') return;
    const price = Number(raw);
    if (!Number.isFinite(price) || price < 0) return;
    const db = await getDatabase();
    await setPrice(db, { station_id: stationId, fuel_type_id: ft.id, price, effective_date: date });
    setDrafts((d) => ({ ...d, [ft.id]: '' }));
    setSavedMsg(`${ft.code} price set to ${price} for ${formatDisplay(date)}`);
    await load();
  };

  const codeOf = (ftId: number) => fuelTypes.find((f) => f.id === ftId)?.code ?? '?';

  return (
    <>
      <Stack.Screen options={{ title: 'Fuel Prices' }} />
      <Screen>
        <Header title="Fuel Prices" subtitle={`${station?.name ?? ''} · ${formatDisplay(date)}`} />

        <View style={styles.list}>
          {fuelTypes.map((ft) => (
            <Card key={ft.id}>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Text style={[styles.code, { color: t.colors.text }]}>{ft.name}</Text>
                  <Badge
                    label={current[ft.id] != null ? `Current: ₹${current[ft.id]}/${ft.unit}` : 'No price set'}
                    tone={current[ft.id] != null ? 'success' : 'warning'}
                    dotColor={ft.color}
                  />
                </View>
              </View>
              {isOwner ? (
                <View style={styles.editRow}>
                  <View style={styles.flex}>
                    <Input
                      label={`New price (per ${ft.unit})`}
                      value={drafts[ft.id] ?? ''}
                      onChangeText={(v) => setDrafts((d) => ({ ...d, [ft.id]: v.replace(/[^0-9.]/g, '') }))}
                      keyboardType="numeric"
                      placeholder="e.g. 104.50"
                    />
                  </View>
                  <View style={styles.saveBtn}>
                    <Button title="Set" onPress={() => saveFuel(ft)} />
                  </View>
                </View>
              ) : null}
            </Card>
          ))}
        </View>

        {savedMsg ? <Text style={[styles.saved, { color: t.colors.success }]}>{savedMsg}</Text> : null}

        <Spacer />
        <Text style={[styles.section, { color: t.colors.text }]}>Price history</Text>
        {history.length === 0 ? (
          <Text style={[styles.muted, { color: t.colors.textMuted }]}>No price changes recorded yet.</Text>
        ) : (
          <View style={styles.list}>
            {history.map((h) => (
              <Card key={h.id} style={styles.histRow}>
                <Badge label={codeOf(h.fuel_type_id)} tone="primary" />
                <Text style={[styles.histPrice, { color: t.colors.text }]}>₹{h.price}</Text>
                <Text style={[styles.muted, { color: t.colors.textMuted }]}>{formatDisplay(h.effective_date)}</Text>
              </Card>
            ))}
          </View>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1, gap: 6 },
  code: { fontSize: 16, fontWeight: '600' },
  editRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 10 },
  saveBtn: { width: 84 },
  saved: { marginTop: 12, fontWeight: '600' },
  gap: { height: 20 },
  section: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  muted: { fontSize: 13 },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  histPrice: { fontSize: 16, fontWeight: '700', flex: 1 },
});
