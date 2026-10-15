import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Header, Card, Button, Select, Badge } from '@/components';
import { useThemeStore, type ThemePreference } from '@/stores/themeStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useTheme } from '@/theme/useTheme';

export default function SettingsScreen() {
  const t = useTheme();
  const router = useRouter();
  const { preference, setPreference } = useThemeStore();
  const profile = useSessionStore((s) => s.profile);
  const lock = useSessionStore((s) => s.lock);
  const isOwner = profile?.role === 'owner';

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

      <View style={styles.gap} />
      <View style={styles.col}>
        {isOwner ? (
          <Button title="Manage Profiles" onPress={() => router.push('/profiles')} />
        ) : null}
        <Button title="UI Kit Gallery" variant="secondary" onPress={() => router.push('/gallery')} />
        <Button title="Database Debug" variant="secondary" onPress={() => router.push('/db-debug')} />
        <Button title="KPI Debug" variant="secondary" onPress={() => router.push('/kpi-debug')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sessionCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, gap: 6 },
  name: { fontSize: 18, fontWeight: '700' },
  gap: { height: 14 },
  col: { gap: 10 },
});
