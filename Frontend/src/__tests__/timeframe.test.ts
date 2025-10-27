import { describe, it, expect } from 'vitest';
import { detectTimeframeFromFilename, getTimeframeLabel, getTimeframePadding, getTimeframeConfig, getBarIntervalSeconds } from '../utils/timeframe';

describe('timeframe utilities', () => {
  it('detects M15 timeframe from filename', () => {
    expect(detectTimeframeFromFilename('EURUSD_M15_202501010000_202510221345.csv')).toBe('M15');
  });

  it('detects H1 timeframe from filename', () => {
    expect(detectTimeframeFromFilename('EURUSD_H1_202501010000_202510221300.csv')).toBe('H1');
  });

  it('detects H4 timeframe from filename', () => {
    expect(detectTimeframeFromFilename('EURUSD_H4_202501010000_202510221200.csv')).toBe('H4');
  });

  it('detects Daily timeframe from filename', () => {
    expect(detectTimeframeFromFilename('EURUSD_Daily_202501010000_202510220000.csv')).toBe('Daily');
  });

  it('detects Weekly timeframe from filename', () => {
    expect(detectTimeframeFromFilename('EURUSD_Weekly_202501050000_202510190000.csv')).toBe('Weekly');
  });

  it('returns Unknown for unrecognized patterns', () => {
    expect(detectTimeframeFromFilename('EURUSD_data.csv')).toBe('Unknown');
  });

  it('provides correct labels for timeframes', () => {
    expect(getTimeframeLabel('M15')).toBe('15 Minutes');
    expect(getTimeframeLabel('H1')).toBe('1 Hour');
    expect(getTimeframeLabel('Daily')).toBe('Daily');
  });

  it('provides appropriate padding for different timeframes', () => {
    expect(getTimeframePadding('M15')).toBeGreaterThan(0);
    expect(getTimeframePadding('H1')).toBeGreaterThan(0);
    expect(getTimeframePadding('Daily')).toBe(120);
    expect(getTimeframePadding('Weekly')).toBe(52);
  });
});

it('generates tick mark formatters for minute timeframes', () => {
  const config = getTimeframeConfig('M15', 'UTC');
  expect(config.tickMarkFormatter).toBeDefined();

  // Test formatter if it exists
  if (config.tickMarkFormatter) {
    // Create a test timestamp: Jan 15, 2025 14:30:00 UTC (use Date.UTC to guarantee UTC)
    const testTime = Math.floor(Date.UTC(2025, 0, 15, 14, 30, 0) / 1000);

    // TickMarkType.Time = 3
    const result = config.tickMarkFormatter(testTime, 3, 'en-US');
    expect(result).toContain('14:30');
  }
});

it('generates tick mark formatters for hourly timeframes', () => {
  const config = getTimeframeConfig('H1');
  expect(config.tickMarkFormatter).toBeDefined();
});

it('generates tick mark formatters for daily timeframes', () => {
  const config = getTimeframeConfig('Daily');
  expect(config.tickMarkFormatter).toBeDefined();
});

it('calculates correct bar intervals in seconds', () => {
  expect(getBarIntervalSeconds('M1')).toBe(60); // 1 minute
  expect(getBarIntervalSeconds('M15')).toBe(15 * 60); // 15 minutes = 900 seconds
  expect(getBarIntervalSeconds('H1')).toBe(60 * 60); // 1 hour = 3600 seconds
  expect(getBarIntervalSeconds('Daily')).toBe(24 * 60 * 60); // 1 day = 86400 seconds
});
