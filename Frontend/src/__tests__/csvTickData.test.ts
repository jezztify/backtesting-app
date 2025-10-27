import { describe, it, expect } from 'vitest';
import { parseCsvCandles } from '../utils/csv';

describe('CSV Tick Data Parsing', () => {
  it('should parse tick data format correctly', async () => {
    const csvContent = `<TICKER>,<DTYYYYMMDD>,<TIME>,<OPEN>,<HIGH>,<LOW>,<CLOSE>,<VOL>
EURUSD,20010102,230100,0.9507,0.9507,0.9507,0.9507,4
EURUSD,20010102,230200,0.9506,0.9506,0.9505,0.9505,4
EURUSD,20010102,230300,0.9505,0.9507,0.9505,0.9506,4`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const file = new File([blob], 'test_tick.csv', { type: 'text/csv' }) as any;
    file.text = async () => csvContent;

    const result = await parseCsvCandles(file);

    expect(result.errors.length).toBe(0);
    expect(result.candles.length).toBe(3);

    // First candle: 2001-01-02 23:01:00 UTC
    expect(result.candles[0].time).toBeGreaterThan(0);
    expect(result.candles[0].open).toBe(0.9507);
    expect(result.candles[0].high).toBe(0.9507);
    expect(result.candles[0].low).toBe(0.9507);
    expect(result.candles[0].close).toBe(0.9507);
    expect(result.candles[0].volume).toBe(4);

    // Verify timestamps are in ascending order
    expect(result.candles[1].time).toBeGreaterThan(result.candles[0].time);
    expect(result.candles[2].time).toBeGreaterThan(result.candles[1].time);

    // Verify 1-minute intervals (60 seconds)
    expect(result.candles[1].time - result.candles[0].time).toBe(60);
    expect(result.candles[2].time - result.candles[1].time).toBe(60);
  });

  it('should handle DTYYYYMMDD format', async () => {
    const csvContent = `<TICKER>,<DTYYYYMMDD>,<TIME>,<OPEN>,<HIGH>,<LOW>,<CLOSE>,<VOL>
EURUSD,20250101,120000,1.0500,1.0520,1.0490,1.0510,100`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const file = new File([blob], 'test.csv', { type: 'text/csv' }) as any;
    file.text = async () => csvContent;

    const result = await parseCsvCandles(file);

    expect(result.errors.length).toBe(0);
    expect(result.candles.length).toBe(1);

    // 2025-01-01 12:00:00 UTC = 1735732800
    expect(result.candles[0].time).toBe(1735732800);
  });

  it('should skip rows with invalid timestamps', async () => {
    const csvContent = `<TICKER>,<DTYYYYMMDD>,<TIME>,<OPEN>,<HIGH>,<LOW>,<CLOSE>,<VOL>
EURUSD,20010102,230100,0.9507,0.9507,0.9507,0.9507,4
EURUSD,00000000,000000,0.9506,0.9506,0.9505,0.9505,4
EURUSD,20010102,230300,0.9505,0.9507,0.9505,0.9506,4`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const file = new File([blob], 'test.csv', { type: 'text/csv' }) as any;
    file.text = async () => csvContent;

    const result = await parseCsvCandles(file);

    // Should have 1 error for the invalid row and 2 valid candles
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.candles.length).toBe(2);
    expect(result.candles[0].time).toBeGreaterThan(0);
    expect(result.candles[1].time).toBeGreaterThan(0);
  });
});
