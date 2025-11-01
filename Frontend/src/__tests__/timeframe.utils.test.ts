import { describe, it, expect } from 'vitest';
import {
    detectTimeframeFromFilename,
    getTimeframeConfig,
    getTimeframeLabel,
    getTimeframePadding,
    getBarIntervalSeconds,
    getTimeframeMultiplier,
} from '../utils/timeframe';

describe('timeframe utilities', () => {
    it('detects minute/hour/day/week/month patterns', () => {
        expect(detectTimeframeFromFilename('EURUSD_1min.csv')).toBe('M1');
        expect(detectTimeframeFromFilename('EURUSD_M5.json')).toBe('M5');
        expect(detectTimeframeFromFilename('file_m15.txt')).toBe('M15');
        expect(detectTimeframeFromFilename('something_h1')).toBe('H1');
        expect(detectTimeframeFromFilename('weekly_data')).toBe('Weekly');
        expect(detectTimeframeFromFilename('unknown')).toBe('Unknown');
    });

    it('returns timeframe config with tick formatter', () => {
        const cfg = getTimeframeConfig('M1');
        expect(cfg.timeVisible).toBe(true);
        // call the formatter to ensure it runs
        const formatted = cfg.tickMarkFormatter ? cfg.tickMarkFormatter(Math.floor(Date.now() / 1000), 3, 'en-US') : '';
        expect(typeof formatted).toBe('string');
    });

    it('labels, padding, interval and multiplier behave as expected', () => {
        expect(getTimeframeLabel('M1')).toBe('1 Minute');
        expect(getTimeframePadding('M1')).toBeGreaterThan(0);
        expect(getBarIntervalSeconds('M1')).toBe(60);
        expect(getTimeframeMultiplier('H4')).toBe(240);
        expect(getTimeframeLabel('Unknown')).toBe('Unknown');
    });
});
