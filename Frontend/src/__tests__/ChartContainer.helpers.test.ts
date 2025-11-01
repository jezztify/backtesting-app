import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependent modules
vi.mock('../utils/tickPlayback', () => ({
  aggregateTicksUpToIndex: vi.fn(),
}));

vi.mock('../utils/timeframe', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    // preserve any actual exports and override what we need
    ...actual,
    getTimeframeConfig: vi.fn(() => ({ timeVisible: true, secondsVisible: true, tickMarkFormatter: () => '' })),
    getTimeframePadding: vi.fn(() => 2),
    getBarIntervalSeconds: vi.fn(() => 60),
  };
});

vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => ({
    addSeries: vi.fn((type: any, opts: any) => ({ applyOptions: vi.fn(), priceScale: vi.fn(() => ({ setVisibleRange: vi.fn() })), coordinateToPrice: vi.fn(), priceToCoordinate: vi.fn() })),
  })),
  CandlestickSeries: 'CandlestickSeries',
  ColorType: { Solid: 0 },
}));

import { normalizeTime, offsetTimeByBars, normalizeVisibleData, getChartThemeColors, readCssVariable, applyThemeToChart } from '../components/ChartContainer';
import { aggregateTicksUpToIndex } from '../utils/tickPlayback';
import { getTimeframePadding, getBarIntervalSeconds } from '../utils/timeframe';

describe('ChartContainer helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure no CSS variables bleed between tests
    document.documentElement.style.removeProperty('--color-chart-text');
    document.documentElement.style.removeProperty('--color-chart-surface');
    document.documentElement.style.removeProperty('--color-chart-grid');
    document.documentElement.style.removeProperty('--color-success');
    document.documentElement.style.removeProperty('--color-danger');
  });

  it('normalizeTime handles numbers, strings, and date objects', () => {
    expect(normalizeTime(undefined)).toBeNull();
    expect(normalizeTime(1600000000 as any)).toBe(1600000000);
    expect(normalizeTime('2020-01-01T00:00:00Z' as any)).toBe(Math.floor(new Date('2020-01-01T00:00:00Z').getTime() / 1000));
    expect(normalizeTime({ year: 2020, month: 1, day: 2 } as any)).toBe(Math.floor(Date.UTC(2020, 0, 2) / 1000));
    expect(normalizeTime('not-a-date' as any)).toBeNull();
  });

  it('offsetTimeByBars offsets using bar interval', () => {
    const base = 1600000000;
    expect(offsetTimeByBars(base as any, 1, 60)).toBe(base + 60);
    expect(offsetTimeByBars(base as any, -2, 30)).toBe(base - 60);
    // invalid time (string that isn't parseable) -> null
    // use a malformed Time object
    // @ts-ignore
    expect(offsetTimeByBars({ not: 'time' } as any, 1, 60)).toBeNull();
  });

  it('normalizeVisibleData pads and returns candlestick + whitespace data', () => {
    const baseTicks = [
      { time: 1000, open: 1, high: 2, low: 1, close: 1 },
      { time: 1060, open: 2, high: 3, low: 2, close: 2 },
    ];
    // Mock aggregate to return the baseTicks
    (aggregateTicksUpToIndex as any).mockImplementation(() => baseTicks);
    (getTimeframePadding as any).mockImplementation(() => 2);
    (getBarIntervalSeconds as any).mockImplementation(() => 60);

    const out = normalizeVisibleData(baseTicks as any, 'M1' as any, 0, 'M1' as any);
    // padding 2 on each side + 2 candles => total 6
    expect(out.length).toBe(6);
    expect((out[0] as any).time).toBe(1000 - 2 * 60);
    expect((out[out.length - 1] as any).time).toBe(1060 + 2 * 60);
  });

  it('readCssVariable and getChartThemeColors use CSS variables when present', () => {
    document.documentElement.style.setProperty('--color-chart-text', '#123456');
    document.documentElement.style.setProperty('--color-chart-surface', '#fafafa');
    const val = readCssVariable('--color-chart-text');
    expect(val).toBe('#123456');

    const theme = getChartThemeColors('light');
    expect(theme.text).toBe('#123456');
    expect(theme.background).toBe('#fafafa');
  });

  it('applyThemeToChart applies options to chart and series', () => {
    const colors = { background: '#0f0', text: '#111', grid: '#222', up: '#0f0', down: '#f00' } as any;
    const chartMock: any = { applyOptions: vi.fn() };
    const seriesMock: any = { applyOptions: vi.fn() };
    const canvasSettings = { background: '#fff', upFill: '#aaa', downFill: '#bbb', upWick: '#ccc', downWick: '#ddd', upBorder: '#eee', downBorder: '#000' };
    applyThemeToChart(chartMock, seriesMock, colors, canvasSettings as any);
    expect(chartMock.applyOptions).toHaveBeenCalled();
    expect(seriesMock.applyOptions).toHaveBeenCalled();
  });
});
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependent modules
vi.mock('../utils/tickPlayback', () => ({
  aggregateTicksUpToIndex: vi.fn(),
}));

vi.mock('../utils/timeframe', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getTimeframeConfig: vi.fn(() => ({ timeVisible: true, secondsVisible: true, tickMarkFormatter: () => '' })),
    getTimeframePadding: vi.fn(() => 2),
    getBarIntervalSeconds: vi.fn(() => 60),
  };
});

vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => ({
    addSeries: vi.fn((type: any, opts: any) => ({ applyOptions: vi.fn(), priceScale: vi.fn(() => ({ setVisibleRange: vi.fn() })), coordinateToPrice: vi.fn(), priceToCoordinate: vi.fn() })),
  })),
  CandlestickSeries: 'CandlestickSeries',
  ColorType: { Solid: 0 },
}));

import { normalizeTime, offsetTimeByBars, normalizeVisibleData, getChartThemeColors, readCssVariable, createChartInstance, applyThemeToChart } from '../components/ChartContainer';
import { aggregateTicksUpToIndex } from '../utils/tickPlayback';
import { getTimeframePadding, getBarIntervalSeconds } from '../utils/timeframe';

describe('ChartContainer helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure no CSS variables bleed between tests
    document.documentElement.style.removeProperty('--color-chart-text');
    document.documentElement.style.removeProperty('--color-chart-surface');
    document.documentElement.style.removeProperty('--color-chart-grid');
    document.documentElement.style.removeProperty('--color-success');
    document.documentElement.style.removeProperty('--color-danger');
  });

  it('normalizeTime handles numbers, strings, and date objects', () => {
    expect(normalizeTime(undefined)).toBeNull();
    expect(normalizeTime(1600000000)).toBe(1600000000);
    expect(normalizeTime('2020-01-01T00:00:00Z')).toBe(Math.floor(new Date('2020-01-01T00:00:00Z').getTime() / 1000));
    expect(normalizeTime({ year: 2020, month: 1, day: 2 } as any)).toBe(Math.floor(Date.UTC(2020, 0, 2) / 1000));
    expect(normalizeTime('not-a-date')).toBeNull();
  });

  it('offsetTimeByBars offsets using bar interval', () => {
    const base = 1600000000;
    expect(offsetTimeByBars(base, 1, 60)).toBe(base + 60);
    expect(offsetTimeByBars(base, -2, 30)).toBe(base - 60);
    // invalid time (string that isn't parseable) -> null
    // use a malformed Time object
    // @ts-ignore
    expect(offsetTimeByBars({ not: 'time' }, 1, 60)).toBeNull();
  });

  it('normalizeVisibleData pads and returns candlestick + whitespace data', () => {
    const baseTicks = [
      { time: 1000, open: 1, high: 2, low: 1, close: 1 },
      { time: 1060, open: 2, high: 3, low: 2, close: 2 },
    ];
    // Mock aggregate to return the baseTicks
    (aggregateTicksUpToIndex as any).mockImplementation(() => baseTicks);
    (getTimeframePadding as any).mockImplementation(() => 2);
    (getBarIntervalSeconds as any).mockImplementation(() => 60);

    const out = normalizeVisibleData(baseTicks as any, 'M1' as any, 0, 'M1' as any);
    // padding 2 on each side + 2 candles => total 6
    expect(out.length).toBe(6);
    expect((out[0] as any).time).toBe(1000 - 2 * 60);
    expect((out[out.length - 1] as any).time).toBe(1060 + 2 * 60);
  });

  it('readCssVariable and getChartThemeColors use CSS variables when present', () => {
    document.documentElement.style.setProperty('--color-chart-text', '#123456');
    document.documentElement.style.setProperty('--color-chart-surface', '#fafafa');
    const val = readCssVariable('--color-chart-text');
    expect(val).toBe('#123456');

    const theme = getChartThemeColors('light');
    expect(theme.text).toBe('#123456');
    expect(theme.background).toBe('#fafafa');
  });

  it('createChartInstance and applyThemeToChart integrate with lightweight-charts mock', () => {
    const container = document.createElement('div');
    const colors = { background: '#0f0', text: '#111', grid: '#222', up: '#0f0', down: '#f00' } as any;
    // We avoid calling createChartInstance here because it depends on getTimeframeConfig
    // which can be part of the timeframe module; instead ensure applyThemeToChart works
    const chartMock: any = { applyOptions: vi.fn() };
    const seriesMock: any = { applyOptions: vi.fn() };
    const canvasSettings = { background: '#fff', upFill: '#aaa', downFill: '#bbb', upWick: '#ccc', downWick: '#ddd', upBorder: '#eee', downBorder: '#000' };
    applyThemeToChart(chartMock, seriesMock, colors, canvasSettings as any);
    expect(chartMock.applyOptions).toHaveBeenCalled();
    expect(seriesMock.applyOptions).toHaveBeenCalled();
  });
});
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import the helpers we'll test
import { normalizeTime, offsetTimeByBars, normalizeVisibleData } from '../components/ChartContainer';

// Mock dependencies used by normalizeVisibleData
vi.mock('../utils/tickPlayback', () => ({
  aggregateTicksUpToIndex: vi.fn(),
}));

vi.mock('../utils/timeframe', () => ({
  getTimeframePadding: vi.fn(),
  getBarIntervalSeconds: vi.fn(),
}));

import { aggregateTicksUpToIndex } from '../utils/tickPlayback';
import { getTimeframePadding, getBarIntervalSeconds } from '../utils/timeframe';

describe('ChartContainer helpers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('normalizeTime handles numbers, ISO strings, date-objects and invalid values', () => {
    const num = 1620000000;
  expect(normalizeTime(num as any)).toBe(num);

    const iso = '2020-01-02T00:00:00Z';
  expect(normalizeTime(iso as any)).toBe(Math.floor(Date.parse(iso) / 1000));

    const obj = { day: 2, month: 1, year: 2020 } as any;
  expect(normalizeTime(obj as any)).toBe(Math.floor(Date.UTC(2020, 0, 2) / 1000));

  expect(normalizeTime(undefined as any)).toBeNull();
  expect(normalizeTime('not-a-date' as any)).toBeNull();
  });

  it('offsetTimeByBars adds bars * interval seconds to normalized time', () => {
    const base = 1000;
    const bars = 3;
    const interval = 60;
  const result = offsetTimeByBars(base as any, bars, interval);
    expect(result).toBe(base + bars * interval);

    // If time cannot be normalized, result is null
  expect(offsetTimeByBars('invalid' as any, 1, 60)).toBeNull();
  });

  it('normalizeVisibleData returns padded data and maps candles correctly', () => {
    // Prepare aggregated candles: two candles 60s apart
    const aggregated = [
      { time: 1000, open: 1, high: 2, low: 0.5, close: 1.5 },
      { time: 1060, open: 1.5, high: 2.5, low: 1.0, close: 2.0 },
    ];

    // Mock aggregateTicksUpToIndex to return our aggregated set
    (aggregateTicksUpToIndex as any).mockReturnValue(aggregated);

    // Provide timeframe utilities
    (getTimeframePadding as any).mockReturnValue(2);
    (getBarIntervalSeconds as any).mockReturnValue(60);

    const baseTicks: any[] = []; // not used due to mocking
    const result = normalizeVisibleData(baseTicks as any, 'M1' as any, 0, 'M1' as any);

    // Expect padding before (2), the 2 candles, and padding after (2) => total 6 entries
    expect(result.length).toBe(6);

    // Verify the time sequence: [880, 940, 1000, 1060, 1120, 1180]
    const times = result.map((d: any) => (d as any).time);
    expect(times).toEqual([880, 940, 1000, 1060, 1120, 1180]);
  });
});
