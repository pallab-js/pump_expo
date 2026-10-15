import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@/theme/useTheme';

export interface SelectOption<T extends string | number> {
  label: string;
  value: T;
}

interface SelectProps<T extends string | number> {
  label?: string;
  options: SelectOption<T>[];
  value: T | null;
  onChange: (v: T) => void;
  horizontal?: boolean;
}

export function Select<T extends string | number>({
  label,
  options,
  value,
  onChange,
  horizontal = true,
}: SelectProps<T>) {
  const t = useTheme();

  const chips = options.map((opt) => {
    const selected = opt.value === value;
    return (
      <Pressable
        key={String(opt.value)}
        onPress={() => onChange(opt.value)}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        style={[
          styles.chip,
          {
            backgroundColor: selected ? t.colors.primary : t.colors.surfaceAlt,
            borderColor: selected ? t.colors.primary : t.colors.border,
            borderRadius: t.radii.pill,
          },
        ]}
      >
        <Text
          style={{
            color: selected ? t.colors.primaryText : t.colors.text,
            fontWeight: selected ? '600' : '500',
            fontSize: 14,
          }}
        >
          {opt.label}
        </Text>
      </Pressable>
    );
  });

  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, { color: t.colors.textMuted }]}>{label}</Text> : null}
      {horizontal ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {chips}
        </ScrollView>
      ) : (
        <View style={styles.wrapRow}>{chips}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: 13, fontWeight: '500' },
  row: { gap: 8, paddingVertical: 2 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderWidth: StyleSheet.hairlineWidth },
});
