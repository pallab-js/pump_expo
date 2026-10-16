import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Alert, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { getDatabase } from '@/db';
import type { Station } from '@/db/types';
import {
  createStation,
  updateStation,
  deleteStation,
  stationCounts,
} from '@/repositories/stationRepo';
import { getAccessibleStations } from '@/repositories/profileRepo';
import { useSessionStore } from '@/stores/sessionStore';
import { useTheme } from '@/theme/useTheme';
import { Screen, Header, Card, Button, Input, Badge, EmptyState } from '@/components';

interface Row extends Station {
  tanks: number;
  nozzles: number;
}

export default function StationsScreen() {
  const t = useTheme();
  const router = useRouter();
  const profile = useSessionStore((s) => s.profile);
  const isOwner = profile?.role === 'owner';

  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState<Station | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    const db = await getDatabase();
    const stations = await getAccessibleStations(db, profile);
    const withCounts: Row[] = [];
    for (const s of stations) {
      const c = await stationCounts(db, s.id);
      withCounts.push({ ...s, tanks: c.tanks, nozzles: c.nozzles });
    }
    setRows(withCounts);
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openAdd = () => {
    setEditing(null);
    setName('');
    setLocation('');
    setCode('');
    setError(null);
    setShowForm(true);
  };

  const openEdit = (s: Station) => {
    setEditing(s);
    setName(s.name);
    setLocation(s.location ?? '');
    setCode(s.code ?? '');
    setError(null);
    setShowForm(true);
  };

  const onSave = async () => {
    setError(null);
    if (name.trim().length < 2) return setError('Enter a station name.');
    setBusy(true);
    try {
      const db = await getDatabase();
      if (editing) {
        await updateStation(db, editing.id, {
          name,
          location: location || null,
          code: code || null,
          active: editing.active === 1,
        });
      } else {
        await createStation(db, { name, location: location || null, code: code || null });
      }
      setShowForm(false);
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = (s: Station) => {
    Alert.alert('Delete station', `Delete "${s.name}" and all its data?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const db = await getDatabase();
          await deleteStation(db, s.id);
          await load();
        },
      },
    ]);
  };

  return (
    <Screen loading={loading} onRefresh={load}>
      <Header
        title="Stations"
        subtitle={isOwner ? 'All outlets' : 'Your assigned outlets'}
        right={isOwner ? <Button title="+ Add" onPress={openAdd} /> : undefined}
      />

      {showForm ? (
        <Card>
          <Text style={[styles.formTitle, { color: t.colors.text }]}>
            {editing ? 'Edit station' : 'New station'}
          </Text>
          <View style={styles.gap} />
          <Input label="Name" value={name} onChangeText={setName} placeholder="e.g. Highway Pump" />
          <View style={styles.gap} />
          <Input label="Location" value={location} onChangeText={setLocation} placeholder="e.g. NH-48, Km 23" />
          <View style={styles.gap} />
          <Input label="Code (optional)" value={code} onChangeText={setCode} placeholder="e.g. HP-01" error={error} />
          <View style={styles.gap} />
          <View style={styles.formActions}>
            <Button title="Cancel" variant="ghost" onPress={() => setShowForm(false)} />
            <Button title={editing ? 'Save' : 'Create'} onPress={onSave} loading={busy} />
          </View>
        </Card>
      ) : null}

      <View style={styles.gap} />

      {rows.length === 0 && !showForm ? (
        <EmptyState
          icon="⛽"
          title="No stations yet"
          message={isOwner ? 'Add your first outlet to get started.' : 'No stations assigned to you yet.'}
          actionLabel={isOwner ? 'Add Station' : undefined}
          onAction={isOwner ? openAdd : undefined}
        />
      ) : (
        <View style={styles.list}>
          {rows.map((s) => (
            <Card key={s.id}>
              <Pressable onPress={() => router.push(`/station/${s.id}`)}>
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <Text style={[styles.name, { color: t.colors.text }]}>{s.name}</Text>
                    {s.location ? (
                      <Text style={[styles.loc, { color: t.colors.textMuted }]}>{s.location}</Text>
                    ) : null}
                    <View style={styles.badges}>
                      <Badge label={`${s.tanks} tank(s)`} tone="primary" />
                      <Badge label={`${s.nozzles} nozzle(s)`} tone="success" />
                      {s.active === 0 ? <Badge label="Inactive" tone="danger" /> : null}
                    </View>
                  </View>
                  <Text style={[styles.chevron, { color: t.colors.textMuted }]}>›</Text>
                </View>
              </Pressable>
              {isOwner ? (
                <View style={styles.cardActions}>
                  <Button title="Edit" variant="secondary" onPress={() => openEdit(s)} />
                  <Button title="Delete" variant="danger" onPress={() => onDelete(s)} />
                </View>
              ) : null}
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  formTitle: { fontSize: 16, fontWeight: '600' },
  gap: { height: 12 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  list: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1, gap: 4 },
  name: { fontSize: 17, fontWeight: '700' },
  loc: { fontSize: 13 },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  chevron: { fontSize: 28, fontWeight: '300' },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12 },
});
