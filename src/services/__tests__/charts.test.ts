import {
  money,
  litresFmt,
  toLineData,
  toFuelPie,
  toPaymentPie,
  toComparisonBars,
  stockFillRatio,
} from '@/services/charts';

describe('chart helpers', () => {
  it('formats money compactly', () => {
    expect(money(500)).toBe('₹500');
    expect(money(1500)).toBe('₹1.5k');
    expect(money(250000)).toBe('₹2.50L');
    expect(money(12000000)).toBe('₹1.20Cr');
  });

  it('formats litres compactly', () => {
    expect(litresFmt(500)).toBe('500 L');
    expect(litresFmt(1500)).toBe('1.5k L');
  });

  it('maps a sales trend to line data', () => {
    const line = toLineData([
      { date: '2026-10-01', litres: 100, revenue: 10000 },
      { date: '2026-10-02', litres: 200, revenue: 20000 },
    ]);
    expect(line).toHaveLength(2);
    expect(line[0].value).toBe(10000);
    expect(typeof line[0].label).toBe('string');
  });

  it('maps fuel mix to pie slices preserving colors', () => {
    const pie = toFuelPie([
      { fuelTypeId: 1, code: 'MS', name: 'Petrol', color: '#2E8B57', litres: 500, revenue: 50000 },
    ]);
    expect(pie[0]).toEqual({ value: 500, color: '#2E8B57', text: 'MS' });
  });

  it('maps payment mix with a rotating palette', () => {
    const palette = ['#111', '#222', '#333', '#444'];
    const pie = toPaymentPie(
      [
        { method: 'cash', amount: 100 },
        { method: 'card', amount: 50 },
      ],
      palette
    );
    expect(pie[0].color).toBe('#111');
    expect(pie[1].color).toBe('#222');
  });

  it('maps station comparison to bars and truncates long labels', () => {
    const bars = toComparisonBars(
      [
        { stationId: 1, name: 'VeryLongStationName', litres: 1, revenue: 1000 },
        { stationId: 2, name: 'Short', litres: 1, revenue: 500 },
      ],
      ['#111', '#222']
    );
    expect(bars[0].label).toBe('VeryLo');
    expect(bars[1].label).toBe('Short');
    expect(bars[0].value).toBe(1000);
  });

  it('clamps stock fill ratio to 0..1', () => {
    expect(stockFillRatio(5000, 10000)).toBe(0.5);
    expect(stockFillRatio(15000, 10000)).toBe(1);
    expect(stockFillRatio(100, 0)).toBe(0);
    expect(stockFillRatio(-5, 10000)).toBe(0);
  });
});
