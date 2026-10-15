import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useFocusEffect, useLocalSearchParams, Stack } from 'expo-router';
import { getDatabase } from '@/db';
import type { Station, Tank, Nozzle, FuelType } from '@/db/types';
import {
  getStation,
  listFuelTypes,
  listTanks,
  createTank,
  deleteTank,
  listNozzles,
  createNozzle,
  deleteNozzle,
} from '@/repositories/stationRepo';
import { useSessionStore } from '@/stores/sessionStore';
import { useTheme } from '@/theme/useTheme';
import { Screen, Header, Card, Button, Input, Select, Badge, EmptyState } from '@/components';

export default function StationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const stationId = Number(id);
  const t = useTheme();
  const isOwner = useSessionStore((s) => s.profile?.role === 'owner');

  const [station, setStation] = useState<Station | null>(null);
  const [fuelTypes, setFuelTypes] = useState<FuelType[]>([]);
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [nozzles, setNozzles] = useState<Nozzle[]>([]);

  // tank form
  const [tankLabel, setTankLabel] = useState('');
  const [tankFuel, setTankFuel] = useState<number | null>(null);
  const [tankCap, setTankCap] = useState('');
  const [tankLow, setTankLow] = useState('');

  // nozzle form
  const [nozzleLabel, setNozzleLabel] = useState('');
  const [nozzleFuel, setNozzleFuel] = useState<number | null>(null);
  const [nozzleTank, setNozzleTank] = useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const db = await getDatabase();
    setStation(await getStation(db, stationId));
    const fts = await listFuelTypes(db);
    setFuelTypes(fts);
    setTanks(await listTanks(db, stationId));
    setNozzles(await listNozzles(db, stationId));
    if (tankFuel === null && fts.length) setTankFuel(fts[0].id);
    if (nozzleFuel === null && fts.length) setNozzleFuel(fts[0].id);
  }, [stationId, tankFuel, nozzleFuel]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const fuelLabel = (ftId: number) => fuelTypes.find((f) => f.id === ftId)?.code ?? '?';
  const fuelOptions = fuelTypes.map((f) => ({ label: f.code, value: f.id }));

  const addTank = async () => {
    setError(null);
    if (!tankLabel.trim()) return setError('Tank label required.');
    if (tankFuel === null) return setError('Pick a fuel type.');
    try {
      const db = await getDatabase();
      await createTank(db, {
        station_id: stationId,
        fuel_type_id: tankFuel,
        label: tankLabel.trim(),
        capacity: Number(tankCap) || 0,
        low_threshold: Number(tankLow) || 0,
      });
      setTankLabel('');
      setTankCap('');
      setTankLow('');
      await load();
    } catch (e) {
      setError(String(e));
    }
  };

  const addNozzle = async () => {
    setError(null);
    if (!nozzleLabel.trim()) return setError('Nozzle label required.');
    if (nozzleFuel === null) return setError('Pick a fuel type.');
    try {
      const db = await getDatabase();
      await createNozzle(db, {
        station_id: stationId,
        fuel_type_id: nozzleFuel,
        label: nozzleLabel.trim(),
        tank_id: nozzleTank,
      });
      setNozzleLabel('');
      setNozzleTank(null);
      await load();
    } catch (e) {
      setError(String(e));
    }
  };

  const removeTank = (tk: Tank) => {
    Alert.alert('Delete tank', `Delete "${tk.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const db = await getDatabase();
          await deleteTank(db, tk.id);
          await load();
        },
      },
    ]);
  };

  const removeNozzle = (nz: Nozzle) => {
    Alert.alert('Delete nozzle', `Delete "${nz.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const db = await getDatabase();
          await deleteNozzle(db, nz.id);
          await load();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: station?.name ?? 'Station' }} />
      <Screen>
        <Header title={station?.name ?? 'Station'} subtitle={station?.location ?? undefined} />

        {/* Tanks */}
        <Text style={[styles.section, { color: t.colors.text }]}>Tanks</Text>
        {tanks.length === 0 ? (
          <EmptyState icon="🛢️" title="No tanks" message="Add a storage tank below." />
        ) : (
          <View style={styles.list}>
            {tanks.map((tk) => (
              <Card key={tk.id} style={styles.row}>
                <View style={styles.flex}>
                  <Text style={[styles.name, { color: t.colors.text }]}>{tk.label}</Text>
                  <View style={styles.badges}>
                    <Badge label={fuelLabel(tk.fuel_type_id)} tone="primary" />
                    <Badge label={`Cap ${tk.capacity}`} tone="default" />
                    <Badge label={`Low < ${tk.low_threshold}`} tone="warning" />
                  </View>
                </View>
                {isOwner ? <Button title="Delete" variant="danger" onPress={() => removeTank(tk)} /> : null}
              </Card>
            ))}
          </View>
        )}

        {isOwner ? (
          <Card style={styles.form}>
            <Text style={[styles.formTitle, { color: t.colors.text }]}>Add tank</Text>
            <View style={styles.gap} />
            <Input label="Label" value={tankLabel} onChangeText={setTankLabel} placeholder="e.g. Tank 1" />
            <View style={styles.gap} />
            <Select label="Fuel type" options={fuelOptions} value={tankFuel} onChange={setTankFuel} />
            <View style={styles.gap} />
            <View style={styles.rowInputs}>
              <View style={styles.flex}>
                <Input label="Capacity" value={tankCap} onChangeText={(v) => setTankCap(v.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="10000" />
              </View>
              <View style={styles.flex}>
                <Input label="Low alert" value={tankLow} onChangeText={(v) => setTankLow(v.replace(/[^0-9.]/g, ''))} keyboardType="numeric" placeholder="1500" />
              </View>
            </View>
            <View style={styles.gap} />
            <Button title="Add tank" onPress={addTank} />
          </Card>
        ) : null}

        <View style={styles.bigGap} />

        {/* Nozzles */}
        <Text style={[styles.section, { color: t.colors.text }]}>Nozzles</Text>
        {nozzles.length === 0 ? (
          <EmptyState icon="⛽" title="No nozzles" message="Add dispensing nozzles below." />
        ) : (
          <View style={styles.list}>
            {nozzles.map((nz) => (
              <Card key={nz.id} style={styles.row}>
                <View style={styles.flex}>
                  <Text style={[styles.name, { color: t.colors.text }]}>{nz.label}</Text>
                  <View style={styles.badges}>
                    <Badge label={fuelLabel(nz.fuel_type_id)} tone="primary" />
                    {nz.tank_id ? (
                      <Badge label={`→ ${tanks.find((x) => x.id === nz.tank_id)?.label ?? 'tank'}`} tone="default" />
                    ) : null}
                  </View>
                </View>
                {isOwner ? <Button title="Delete" variant="danger" onPress={() => removeNozzle(nz)} /> : null}
              </Card>
            ))}
          </View>
        )}

        {isOwner ? (
          <Card style={styles.form}>
            <Text style={[styles.formTitle, { color: t.colors.text }]}>Add nozzle</Text>
            <View style={styles.gap} />
            <Input label="Label" value={nozzleLabel} onChangeText={setNozzleLabel} placeholder="e.g. Nozzle A1" />
            <View style={styles.gap} />
            <Select label="Fuel type" options={fuelOptions} value={nozzleFuel} onChange={setNozzleFuel} />
            <View style={styles.gap} />
            {tanks.length > 0 ? (
              <Select
                label="Linked tank (optional)"
                options={tanks.map((tk) => ({ label: tk.label, value: tk.id }))}
                value={nozzleTank}
                onChange={setNozzleTank}
              />
            ) : null}
            <View style={styles.gap} />
            <Button title="Add nozzle" onPress={addNozzle} />
          </Card>
        ) : null}

        {error ? <Text style={[styles.err, { color: t.colors.danger }]}>{error}</Text> : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  list: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, gap: 4 },
  name: { fontSize: 16, fontWeight: '600' },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  form: { marginTop: 12 },
  formTitle: { fontSize: 15, fontWeight: '600' },
  gap: { height: 10 },
  bigGap: { height: 24 },
  rowInputs: { flexDirection: 'row', gap: 12 },
  err: { marginTop: 12, fontWeight: '600', textAlign: 'center' },
});
