import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen, Header, Card, KPIStat, Button, Input, Select, Badge, EmptyState , Spacer } from '@/components';
import { useTheme } from '@/theme/useTheme';
import { useThemeStore, type ThemePreference } from '@/stores/themeStore';

export default function GalleryScreen() {
  const t = useTheme();
  const { preference, setPreference } = useThemeStore();
  const [text, setText] = useState('');

  return (
    <Screen>
      <Header title="UI Kit Gallery" subtitle={`Mode: ${t.mode}`} />

      <Select<ThemePreference>
        label="Theme preference"
        options={[
          { label: 'System', value: 'system' },
          { label: 'Light', value: 'light' },
          { label: 'Dark', value: 'dark' },
        ]}
        value={preference}
        onChange={setPreference}
      />

      <Spacer />
      <View style={styles.kpiRow}>
        <View style={styles.kpiCell}>
          <KPIStat label="Revenue" value="₹1.24L" sublabel="▲ 8%" icon="cash-outline" />
        </View>
        <View style={styles.kpiCell}>
          <KPIStat label="Litres" value="4,820" sublabel="Today" accent={t.colors.accent} icon="water-outline" />
        </View>
      </View>

      <Spacer />
      <Card>
        <Text style={[styles.cardTitle, { color: t.colors.text }]}>Card + inputs</Text>
        <Spacer />
        <Input label="Station name" value={text} onChangeText={setText} placeholder="e.g. Highway Pump" />
        <Spacer />
        <Input label="With error" value="" onChangeText={() => {}} placeholder="Required" error="This field is required" />
        <Spacer />
        <View style={styles.badgeRow}>
          <Badge label="Owner" tone="primary" />
          <Badge label="Low stock" tone="warning" />
          <Badge label="Active" tone="success" dotColor={t.colors.success} />
        </View>
      </Card>

      <Spacer />
      <View style={styles.btnCol}>
        <Button title="Primary" onPress={() => {}} />
        <Button title="Secondary" variant="secondary" onPress={() => {}} />
        <Button title="Danger" variant="danger" onPress={() => {}} />
        <Button title="Ghost" variant="ghost" onPress={() => {}} />
        <Button title="Loading" loading onPress={() => {}} />
      </View>

      <Spacer />
      <Card padded={false}>
        <EmptyState
          icon="⛽"
          title="No stations yet"
          message="Add your first outlet to get started."
          actionLabel="Add Station"
          onAction={() => {}}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { height: 14 },
  kpiRow: { flexDirection: 'row', gap: 12 },
  kpiCell: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  badgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  btnCol: { gap: 10 },
});
