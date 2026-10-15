import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getDatabase } from '@/db';

export default function RootLayout() {
  useEffect(() => {
    // Initialize the local database (runs migrations on first launch).
    getDatabase().catch((e) => console.warn('DB init failed:', e));
  }, []);

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="db-debug" options={{ headerShown: true, title: 'Database Debug' }} />
      </Stack>
    </>
  );
}
