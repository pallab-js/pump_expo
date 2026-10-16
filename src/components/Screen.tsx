import { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/useTheme';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Show a centered spinner instead of children (first-load state). */
  loading?: boolean;
  /** Enables pull-to-refresh; called when the user pulls down. */
  onRefresh?: () => void | Promise<void>;
  /** Disable the keyboard-avoiding wrapper (e.g. for pure read screens). */
  avoidKeyboard?: boolean;
}

export function Screen({
  children,
  scroll = true,
  padded = true,
  style,
  loading = false,
  onRefresh,
  avoidKeyboard = true,
}: ScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const pad = padded ? t.spacing.lg : 0;
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const bg = { backgroundColor: t.colors.background };

  if (loading) {
    return (
      <View style={[styles.flex, styles.center, bg]}>
        <ActivityIndicator color={t.colors.primary} />
      </View>
    );
  }

  const inner = (
    <View style={[{ padding: pad, flexGrow: 1 }, !scroll && styles.flex, style]}>{children}</View>
  );

  const body = scroll ? (
    <ScrollView
      style={[styles.flex, bg]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={t.colors.primary}
            colors={[t.colors.primary]}
          />
        ) : undefined
      }
    >
      {inner}
    </ScrollView>
  ) : (
    <View style={[styles.flex, bg]}>{inner}</View>
  );

  if (!avoidKeyboard) return body;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {body}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
});
