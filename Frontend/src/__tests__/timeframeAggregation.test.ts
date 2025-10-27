import { describe, it, expect } from 'vitest';
import {
  getTimeframeIntervalSeconds,
  alignTimestampToTimeframe,
  aggregateCandles
} from '../utils/timeframeAggregation';
import { Candle } from '../types/series';

describe('timeframeAggregation', () => {
  describe('getTimeframeIntervalSeconds', () => {
    it('should return correct intervals for all timeframes', () => {
      expect(getTimeframeIntervalSeconds('M1')).toBe(60);
      expect(getTimeframeIntervalSeconds('M5')).toBe(300);
      expect(getTimeframeIntervalSeconds('M15')).toBe(900);
      expect(getTimeframeIntervalSeconds('M30')).toBe(1800);
      expect(getTimeframeIntervalSeconds('H1')).toBe(3600);
      expect(getTimeframeIntervalSeconds('H4')).toBe(14400);
      expect(getTimeframeIntervalSeconds('Daily')).toBe(86400);
      expect(getTimeframeIntervalSeconds('Weekly')).toBe(604800);
      expect(getTimeframeIntervalSeconds('Monthly')).toBe(2592000);
    });
  });

  describe('alignTimestampToTimeframe', () => {
    it('should align M5 timestamps correctly', () => {
      // 2025-01-01 00:03:00 UTC (timestamp: 1735689780)
      const timestamp = 1735689780;
      // Should align to 2025-01-01 00:00:00 UTC (timestamp: 1735689600)
      const aligned = alignTimestampToTimeframe(timestamp, 'M5');
      expect(aligned).toBe(1735689600);
    });

    it('should align M15 timestamps correctly', () => {
      // 2025-01-01 00:12:00 UTC
      const timestamp = 1735690320;
      // Should align to 2025-01-01 00:00:00 UTC
      const aligned = alignTimestampToTimeframe(timestamp, 'M15');
      expect(aligned).toBe(1735689600);
    });

    it('should align H1 timestamps correctly', () => {
      // 2025-01-01 01:30:00 UTC
      const timestamp = 1735695000;
      // Should align to 2025-01-01 01:00:00 UTC
      const aligned = alignTimestampToTimeframe(timestamp, 'H1');
      expect(aligned).toBe(1735693200);
    });

    it('should align Daily timestamps to midnight UTC', () => {
      // 2025-01-01 14:30:00 UTC
      const timestamp = 1735741800;
      // Should align to 2025-01-01 00:00:00 UTC
      const aligned = alignTimestampToTimeframe(timestamp, 'Daily');
      expect(aligned).toBe(1735689600);
    });
  });

  describe('aggregateCandles', () => {
    it('should return M1 candles unchanged', () => {
      const m1Candles: Candle[] = [
        { time: 1735689600, open: 1.0, high: 1.1, low: 0.9, close: 1.05, volume: 100 },
        { time: 1735689660, open: 1.05, high: 1.15, low: 1.0, close: 1.1, volume: 150 },
      ];
      const result = aggregateCandles(m1Candles, 'M1');
      expect(result).toEqual(m1Candles);
    });

    it('should aggregate M1 to M5 correctly', () => {
      const m1Candles: Candle[] = [
        // First M5 bar (00:00 - 00:05)
        { time: 1735689600, open: 1.0, high: 1.1, low: 0.9, close: 1.05, volume: 100 },
        { time: 1735689660, open: 1.05, high: 1.15, low: 1.0, close: 1.1, volume: 150 },
        { time: 1735689720, open: 1.1, high: 1.2, low: 1.05, close: 1.15, volume: 200 },
        { time: 1735689780, open: 1.15, high: 1.25, low: 1.1, close: 1.2, volume: 250 },
        { time: 1735689840, open: 1.2, high: 1.3, low: 1.15, close: 1.25, volume: 300 },
        // Second M5 bar (00:05 - 00:10)
        { time: 1735689900, open: 1.25, high: 1.35, low: 1.2, close: 1.3, volume: 350 },
      ];

      const result = aggregateCandles(m1Candles, 'M5');

      expect(result).toHaveLength(2);

      // First M5 candle
      expect(result[0]).toEqual({
        time: 1735689600,
        open: 1.0,
        high: 1.3,
        low: 0.9,
        close: 1.25,
        volume: 1000,
      });

      // Second M5 candle
      expect(result[1]).toEqual({
        time: 1735689900,
        open: 1.25,
        high: 1.35,
        low: 1.2,
        close: 1.3,
        volume: 350,
      });
    });

    it('should aggregate M1 to M15 correctly', () => {
      const m1Candles: Candle[] = [];
      const baseTime = 1735689600; // 2025-01-01 00:00:00

      // Create 15 M1 candles
      for (let i = 0; i < 15; i++) {
        m1Candles.push({
          time: baseTime + i * 60,
          open: 1.0 + i * 0.01,
          high: 1.0 + i * 0.01 + 0.02,
          low: 1.0 + i * 0.01 - 0.01,
          close: 1.0 + i * 0.01 + 0.01,
          volume: 100,
        });
      }

      const result = aggregateCandles(m1Candles, 'M15');

      expect(result).toHaveLength(1);
      expect(result[0].time).toBe(baseTime);
      expect(result[0].open).toBe(1.0);
      expect(result[0].close).toBeCloseTo(1.15, 2); // Last M1 close
      expect(result[0].volume).toBe(1500); // Sum of all volumes
    });

    it('should handle empty candle array', () => {
      const result = aggregateCandles([], 'M5');
      expect(result).toEqual([]);
    });
  });
});
