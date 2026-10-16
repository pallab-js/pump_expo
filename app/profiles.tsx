import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getDatabase } from '@/db';
import type { Profile, Station } from '@/db/types';
import {
  listProfiles,
  createProfile,
  deleteProfile,
  getProfileStationIds,
} from '@/repositories/profileRepo';
import { listStations } from '@/repositories/stationRepo';
import { useSessionStore } from '@/stores/sessionStore';
import { useTheme } from '@/theme/useTheme';
import { Screen, Header, Card, Button, Input, Select, Badge, EmptyState , Spacer } from '@/components';

export default function ProfilesScreen() {
  const t = useTheme();
  const session = useSessionStore((s) => s.profile);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [stationIds, setStationIds] = useState<Record<number, number[]>>({});

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [assigned, setAssigned] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const db = await getDatabase();
    const ps = await listProfiles(db);
    setProfiles(ps);
    setStations(await listStations(db));
    const map: Record<number, number[]> = {};
    for (const p of ps) {
      if (p.role === 'staff') map[p.id] = await getProfileStationIds(db, p.id);
    }
    setStationIds(map);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onAdd = async () => {
    setError(null);
    if (name.trim().length < 2) return setError('Enter a name.');
    if (pin.length < 4) return setError('PIN must be 4+ digits.');
    setBusy(true);
    try {
      const db = await getDatabase();
      await createProfile(db, { name: name.trim(), role: 'staff', pin, stationIds: assigned });
      setName('');
      setPin('');
      setAssigned([]);
      setAdding(false);
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = (p: Profile) => {
    if (p.id === session?.id) {
      Alert.alert('Cannot delete', 'You cannot delete the profile you are signed in as.');
      return;
    }
    Alert.alert('Delete profile', `Delete "${p.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const db = await getDatabase();
          await deleteProfile(db, p.id);
          await load();
        },
      },
    ]);
  };

  const toggleStation = (id: number) => {
    setAssigned((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <Screen>
      <Header title="Profiles" subtitle="Owner & staff access (PIN-protected)" />

      <View style={styles.list}>
        {profiles.map((p) => (
          <Card key={p.id} style={styles.row}>
            <View style={styles.flex}>
              <Text style={[styles.name, { color: t.colors.text }]}>{p.name}</Text>
              <View style={styles.badges}>
                <Badge label={p.role === 'owner' ? 'Owner' : 'Staff'} tone={p.role === 'owner' ? 'primary' : 'default'} />
                {p.role === 'staff' ? (
                  <Badge label={`${stationIds[p.id]?.length ?? 0} station(s)`} tone="success" />
                ) : null}
                {p.id === session?.id ? <Badge label="You" tone="warning" /> : null}
              </View>
            </View>
            {p.id !== session?.id ? (
              <Button title="Delete" variant="danger" onPress={() => onDelete(p)} />
            ) : null}
          </Card>
        ))}
      </View>

      <Spacer />

      {!adding ? (
        <Button title="+ Add staff profile" onPress={() => setAdding(true)} />
      ) : (
        <Card>
          <Text style={[styles.formTitle, { color: t.colors.text }]}>New staff profile</Text>
          <Spacer />
          <Input label="Name" value={name} onChangeText={setName} placeholder="e.g. Ramesh" />
          <Spacer />
          <Input
            label="PIN (4+ digits)"
            value={pin}
            onChangeText={(v) => setPin(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={8}
            error={error}
          />
          <Spacer />
          {stations.length === 0 ? (
            <EmptyState icon="⛽" title="No stations yet" message="Add stations first to assign access." />
          ) : (
            <View style={styles.assignWrap}>
              <Text style={[styles.assignLabel, { color: t.colors.textMuted }]}>Assign stations</Text>
              <View style={styles.chips}>
                {stations.map((s) => (
                  <Select<number>
                    key={s.id}
                    options={[{ label: s.name, value: s.id }]}
                    value={assigned.includes(s.id) ? s.id : null}
                    onChange={() => toggleStation(s.id)}
                    horizontal={false}
                  />
                ))}
              </View>
            </View>
          )}
          <Spacer />
          <View style={styles.formActions}>
            <Button title="Cancel" variant="ghost" onPress={() => { setAdding(false); setError(null); }} />
            <Button title="Create" onPress={onAdd} loading={busy} />
          </View>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, gap: 6 },
  name: { fontSize: 16, fontWeight: '600' },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  gap: { height: 12 },
  formTitle: { fontSize: 16, fontWeight: '600' },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  assignWrap: { gap: 8 },
  assignLabel: { fontSize: 13, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
