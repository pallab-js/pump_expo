import { View, Text, TextInput, StyleSheet, type KeyboardTypeOptions } from 'react-native';
import { useTheme } from '@/theme/useTheme';

interface InputProps {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  error?: string | null;
  maxLength?: number;
  autoFocus?: boolean;
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  error,
  maxLength,
  autoFocus,
}: InputProps) {
  const t = useTheme();
  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, { color: t.colors.textMuted }]}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.colors.textMuted}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        maxLength={maxLength}
        autoFocus={autoFocus}
        style={[
          styles.input,
          {
            backgroundColor: t.colors.surface,
            borderColor: error ? t.colors.danger : t.colors.border,
            borderRadius: t.radii.md,
            color: t.colors.text,
          },
        ]}
      />
      {error ? <Text style={[styles.error, { color: t.colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 13, fontWeight: '500' },
  input: { borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, minHeight: 48 },
  error: { fontSize: 12, fontWeight: '500' },
});
