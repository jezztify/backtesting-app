import { describe, it, expect } from 'vitest';
import { computeValuePrecision, formatNumberToPrecision, determinePriceFormat, formatPrice } from '../utils/format';

describe('format utilities', () => {
    it('computeValuePrecision handles finite and non-finite values', () => {
        expect(computeValuePrecision(1)).toBeGreaterThanOrEqual(0);
        expect(computeValuePrecision(0.00001)).toBeGreaterThanOrEqual(1);
        expect(computeValuePrecision(NaN)).toBe(0);
        expect(computeValuePrecision(Infinity)).toBe(0);
    });

    it('formatNumberToPrecision rounds correctly', () => {
        expect(formatNumberToPrecision(1.23456, 2)).toBe(1.23);
        expect(formatNumberToPrecision(1.23556, 2)).toBe(1.24);
    });

    it('determinePriceFormat returns defaults for empty input', () => {
        expect(determinePriceFormat([])).toEqual({ type: 'price', precision: 2, minMove: 0.01 });
    });

    it('determinePriceFormat computes precision and minMove', () => {
        const values = [1.23, 1.24, 1.235, 1.2355];
        const result = determinePriceFormat(values);
        expect(result.type).toBe('price');
        expect(result.precision).toBeGreaterThanOrEqual(2);
        expect(result.minMove).toBeGreaterThan(0);
    });

    it('formatPrice handles undefined/null and finite numbers', () => {
        expect(formatPrice(undefined, 2)).toBe('');
        expect(formatPrice(null as any, 2)).toBe('');
        expect(formatPrice(1.2345, 3)).toBe('1.234');
    });
});
