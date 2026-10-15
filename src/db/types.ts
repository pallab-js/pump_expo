/** Domain model types for FuelPump Manager (mirrors the SQLite schema). */

export type Role = 'owner' | 'staff';

export interface Profile {
  id: number;
  name: string;
  role: Role;
  pin_hash: string;
  pin_salt: string;
  created_at: string;
  failed_attempts: number;
  locked_until: string | null;
  biometric_enabled: number; // 0 | 1
}

export interface ProfileStation {
  profile_id: number;
  station_id: number;
}

export interface Station {
  id: number;
  name: string;
  location: string | null;
  code: string | null;
  active: number; // 0 | 1
  created_at: string;
}

export interface FuelType {
  id: number;
  code: string; // e.g. MS, HSD, XP, CNG
  name: string;
  unit: string; // 'L' or 'kg'
  color: string; // hex for charts
}

export interface Tank {
  id: number;
  station_id: number;
  fuel_type_id: number;
  label: string;
  capacity: number; // litres/kg
  low_threshold: number; // low-stock alert level
}

export interface Nozzle {
  id: number;
  station_id: number;
  fuel_type_id: number;
  label: string;
  tank_id: number | null;
}

export interface FuelPrice {
  id: number;
  station_id: number;
  fuel_type_id: number;
  price: number; // per unit
  effective_date: string; // YYYY-MM-DD
}

export interface DayRecord {
  id: number;
  station_id: number;
  date: string; // YYYY-MM-DD
  note: string | null;
  created_at: string;
}

export interface MeterReading {
  id: number;
  day_record_id: number;
  nozzle_id: number;
  opening: number;
  closing: number;
  test_litres: number; // calibration litres to subtract
  price: number; // price applied for this reading
}

export type StockMovementType = 'opening' | 'receipt' | 'closing' | 'adjustment';

export interface StockMovement {
  id: number;
  day_record_id: number;
  tank_id: number;
  type: StockMovementType;
  quantity: number;
  note: string | null;
}

export type PaymentMethod = 'cash' | 'card' | 'upi' | 'credit';

export interface Payment {
  id: number;
  day_record_id: number;
  method: PaymentMethod;
  amount: number;
}

export interface Expense {
  id: number;
  day_record_id: number;
  category: string;
  amount: number;
  note: string | null;
}

export interface Staff {
  id: number;
  station_id: number;
  name: string;
  phone: string | null;
  active: number; // 0 | 1
}

export type ShiftName = 'morning' | 'evening' | 'night' | 'full';

export interface Shift {
  id: number;
  day_record_id: number;
  staff_id: number | null;
  shift: ShiftName;
  note: string | null;
}
