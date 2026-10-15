import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getDatabase } from '@/db';
import { useTheme } from '@/theme/useTheme';
import { AuthGate } from '@/components/AuthGate';

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
        <AuthGate>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="db-debug" options={{ headerShown: true, title: 'Database Debug' }} />
            <Stack.Screen name="gallery" options={{ headerShown: true, title: 'UI Kit Gallery' }} />
            <Stack.Screen name="profiles" options={{ headerShown: true, title: 'Profiles' }} />
            <Stack.Screen name="station/[id]" options={{ headerShown: true, title: 'Station' }} />
            <Stack.Screen name="prices/[id]" options={{ headerShown: true, title: 'Fuel Prices' }} />
            <Stack.Screen name="kpi-debug" options={{ headerShown: true, title: 'KPI Debug' }} />
          </Stack>
        </AuthGate>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
