/** App metadata constants. */
export const APP_NAME = 'FuelPump Manager';
export const APP_VERSION = '1.0.0';

/** Supported fuel type codes seeded into the database. */
export const DEFAULT_FUEL_TYPES = ['MS', 'HSD', 'XP', 'CNG'] as const;
export type FuelTypeCode = (typeof DEFAULT_FUEL_TYPES)[number];
