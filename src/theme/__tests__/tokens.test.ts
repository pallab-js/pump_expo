import { buildTheme, lightColors, darkColors } from '@/theme/tokens';

describe('theme tokens', () => {
  it('builds a light theme', () => {
    const theme = buildTheme('light');
    expect(theme.mode).toBe('light');
    expect(theme.colors).toBe(lightColors);
    expect(theme.spacing.lg).toBe(16);
  });

  it('builds a dark theme', () => {
    const theme = buildTheme('dark');
    expect(theme.mode).toBe('dark');
    expect(theme.colors).toBe(darkColors);
  });

  it('provides a 4-color chart palette in both modes', () => {
    for (const mode of ['light', 'dark'] as const) {
      const c = buildTheme(mode).colors;
      const palette = [c.chart1, c.chart2, c.chart3, c.chart4];
      expect(new Set(palette).size).toBe(4);
      palette.forEach((hex) => expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/));
    }
  });
});
