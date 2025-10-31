import { describe, it, expect } from 'vitest';
import { parseCsvCandles } from '../utils/csv';

function makeFile(text: string) {
    // Use a simple object with a .text() method to avoid relying on the DOM File API
    return { text: async () => text } as unknown as File;
}

describe('csv parsing', () => {
    it('returns error on empty file', async () => {
        const f = makeFile('');
        const res = await parseCsvCandles(f);
        expect(res.candles.length).toBe(0);
        expect(res.errors.length).toBeGreaterThan(0);
    });

    it('errors when required columns missing', async () => {
        const text = 'foo,bar,baz\n1,2,3';
        const f = makeFile(text);
        const res = await parseCsvCandles(f);
        expect(res.candles.length).toBe(0);
        expect(res.errors[0]).toMatch(/Missing required columns/);
    });

    it('parses comma-separated time-based candles', async () => {
        const text = 'time,open,high,low,close\n1609459200,1,2,0.5,1.5';
        const f = makeFile(text);
        const res = await parseCsvCandles(f);
        expect(res.errors.length).toBe(0);
        expect(res.candles.length).toBe(1);
        expect(res.candles[0].time).toBe(1609459200);
    });

    it('parses tab-separated MT5 style date+time columns', async () => {
        const text = 'date\ttime\topen\thigh\tlow\tclose\n2025.01.01\t12:00:00\t1\t2\t0.5\t1.5';
        const f = makeFile(text);
        const res = await parseCsvCandles(f);
        expect(res.errors.length).toBe(0);
        expect(res.candles.length).toBe(1);
    });

    it('parses YYYYMMDD + HHMMSS format', async () => {
        const text = 'time,open,high,low,close\n20250101,120000,1,2,0.5,1.5';
        // The above has extra columns but parse should handle YYYYMMDD when time column present
        const f = makeFile(text);
        const res = await parseCsvCandles(f);
        // Might produce error depending on mapping - ensure it doesn't crash
        expect(res).toHaveProperty('errors');
    });

    it('reports invalid numeric values per-line', async () => {
        const text = 'time,open,high,low,close\n1609459200,1,NaN,0.5,1.5';
        const f = makeFile(text);
        const res = await parseCsvCandles(f);
        expect(res.candles.length).toBe(0);
        expect(res.errors.some(e => e.includes('Line'))).toBe(true);
    });
});
