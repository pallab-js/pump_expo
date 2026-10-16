import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';
import { useTheme } from '@/theme/useTheme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function makeIcon(outline: IoniconName, filled: IoniconName) {
  return function TabIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    return <Ionicons name={focused ? filled : outline} color={color as string} size={size} />;
  };
}

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: t.colors.primary,
        tabBarInactiveTintColor: t.colors.textMuted,
        tabBarStyle: {
          backgroundColor: t.colors.surface,
          borderTopColor: t.colors.border,
        },
        headerStyle: { backgroundColor: t.colors.surface },
        headerTintColor: t.colors.text,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Dashboard', tabBarIcon: makeIcon('bar-chart-outline', 'bar-chart') }}
      />
      <Tabs.Screen
        name="stations"
        options={{ title: 'Stations', tabBarIcon: makeIcon('business-outline', 'business') }}
      />
      <Tabs.Screen
        name="entry"
        options={{ title: 'Daily Entry', tabBarIcon: makeIcon('create-outline', 'create') }}
      />
      <Tabs.Screen
        name="reports"
        options={{ title: 'Reports', tabBarIcon: makeIcon('document-text-outline', 'document-text') }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: makeIcon('settings-outline', 'settings') }}
      />
    </Tabs>
  );
}
