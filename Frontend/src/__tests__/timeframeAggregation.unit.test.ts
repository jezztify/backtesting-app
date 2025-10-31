import {
    getTimeframeIntervalSeconds,
    alignTimestampToTimeframe,
    aggregateCandles,
    streamAggregateCandles,
} from '../utils/timeframeAggregation';

import { Candle } from '../types/series';

describe('timeframeAggregation utilities', () => {
    test('getTimeframeIntervalSeconds returns correct intervals', () => {
        expect(getTimeframeIntervalSeconds('M1')).toBe(60);
        expect(getTimeframeIntervalSeconds('M5')).toBe(300);
        expect(getTimeframeIntervalSeconds('H1')).toBe(3600);
        expect(getTimeframeIntervalSeconds('Daily')).toBe(86400);
        expect(getTimeframeIntervalSeconds('Monthly')).toBe(2592000);
    });

    test('alignTimestampToTimeframe aligns intraday and daily/weekly/monthly correctly', () => {
        const t = 1625072405; // 2021-06-30T15:00:05Z

        // M5 should align down to nearest 300s
        const alignedM5 = alignTimestampToTimeframe(t, 'M5');
        expect(alignedM5 % 300).toBe(0);
        expect(alignedM5).toBeLessThanOrEqual(t);

        // Daily should align to UTC midnight
        const alignedDaily = alignTimestampToTimeframe(t, 'Daily');
        const dt = new Date(alignedDaily * 1000);
        expect(dt.getUTCHours()).toBe(0);
        expect(dt.getUTCMinutes()).toBe(0);

        // Weekly should align to Monday midnight UTC
        // Pick a Wednesday (2021-06-30 is Wednesday) so aligned should be Monday 2021-06-28 00:00:00 UTC
        const alignedWeekly = alignTimestampToTimeframe(t, 'Weekly');
        const wdt = new Date(alignedWeekly * 1000);
        expect(wdt.getUTCDay()).toBe(1); // Monday
        expect(wdt.getUTCHours()).toBe(0);

        // Monthly should align to first of month midnight UTC
        const alignedMonthly = alignTimestampToTimeframe(t, 'Monthly');
        const mdt = new Date(alignedMonthly * 1000);
        expect(mdt.getUTCDate()).toBe(1);
        expect(mdt.getUTCHours()).toBe(0);
    });

    test('aggregateCandles aggregates M1 candles into target timeframe and skips invalid timestamps', () => {
        const base = 1600000200; // arbitrary base aligned to 100s
        const m1: Candle[] = [
            { time: base, open: 1, high: 2, low: 0.9, close: 1.5, volume: 10 },
            { time: base + 60, open: 1.5, high: 2.5, low: 1.4, close: 2.0, volume: 5 },
            { time: base + 120, open: 2.0, high: 3.0, low: 1.9, close: 2.5, volume: 2 },
            { time: 0, open: 0, high: 0, low: 0, close: 0, volume: 1 }, // invalid timestamp should be skipped
        ];

        const aggregated = aggregateCandles(m1, 'M5');
        // should produce one aggregated candle (all three fall into same M5 bucket)
        expect(aggregated.length).toBe(1);
        const a = aggregated[0];
        // open should be the first candle's open
        expect(a.open).toBeCloseTo(1);
        // high should be max high
        expect(a.high).toBeCloseTo(3.0);
        // low should be min low
        expect(a.low).toBeCloseTo(0.9);
        // close should be last close seen
        expect(a.close).toBeCloseTo(2.5);
        // volume should be summed
        expect(a.volume).toBe(17);
    });

    test('streamAggregateCandles processes in chunks and reports progress', async () => {
        // create 250 M1 candles spanning two M5 buckets
        const base = 1600000200;
        const m1: Candle[] = [];
        for (let i = 0; i < 250; i++) {
            m1.push({ time: base + i * 60, open: 1 + i * 0.01, high: 1 + i * 0.01 + 0.5, low: 1 + i * 0.01 - 0.2, close: 1 + i * 0.01 + 0.1, volume: 1 });
        }

        const progresses: Array<[number, number]> = [];
        const result = await streamAggregateCandles(m1, 'M15', (processed, total) => {
            progresses.push([processed, total]);
        });

        // result should match aggregateCandles for same input
        const manual = aggregateCandles(m1, 'M15');
        expect(result.length).toBe(manual.length);
        expect(result[0].time).toBe(manual[0].time);
        expect(progresses.length).toBeGreaterThan(0);
        // final progress should indicate all processed
        const last = progresses[progresses.length - 1];
        expect(last[0]).toBe(m1.length);
        expect(last[1]).toBe(m1.length);
    });
});
