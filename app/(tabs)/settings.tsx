import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Header, Card, Button, Select } from '@/components';
import { useThemeStore, type ThemePreference } from '@/stores/themeStore';

export default function SettingsScreen() {
  const router = useRouter();
  const { preference, setPreference } = useThemeStore();

  return (
    <Screen>
      <Header title="Settings" subtitle="Theme, profiles, backup" />

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
        <Button title="UI Kit Gallery" variant="secondary" onPress={() => router.push('/gallery')} />
        <Button title="Database Debug" variant="secondary" onPress={() => router.push('/db-debug')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { height: 14 },
  col: { gap: 10 },
});
