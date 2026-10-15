import { create } from 'zustand';
import { daysAgoISO, todayISO, startOfMonthISO } from '@/services/dates';

export type RangePreset = '7d' | '30d' | 'month' | 'today';

interface FilterState {
  preset: RangePreset;
  start: string;
  end: string;
  setPreset: (p: RangePreset) => void;
}

function rangeFor(preset: RangePreset): { start: string; end: string } {
  const end = todayISO();
  switch (preset) {
    case 'today':
      return { start: end, end };
    case '7d':
      return { start: daysAgoISO(6), end };
    case '30d':
      return { start: daysAgoISO(29), end };
    case 'month':
      return { start: startOfMonthISO(), end };
  }
}

const initial = rangeFor('30d');

export const useFilterStore = create<FilterState>((set) => ({
  preset: '30d',
  start: initial.start,
  end: initial.end,
  setPreset: (preset) => set({ preset, ...rangeFor(preset) }),
}));
