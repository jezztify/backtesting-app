import { describe, it, expect, vi, beforeEach } from 'vitest';

import { toCanvasPoint, toChartPoint } from '../components/ChartContainer';

describe('ChartContainer converters (toCanvasPoint / toChartPoint)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('toCanvasPoint returns x/y when timeToCoordinate and priceToCoordinate return values', () => {
    const timeScaleMock = { timeToCoordinate: vi.fn().mockReturnValue(123) } as any;
    const chart = { timeScale: () => timeScaleMock } as any;
    const series = { priceToCoordinate: vi.fn().mockReturnValue(456) } as any;

    const candles = [{ time: 1000 }, { time: 1060 }];
    const out = toCanvasPoint({ time: 1000, price: 10 }, chart, series, candles as any);
    expect(out).toEqual({ x: 123, y: 456 });
  });

  it('toCanvasPoint extrapolates x when timeToCoordinate returns null for point but not for first/last candles', () => {
    const tsMock = {
      timeToCoordinate: vi.fn((t: any) => {
        if (t === 1000) return 10;
        if (t === 1060) return 110;
        return null;
      }),
      coordinateToTime: vi.fn(),
    };
    const chart = { timeScale: () => tsMock } as any;
    const series = { priceToCoordinate: vi.fn().mockReturnValue(300) } as any;

    // point is after last candle (1120)
    const out = toCanvasPoint({ time: 1120, price: 50 }, chart, series, [{ time: 1000 }, { time: 1060 }] as any);
    expect(out).not.toBeNull();
    if (out) {
      // Expect extrapolated x roughly: x1 + ((1120-1000)/(1060-1000)) * (x2-x1)
      const expected = 10 + ((1120 - 1000) / (1060 - 1000)) * (110 - 10);
      expect(out.x).toBeCloseTo(expected, 6);
      expect(out.y).toBe(300);
    }
  });

  it('toCanvasPoint returns null when priceToCoordinate is null', () => {
    const ts = { timeToCoordinate: vi.fn().mockReturnValue(50) } as any;
    const chart = { timeScale: () => ts } as any;
    const series = { priceToCoordinate: vi.fn().mockReturnValue(null) } as any;
    const out = toCanvasPoint({ time: 1000, price: 10 }, chart, series, [{ time: 1000 }] as any);
    expect(out).toBeNull();
  });

  it('toChartPoint returns normalized time and price when coordinateToTime and coordinateToPrice are valid', () => {
    const ts = { coordinateToTime: vi.fn().mockReturnValue('2020-01-01T00:00:00Z') } as any;
    const chart = { timeScale: () => ts } as any;
    const series = { coordinateToPrice: vi.fn().mockReturnValue(12.34) } as any;

    const out = toChartPoint({ x: 100, y: 200 }, chart, series);
    expect(out).not.toBeNull();
    if (out) {
      expect(out.time).toBe(Math.floor(new Date('2020-01-01T00:00:00Z').getTime() / 1000));
      expect(out.price).toBe(12.34);
    }
  });

  it('toChartPoint returns null when coordinateToTime cannot be normalized or coordinateToPrice is null', () => {
    const ts = { coordinateToTime: vi.fn().mockReturnValue('not-a-date') } as any;
    const chart = { timeScale: () => ts } as any;
    const series = { coordinateToPrice: vi.fn().mockReturnValue(1.23) } as any;

    expect(toChartPoint({ x: 10, y: 20 }, chart, series)).toBeNull();

    const ts2 = { coordinateToTime: vi.fn().mockReturnValue('2020-01-01T00:00:00Z') } as any;
    const chart2 = { timeScale: () => ts2 } as any;
    const series2 = { coordinateToPrice: vi.fn().mockReturnValue(null) } as any;
    expect(toChartPoint({ x: 10, y: 20 }, chart2, series2)).toBeNull();
  });

  it('toCanvasPoint returns null when candlesRef is empty', () => {
    const timeScaleMock = { timeToCoordinate: vi.fn().mockReturnValue(10) } as any;
    const chart = { timeScale: () => timeScaleMock } as any;
    const series = { priceToCoordinate: vi.fn().mockReturnValue(20) } as any;
    const out = toCanvasPoint({ time: 1000, price: 1 }, chart, series, [] as any);
    expect(out).toBeNull();
  });

  it('toCanvasPoint returns null when timeToCoordinate or priceToCoordinate produce non-finite values', () => {
    const ts = { timeToCoordinate: vi.fn().mockReturnValue(NaN) } as any;
    const chart = { timeScale: () => ts } as any;
    const series = { priceToCoordinate: vi.fn().mockReturnValue(Infinity) } as any;
    const out = toCanvasPoint({ time: 1000, price: 1 }, chart, series, [{ time: 1000 }] as any);
    expect(out).toBeNull();
  });

  it('toChartPoint handles numeric and object time formats from coordinateToTime', () => {
    // numeric timestamp (seconds)
    const ts1 = { coordinateToTime: vi.fn().mockReturnValue(1600000000) } as any;
    const chart1 = { timeScale: () => ts1 } as any;
    const series1 = { coordinateToPrice: vi.fn().mockReturnValue(5) } as any;
    const out1 = toChartPoint({ x: 10, y: 20 }, chart1, series1);
    expect(out1).not.toBeNull();
    if (out1) expect(out1.time).toBe(1600000000);

    // object time {year,month,day}
    const ts2 = { coordinateToTime: vi.fn().mockReturnValue({ year: 2021, month: 6, day: 15 }) } as any;
    const chart2 = { timeScale: () => ts2 } as any;
    const series2 = { coordinateToPrice: vi.fn().mockReturnValue(7.5) } as any;
    const out2 = toChartPoint({ x: 10, y: 20 }, chart2, series2);
    expect(out2).not.toBeNull();
    if (out2) expect(out2.time).toBe(Math.floor(Date.UTC(2021, 5, 15) / 1000));
  });
});
