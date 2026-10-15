import { format, parseISO, subDays, startOfMonth } from 'date-fns';

/** Today as YYYY-MM-DD (local). */
export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/** Format a YYYY-MM-DD string for display, e.g. "15 Oct 2026". */
export function formatDisplay(iso: string): string {
  try {
    return format(parseISO(iso), 'dd MMM yyyy');
  } catch {
    return iso;
  }
}

/** Short display, e.g. "15 Oct". */
export function formatShort(iso: string): string {
  try {
    return format(parseISO(iso), 'dd MMM');
  } catch {
    return iso;
  }
}

/** ISO date N days ago. */
export function daysAgoISO(n: number): string {
  return format(subDays(new Date(), n), 'yyyy-MM-dd');
}

/** First day of the current month, ISO. */
export function startOfMonthISO(): string {
  return format(startOfMonth(new Date()), 'yyyy-MM-dd');
}
