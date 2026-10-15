import type {
  TrendPoint,
  FuelMixSlice,
  PaymentMixSlice,
  StationComparisonRow,
} from '@/services/aggregation';
import { formatShort } from '@/services/dates';

/** Compact Indian-style currency formatting. */
export function money(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${n.toFixed(0)}`;
}

/** Compact litres formatting. */
export function litresFmt(n: number): string {
  if (n >= 100000) return `${(n / 100000).toFixed(2)}L L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k L`;
  return `${n.toFixed(0)} L`;
}

export interface LinePoint {
  value: number;
  label: string;
}

export function toLineData(trend: TrendPoint[]): LinePoint[] {
  return trend.map((p) => ({ value: p.revenue, label: formatShort(p.date) }));
}

export interface PieSlice {
  value: number;
  color: string;
  text: string;
}

export function toFuelPie(mix: FuelMixSlice[]): PieSlice[] {
  return mix.map((f) => ({ value: f.litres, color: f.color, text: f.code }));
}

export function toPaymentPie(mix: PaymentMixSlice[], palette: string[]): PieSlice[] {
  return mix.map((p, i) => ({
    value: p.amount,
    color: palette[i % palette.length],
    text: p.method,
  }));
}

export interface BarPoint {
  value: number;
  label: string;
  frontColor: string;
}

export function toComparisonBars(
  comparison: StationComparisonRow[],
  palette: string[]
): BarPoint[] {
  return comparison.map((c, i) => ({
    value: c.revenue,
    label: c.name.length > 6 ? c.name.slice(0, 6) : c.name,
    frontColor: palette[i % palette.length],
  }));
}

/** Fill ratio for a tank's stock bar (0..1). */
export function stockFillRatio(balance: number, capacity: number): number {
  if (capacity <= 0) return 0;
  return Math.min(1, Math.max(0, balance / capacity));
}
