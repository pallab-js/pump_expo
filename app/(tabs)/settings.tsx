import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Screen, Header, Card, Button, Select, Badge, Spacer } from '@/components';
import { useThemeStore, type ThemePreference } from '@/stores/themeStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useTheme } from '@/theme/useTheme';
import { getDatabase, _resetDatabaseCache } from '@/db';
import { shareBackup, pickAndRestoreBackup } from '@/services/backupIO';
import { seedDemoData, hasAnyStations } from '@/services/seed';
import { getProfile, setBiometricEnabled } from '@/repositories/profileRepo';
import { isBiometricAvailable, biometricLabel, authenticateBiometric } from '@/services/biometrics';

export default function SettingsScreen() {
  const t = useTheme();
  const router = useRouter();
  const { preference, setPreference } = useThemeStore();
  const profile = useSessionStore((s) => s.profile);
  const lock = useSessionStore((s) => s.lock);
  const isOwner = profile?.role === 'owner';

  const [busy, setBusy] = useState<null | 'export' | 'import' | 'seed'>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioLabel, setBioLabel] = useState('Biometrics');
  const [bioEnabled, setBioEnabled] = useState(false);

  const loadBiometric = useCallback(async () => {
    const available = await isBiometricAvailable();
    setBioAvailable(available);
    if (available) setBioLabel(await biometricLabel());
    if (profile) {
      const db = await getDatabase();
      const fresh = await getProfile(db, profile.id);
      setBioEnabled(!!fresh?.biometric_enabled);
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      loadBiometric();
    }, [loadBiometric])
  );

  const toggleBiometric = async () => {
    if (!profile) return;
    const db = await getDatabase();
    if (bioEnabled) {
      await setBiometricEnabled(db, profile.id, false);
      setBioEnabled(false);
      setMsg(`${bioLabel} unlock disabled.`);
      return;
    }
    // Enabling: confirm the biometric actually works on this device first.
    const ok = await authenticateBiometric(`Enable ${bioLabel} unlock`);
    if (!ok) {
      setMsg(`${bioLabel} not confirmed — still disabled.`);
      return;
    }
    await setBiometricEnabled(db, profile.id, true);
    setBioEnabled(true);
    setMsg(`${bioLabel} unlock enabled.`);
  };

  const onExport = async () => {
    setBusy('export');
    setMsg(null);
    try {
      const db = await getDatabase();
      const name = await shareBackup(db);
      setMsg(`Backup ready: ${name}`);
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const runSeed = async () => {
    setBusy('seed');
    setMsg(null);
    try {
      const db = await getDatabase();
      const res = await seedDemoData(db);
      setMsg(`Loaded demo data: ${res.stations} stations × ${res.days} days.`);
    } catch (e) {
      Alert.alert('Seeding failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onSeed = () => {
    setMsg(null);
    (async () => {
      const db = await getDatabase();
      if (await hasAnyStations(db)) {
        Alert.alert(
          'Add demo data?',
          'Stations already exist. Demo data will be ADDED alongside your current data (it will not replace it). Continue?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Add demo data', onPress: runSeed },
          ]
        );
      } else {
        runSeed();
      }
    })();
  };

  const onImport = () => {
    Alert.alert(
      'Restore backup',
      'This will REPLACE all current data with the backup contents. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            setBusy('import');
            setMsg(null);
            try {
              const db = await getDatabase();
              const ok = await pickAndRestoreBackup(db);
              if (ok) {
                setMsg('Restore complete.');
                _resetDatabaseCache();
                lock(); // force re-auth with restored profiles
              }
            } catch (e) {
              Alert.alert('Restore failed', e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  };

  return (
    <Screen>
      <Header title="Settings" subtitle="Theme, profiles, backup" />

      <Card style={styles.sessionCard}>
        <View style={styles.flex}>
          <Text style={[styles.name, { color: t.colors.text }]}>{profile?.name ?? '—'}</Text>
          <Badge label={isOwner ? 'Owner' : 'Staff'} tone={isOwner ? 'primary' : 'default'} />
        </View>
        <Button title="Lock" variant="secondary" onPress={lock} />
      </Card>

      <Spacer />
      <Card>
        <Select<ThemePreference>
          label="Appearance"
          options={[
            { label: 'System', value: 'system' },
            { label: 'Light', value: 'light' },
            { label: 'Dark', value: 'dark' },
          ]}
          value={preference}
          onChange={setPreference}
        />
      </Card>

      {bioAvailable ? (
        <>
          <Spacer />
          <Card style={styles.sessionCard}>
            <View style={styles.flex}>
              <Text style={[styles.cardTitle, { color: t.colors.text }]}>{bioLabel} unlock</Text>
              <Text style={[styles.muted, { color: t.colors.textMuted }]}>
                {bioEnabled
                  ? `Unlock with ${bioLabel} instead of your PIN.`
                  : `Use ${bioLabel} as a faster unlock. Your PIN still works.`}
              </Text>
            </View>
            <Button
              title={bioEnabled ? 'Disable' : 'Enable'}
              variant={bioEnabled ? 'secondary' : 'primary'}
              onPress={toggleBiometric}
            />
          </Card>
        </>
      ) : null}

      {isOwner ? (
        <>
          <Spacer />
          <Card>
            <Text style={[styles.cardTitle, { color: t.colors.text }]}>Data backup</Text>
            <Text style={[styles.muted, { color: t.colors.textMuted }]}>
              All data is stored only on this device. Export a JSON backup to Files/iCloud and
              restore it later or on another device.
            </Text>
            <Spacer />
            <View style={styles.col}>
              <Button title="Export backup" onPress={onExport} loading={busy === 'export'} />
              <Button title="Restore from backup" variant="secondary" onPress={onImport} loading={busy === 'import'} />
            </View>
            {msg ? <Text style={[styles.msg, { color: t.colors.success }]}>{msg}</Text> : null}
          </Card>
        </>
      ) : null}

      <Spacer />
      <View style={styles.col}>
        {isOwner ? <Button title="Manage Profiles" onPress={() => router.push('/profiles')} /> : null}
      </View>

      {isOwner ? (
        <>
          <Spacer />
          <Text style={[styles.devTitle, { color: t.colors.textMuted }]}>Developer</Text>
          <View style={styles.col}>
            <Button title="Load demo data" variant="secondary" onPress={onSeed} loading={busy === 'seed'} />
            <Button title="UI Kit Gallery" variant="ghost" onPress={() => router.push('/gallery')} />
            <Button title="Database Debug" variant="ghost" onPress={() => router.push('/db-debug')} />
            <Button title="KPI Debug" variant="ghost" onPress={() => router.push('/kpi-debug')} />
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sessionCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, gap: 6 },
  name: { fontSize: 18, fontWeight: '700' },
  col: { gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  muted: { fontSize: 13, lineHeight: 19 },
  msg: { marginTop: 10, fontWeight: '600' },
  devTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
});
