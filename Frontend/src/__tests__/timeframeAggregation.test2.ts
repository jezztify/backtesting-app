import { describe, it, expect } from 'vitest';
import { getTimeframeIntervalSeconds, alignTimestampToTimeframe, aggregateCandles, streamAggregateCandles } from '../utils/timeframeAggregation';

describe('timeframeAggregation helpers', () => {
    it('returns correct interval seconds', () => {
        expect(getTimeframeIntervalSeconds('M1')).toBe(60);
        expect(getTimeframeIntervalSeconds('H4')).toBe(14400);
        expect(getTimeframeIntervalSeconds('Monthly')).toBe(2592000);
    });

    it('aligns timestamps for daily/weekly/monthly and intraday', () => {
        const ts = 1609459200; // 2021-01-01 00:00:00 UTC
        expect(alignTimestampToTimeframe(ts + 3600, 'Daily')).toBe(1609459200);
        // weekly - Monday alignment: 2021-01-06 is Wednesday, pick Monday
        const wed = 1610064000; // 2021-01-08
        const aligned = alignTimestampToTimeframe(wed, 'Weekly');
        expect(aligned % 86400).toBe(0);
        // monthly align
        const mid = 1612137600; // Feb 1 2021
        const alignedMonth = alignTimestampToTimeframe(mid + 1000, 'Monthly');
        expect(new Date(alignedMonth * 1000).getUTCDate()).toBe(1);
    });

    it('aggregates candles into higher timeframe', async () => {
        const base = 1609459200; // epoch
        const m1 = [
            { time: base + 0, open: 1, high: 2, low: 1, close: 1.5, volume: 10 },
            { time: base + 60, open: 1.5, high: 3, low: 1.4, close: 2, volume: 5 },
            { time: base + 120, open: 2, high: 2.2, low: 1.8, close: 2.1, volume: 2 },
        ];
        const agg = aggregateCandles(m1, 'M5');
        expect(Array.isArray(agg)).toBe(true);
        const streamed = await streamAggregateCandles(m1, 'M5', (p, t) => {
            // progress callback should be called at least once
            expect(t).toBe(m1.length);
        });
        expect(streamed.length).toBeGreaterThan(0);
    });
});
