import { View, ScrollView, StyleSheet, type StyleProp, type ViewStyle, type RefreshControlProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/useTheme';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}

export function Screen({ children, scroll = true, padded = true, style, refreshControl }: ScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const pad = padded ? t.spacing.lg : 0;

  const inner = (
    <View style={[{ padding: pad, flexGrow: 1 }, !scroll && styles.flex, style]}>{children}</View>
  );

  if (scroll) {
    return (
      <ScrollView
        style={[styles.flex, { backgroundColor: t.colors.background }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
      >
        {inner}
      </ScrollView>
    );
  }

  return <View style={[styles.flex, { backgroundColor: t.colors.background }]}>{inner}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
