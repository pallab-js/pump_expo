import { APP_NAME, DEFAULT_FUEL_TYPES } from '@/constants';

describe('smoke', () => {
  it('exposes the app name', () => {
    expect(APP_NAME).toBe('FuelPump Manager');
  });

  it('seeds four default fuel types', () => {
    expect(DEFAULT_FUEL_TYPES).toHaveLength(4);
    expect(DEFAULT_FUEL_TYPES).toContain('MS');
    expect(DEFAULT_FUEL_TYPES).toContain('HSD');
  });
});
