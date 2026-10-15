import { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Header, Card, Button, Select, Badge } from '@/components';
import { useThemeStore, type ThemePreference } from '@/stores/themeStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useTheme } from '@/theme/useTheme';
import { getDatabase, _resetDatabaseCache } from '@/db';
import { shareBackup, pickAndRestoreBackup } from '@/services/backupIO';

export default function SettingsScreen() {
  const t = useTheme();
  const router = useRouter();
  const { preference, setPreference } = useThemeStore();
  const profile = useSessionStore((s) => s.profile);
  const lock = useSessionStore((s) => s.lock);
  const isOwner = profile?.role === 'owner';

  const [busy, setBusy] = useState<null | 'export' | 'import'>(null);
  const [msg, setMsg] = useState<string | null>(null);

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

      <View style={styles.gap} />
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

      {isOwner ? (
        <>
          <View style={styles.gap} />
          <Card>
            <Text style={[styles.cardTitle, { color: t.colors.text }]}>Data backup</Text>
            <Text style={[styles.muted, { color: t.colors.textMuted }]}>
              All data is stored only on this device. Export a JSON backup to Files/iCloud and
              restore it later or on another device.
            </Text>
            <View style={styles.gap} />
            <View style={styles.col}>
              <Button title="Export backup" onPress={onExport} loading={busy === 'export'} />
              <Button title="Restore from backup" variant="secondary" onPress={onImport} loading={busy === 'import'} />
            </View>
            {msg ? <Text style={[styles.msg, { color: t.colors.success }]}>{msg}</Text> : null}
          </Card>
        </>
      ) : null}

      <View style={styles.gap} />
      <View style={styles.col}>
        {isOwner ? <Button title="Manage Profiles" onPress={() => router.push('/profiles')} /> : null}
      </View>

      {isOwner ? (
        <>
          <View style={styles.gap} />
          <Text style={[styles.devTitle, { color: t.colors.textMuted }]}>Developer</Text>
          <View style={styles.col}>
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
  gap: { height: 14 },
  col: { gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  muted: { fontSize: 13, lineHeight: 19 },
  msg: { marginTop: 10, fontWeight: '600' },
  devTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
});
