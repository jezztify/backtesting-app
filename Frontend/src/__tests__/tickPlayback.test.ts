import { describe, it, expect } from 'vitest';
import { aggregateTicksUpToIndex, getTicksPerBar } from '../utils/tickPlayback';
import { Candle, Timeframe } from '../types/series';

describe('tickPlayback', () => {
    describe('getTicksPerBar', () => {
        it('should calculate correct ticks per bar for same timeframes', () => {
            expect(getTicksPerBar('M1', 'M1')).toBe(1);
            expect(getTicksPerBar('M5', 'M5')).toBe(1);
            expect(getTicksPerBar('H1', 'H1')).toBe(1);
        });

        it('should calculate correct ticks per bar from M1', () => {
            expect(getTicksPerBar('M1', 'M5')).toBe(5);
            expect(getTicksPerBar('M1', 'M15')).toBe(15);
            expect(getTicksPerBar('M1', 'M30')).toBe(30);
            expect(getTicksPerBar('M1', 'H1')).toBe(60);
            expect(getTicksPerBar('M1', 'H4')).toBe(240);
        });

        it('should calculate correct ticks per bar from M5', () => {
            expect(getTicksPerBar('M5', 'M15')).toBe(3);
            expect(getTicksPerBar('M5', 'M30')).toBe(6);
            expect(getTicksPerBar('M5', 'H1')).toBe(12);
        });

        it('should calculate correct ticks per bar from M15', () => {
            expect(getTicksPerBar('M15', 'M30')).toBe(2);
            expect(getTicksPerBar('M15', 'H1')).toBe(4);
            expect(getTicksPerBar('M15', 'H4')).toBe(16);
        });
    });

    describe('aggregateTicksUpToIndex', () => {
        const createM1Candles = (count: number, baseTime: number): Candle[] => {
            const candles: Candle[] = [];
            for (let i = 0; i < count; i++) {
                candles.push({
                    time: baseTime + i * 60, // M1 = 60 seconds apart
                    open: 1.0 + i * 0.01,
                    high: 1.0 + i * 0.01 + 0.005,
                    low: 1.0 + i * 0.01 - 0.005,
                    close: 1.0 + i * 0.01 + 0.002,
                    volume: 100,
                });
            }
            return candles;
        };

        it('should return same data when base and target are the same', () => {
            const m1Candles = createM1Candles(10, 1735689600);
            const result = aggregateTicksUpToIndex(m1Candles, 'M1', 'M1', 5);
            expect(result).toHaveLength(6); // 0-5 inclusive
            expect(result[0].time).toBe(m1Candles[0].time);
        });

        it('should aggregate M1 to M5 progressively', () => {
            const m1Candles = createM1Candles(10, 1735689600);

            // After first M1 tick
            const result1 = aggregateTicksUpToIndex(m1Candles, 'M1', 'M5', 0);
            expect(result1).toHaveLength(1);

            // After 5 M1 ticks (1 complete M5 bar)
            const result5 = aggregateTicksUpToIndex(m1Candles, 'M1', 'M5', 4);
            expect(result5).toHaveLength(1);
            expect(result5[0].open).toBe(1.0);
            expect(result5[0].close).toBe(1.0 + 0.04 + 0.002); // 5th candle's close

            // After 7 M1 ticks (1 complete M5 + partial M5)
            const result7 = aggregateTicksUpToIndex(m1Candles, 'M1', 'M5', 6);
            expect(result7).toHaveLength(2);
        });

        it('should aggregate M1 to M15 progressively', () => {
            const m1Candles = createM1Candles(20, 1735689600);

            // After 10 M1 ticks (partial M15)
            const result10 = aggregateTicksUpToIndex(m1Candles, 'M1', 'M15', 9);
            expect(result10).toHaveLength(1);

            // After 15 M1 ticks (1 complete M15)
            const result15 = aggregateTicksUpToIndex(m1Candles, 'M1', 'M15', 14);
            expect(result15).toHaveLength(1);

            // After 17 M1 ticks (1 complete M15 + partial)
            const result17 = aggregateTicksUpToIndex(m1Candles, 'M1', 'M15', 16);
            expect(result17).toHaveLength(2);
        });

        it('should handle M5 to M15 aggregation', () => {
            // Create M5 candles (300 seconds apart)
            const m5Candles: Candle[] = [];
            const baseTime = 1735689600;
            for (let i = 0; i < 6; i++) {
                m5Candles.push({
                    time: baseTime + i * 300,
                    open: 1.0 + i * 0.01,
                    high: 1.0 + i * 0.01 + 0.005,
                    low: 1.0 + i * 0.01 - 0.005,
                    close: 1.0 + i * 0.01 + 0.002,
                    volume: 100,
                });
            }

            // 3 M5 bars = 1 M15 bar
            const result = aggregateTicksUpToIndex(m5Candles, 'M5', 'M15', 2);
            expect(result).toHaveLength(1);
            expect(result[0].open).toBe(1.0);

            // 5 M5 bars = 1 complete M15 + partial M15
            const result2 = aggregateTicksUpToIndex(m5Candles, 'M5', 'M15', 4);
            expect(result2).toHaveLength(2);
        });

        it('should not aggregate to smaller timeframe', () => {
            const m15Candles: Candle[] = [{
                time: 1735689600,
                open: 1.0,
                high: 1.01,
                low: 0.99,
                close: 1.005,
                volume: 100,
            }];

            // Try to aggregate M15 to M5 (invalid - should just return slice)
            const result = aggregateTicksUpToIndex(m15Candles, 'M15', 'M5', 0);
            expect(result).toHaveLength(1);
            expect(result[0].time).toBe(1735689600);
        });

        it('should handle empty array', () => {
            const result = aggregateTicksUpToIndex([], 'M1', 'M5', 0);
            expect(result).toEqual([]);
        });

        it('should handle negative index', () => {
            const m1Candles = createM1Candles(5, 1735689600);
            const result = aggregateTicksUpToIndex(m1Candles, 'M1', 'M5', -1);
            expect(result).toEqual([]);
        });
    });
});
