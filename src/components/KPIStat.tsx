import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/useTheme';
import { Card } from './Card';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface KPIStatProps {
  label: string;
  value: string;
  sublabel?: string;
  accent?: string;
  icon?: IoniconName;
}

export function KPIStat({ label, value, sublabel, accent, icon }: KPIStatProps) {
  const t = useTheme();
  const accentColor = accent ?? t.colors.primary;
  return (
    <Card
      style={styles.card}
      // Group label + value so screen readers announce "Revenue, ₹1.2L".
    >
      <View
        accessible
        accessibilityLabel={`${label}, ${value}${sublabel ? `, ${sublabel}` : ''}`}
      >
        <View style={styles.row}>
          {icon ? <Ionicons name={icon} size={15} color={accentColor} /> : null}
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
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 92, justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 13, fontWeight: '500', flexShrink: 1 },
  value: { fontSize: 22, fontWeight: '700', marginTop: 6 },
  sub: { fontSize: 12, fontWeight: '600', marginTop: 2 },
});
