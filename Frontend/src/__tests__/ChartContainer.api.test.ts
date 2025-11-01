import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock lightweight-charts to avoid creating real charts
vi.mock('lightweight-charts', () => {
  const mockSeries = { mock: true };
  return {
    createChart: vi.fn((container: any, opts: any) => ({
      addSeries: vi.fn(() => mockSeries),
    })),
    CandlestickSeries: 'CandlestickSeries',
    ColorType: { Solid: 'Solid' },
  };
});

// Minimal timeframe mocks used by createChartInstance
vi.mock('../utils/timeframe', () => ({
  getTimeframeConfig: vi.fn(() => ({ timeVisible: true, secondsVisible: false, tickMarkFormatter: () => '' })),
  getTimeframePadding: vi.fn(),
  getBarIntervalSeconds: vi.fn(),
  getTimeframeMultiplier: vi.fn(),
}));

import { readCssVariable, getChartThemeColors, applyThemeToChart, createChartInstance } from '../components/ChartContainer';
import * as lwc from 'lightweight-charts';
import * as timeframe from '../utils/timeframe';

describe('ChartContainer API helpers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Clear any CSS variables we might set
    document.documentElement.style.removeProperty('--color-chart-surface');
    document.documentElement.style.removeProperty('--color-chart-text');
    // Restore mocked timeframe helpers to return sensible defaults
    (timeframe.getTimeframeConfig as any).mockReturnValue({ timeVisible: true, secondsVisible: false, tickMarkFormatter: () => '' });
    (timeframe.getTimeframePadding as any).mockReturnValue(0);
    (timeframe.getBarIntervalSeconds as any).mockReturnValue(60);
    // Ensure lightweight-charts mock createChart still returns a chart object after reset
    (lwc.createChart as any).mockImplementation((container: any, opts: any) => ({
      addSeries: vi.fn(() => ({ mockSeries: true })),
    }));
  });

  it('readCssVariable and getChartThemeColors return CSS variables when set', () => {
    document.documentElement.style.setProperty('--color-chart-surface', '  #abcdef  ');
    document.documentElement.style.setProperty('--color-chart-text', '#112233');

    expect(readCssVariable('--color-chart-surface')).toBe('#abcdef');
    const colors = getChartThemeColors('light');
    expect(colors.background).toBe('#abcdef');
    expect(colors.text).toBe('#112233');
  });

  it('applyThemeToChart calls chart and series applyOptions with expected values', () => {
    const chart: any = { applyOptions: vi.fn() };
    const series: any = { applyOptions: vi.fn() };

    const colors = { background: '#000', text: '#111', grid: '#222', up: '#333', down: '#444' } as any;
    const canvasSettings = {
      background: '#aabbcc',
      upFill: '#u',
      downFill: '#d',
      upWick: '#uw',
      downWick: '#dw',
      upBorder: '#ub',
      downBorder: '#db',
    } as any;

    applyThemeToChart(chart, series, colors, canvasSettings);

    expect(chart.applyOptions).toHaveBeenCalled();
    const chartArgs = (chart.applyOptions as any).mock.calls[0][0];
    expect(chartArgs.layout.background.color).toBe(canvasSettings.background);
    expect(chartArgs.layout.textColor).toBe(colors.text);

    expect(series.applyOptions).toHaveBeenCalled();
    const seriesArgs = (series.applyOptions as any).mock.calls[0][0];
    expect(seriesArgs.upColor).toBe(canvasSettings.upFill);
    expect(seriesArgs.downColor).toBe(canvasSettings.downFill);
    expect(seriesArgs.borderVisible).toBe(true);
  });

  // Skipping createChartInstance direct test because it depends on getTimeframeConfig
  // which is imported at module-evaluation time; testing it requires careful module reloading
  // Test createChartInstance: ensure it calls into lightweight-charts and returns the
  // chart and series objects. The timeframe utilities are mocked above so this is safe.
  it('createChartInstance calls createChart and addSeries and returns chart + series', () => {
    const colors = { background: '#000', text: '#111', grid: '#222', up: '#333', down: '#444' } as any;
    const container = document.createElement('div');

    const res = createChartInstance(container, 'M1' as any, colors, 'UTC');

    // lightweight-charts mock should have been invoked
    expect((lwc.createChart as any).mock.calls.length).toBeGreaterThan(0);

    // The returned chart and series should be the mocked objects (chart has addSeries)
    expect(res).toHaveProperty('chart');
    expect(res).toHaveProperty('series');
    const chart = (lwc.createChart as any).mock.results[0].value;
    expect(chart.addSeries).toHaveBeenCalled();
  });
});
