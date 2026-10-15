import { useColorScheme } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { buildTheme, type Theme, type ThemeMode } from './tokens';

/** Resolve the active theme from system scheme + user preference. */
export function useTheme(): Theme {
  const system = useColorScheme();
  const preference = useThemeStore((s) => s.preference);
  const mode: ThemeMode =
    preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  return buildTheme(mode);
}
