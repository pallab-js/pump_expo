import { create } from 'zustand';
import type { ThemeMode } from '@/theme/tokens';

export type ThemePreference = ThemeMode | 'system';

interface ThemeState {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

/** Persisted-in-memory theme preference (persisted to DB in Settings task). */
export const useThemeStore = create<ThemeState>((set) => ({
  preference: 'system',
  setPreference: (preference) => set({ preference }),
}));
