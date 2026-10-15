import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/useTheme';

interface PinPadProps {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

export function PinPad({ value, onChange, maxLength = 4 }: PinPadProps) {
  const t = useTheme();

  const press = (k: string) => {
    if (k === 'del') {
      onChange(value.slice(0, -1));
    } else if (k !== '' && value.length < maxLength) {
      onChange(value + k);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.dots}>
        {Array.from({ length: maxLength }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                borderColor: t.colors.border,
                backgroundColor: i < value.length ? t.colors.primary : 'transparent',
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.grid}>
        {KEYS.map((k, idx) => (
          <Pressable
            key={idx}
            onPress={() => press(k)}
            disabled={k === ''}
            accessibilityRole="button"
            accessibilityLabel={k === 'del' ? 'delete' : k || 'blank'}
            style={({ pressed }) => [
              styles.key,
              {
                backgroundColor: k === '' ? 'transparent' : t.colors.surface,
                borderColor: k === '' ? 'transparent' : t.colors.border,
                opacity: pressed && k !== '' ? 0.7 : 1,
              },
            ]}
          >
            <Text style={[styles.keyText, { color: t.colors.text }]}>
              {k === 'del' ? '⌫' : k}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 24 },
  dots: { flexDirection: 'row', gap: 16 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5 },
  grid: { width: 260, flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  key: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { fontSize: 26, fontWeight: '600' },
});
