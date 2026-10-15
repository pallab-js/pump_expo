import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getDatabase } from '@/db';
import { useTheme } from '@/theme/useTheme';

export default function RootLayout() {
  useEffect(() => {
    // Initialize the local database (runs migrations on first launch).
    getDatabase().catch((e) => console.warn('DB init failed:', e));
  }, []);

  const t = useTheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={t.mode === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="db-debug" options={{ headerShown: true, title: 'Database Debug' }} />
          <Stack.Screen name="gallery" options={{ headerShown: true, title: 'UI Kit Gallery' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
