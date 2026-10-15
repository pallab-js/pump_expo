/** Design tokens for FuelPump Manager. Fuel-industry blue/green accent. */

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryText: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  // Chart palette
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
}

export const lightColors: ThemeColors = {
  background: '#F4F6F8',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF2F6',
  border: '#E1E6EC',
  text: '#17202A',
  textMuted: '#667085',
  primary: '#1E6FB8', // fuel blue
  primaryText: '#FFFFFF',
  accent: '#2E8B57', // fuel green
  success: '#2E8B57',
  warning: '#E0A500',
  danger: '#C0392B',
  chart1: '#1E6FB8',
  chart2: '#2E8B57',
  chart3: '#E0A500',
  chart4: '#7B4FB5',
};

export const darkColors: ThemeColors = {
  background: '#0E1621',
  surface: '#17222F',
  surfaceAlt: '#1E2B3A',
  border: '#2A3A4C',
  text: '#ECF2F8',
  textMuted: '#9AA9B8',
  primary: '#3B8FDC',
  primaryText: '#FFFFFF',
  accent: '#3FB37A',
  success: '#3FB37A',
  warning: '#F0B429',
  danger: '#E05A4C',
  chart1: '#3B8FDC',
  chart2: '#3FB37A',
  chart3: '#F0B429',
  chart4: '#9A6FD4',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export type ThemeMode = 'light' | 'dark';

export interface Theme {
  mode: ThemeMode;
  colors: ThemeColors;
  spacing: typeof spacing;
  radii: typeof radii;
  fontSize: typeof fontSize;
  fontWeight: typeof fontWeight;
}

export function buildTheme(mode: ThemeMode): Theme {
  return {
    mode,
    colors: mode === 'dark' ? darkColors : lightColors,
    spacing,
    radii,
    fontSize,
    fontWeight,
  };
}
