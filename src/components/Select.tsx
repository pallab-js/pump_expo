import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
  disabled?: boolean;
}

export function Select<T extends string | number>({
  label,
  options,
  value,
  onChange,
  horizontal = true,
  disabled = false,
}: SelectProps<T>) {
  const t = useTheme();

  const chips = options.map((opt) => {
    const selected = opt.value === value;
    return (
      <Pressable
        key={String(opt.value)}
        onPress={() => !disabled && onChange(opt.value)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={opt.label}
        accessibilityState={{ selected, disabled }}
        style={[
          styles.chip,
          {
            backgroundColor: selected ? t.colors.primary : t.colors.surfaceAlt,
            borderColor: selected ? t.colors.primary : t.colors.border,
            borderRadius: t.radii.pill,
            opacity: disabled ? 0.5 : 1,
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
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {chips}
          </ScrollView>
          {/* Right-edge fade hints that more chips are scrollable off-screen. */}
          <LinearGradient
            pointerEvents="none"
            colors={['transparent', t.colors.background]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.fade}
          />
        </View>
      ) : (
        <View style={styles.wrapRow}>{chips}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: 13, fontWeight: '500' },
  row: { gap: 8, paddingVertical: 2, paddingRight: 24 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  fade: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 24 },
});
