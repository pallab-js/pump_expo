import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/useTheme';

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'primary';

interface BadgeProps {
  label: string;
  tone?: Tone;
  dotColor?: string;
}

export function Badge({ label, tone = 'default', dotColor }: BadgeProps) {
  const t = useTheme();
  const toneColor: Record<Tone, string> = {
    default: t.colors.textMuted,
    success: t.colors.success,
    warning: t.colors.warning,
    danger: t.colors.danger,
    primary: t.colors.primary,
  };
  const color = toneColor[tone];
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: color + '22', borderColor: color + '55', borderRadius: t.radii.pill },
      ]}
    >
      {dotColor ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, alignSelf: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 12, fontWeight: '600' },
});
