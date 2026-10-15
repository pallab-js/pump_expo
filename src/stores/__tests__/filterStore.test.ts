import { useFilterStore } from '@/stores/filterStore';
import { todayISO, daysAgoISO, startOfMonthISO } from '@/services/dates';

describe('filterStore', () => {
  it('defaults to a 30-day range ending today', () => {
    const s = useFilterStore.getState();
    expect(s.preset).toBe('30d');
    expect(s.end).toBe(todayISO());
    expect(s.start).toBe(daysAgoISO(29));
  });

  it('updates the range when preset changes', () => {
    useFilterStore.getState().setPreset('today');
    let s = useFilterStore.getState();
    expect(s.preset).toBe('today');
    expect(s.start).toBe(todayISO());
    expect(s.end).toBe(todayISO());

    useFilterStore.getState().setPreset('7d');
    s = useFilterStore.getState();
    expect(s.start).toBe(daysAgoISO(6));

    useFilterStore.getState().setPreset('month');
    s = useFilterStore.getState();
    expect(s.start).toBe(startOfMonthISO());

    // reset to default for other tests
    useFilterStore.getState().setPreset('30d');
  });
});
