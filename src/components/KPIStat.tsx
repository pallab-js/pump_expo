import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/useTheme';
import { Card } from './Card';

interface KPIStatProps {
  label: string;
  value: string;
  sublabel?: string;
  accent?: string;
  icon?: string;
}

export function KPIStat({ label, value, sublabel, accent, icon }: KPIStatProps) {
  const t = useTheme();
  const accentColor = accent ?? t.colors.primary;
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        {icon ? <Text style={styles.icon}>{icon}</Text> : null}
        <Text style={[styles.label, { color: t.colors.textMuted }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={[styles.value, { color: t.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sublabel ? (
        <Text style={[styles.sub, { color: accentColor }]} numberOfLines={1}>
          {sublabel}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 92, justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  icon: { fontSize: 14 },
  label: { fontSize: 13, fontWeight: '500', flexShrink: 1 },
  value: { fontSize: 22, fontWeight: '700', marginTop: 6 },
  sub: { fontSize: 12, fontWeight: '600', marginTop: 2 },
});
