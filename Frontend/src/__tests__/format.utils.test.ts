import { describe, it, expect } from 'vitest';
import { determinePriceFormat, formatPrice } from '../utils/format';

describe('format utilities', () => {
  it('determinePriceFormat returns defaults for empty input', () => {
    const out = determinePriceFormat([]);
    expect(out.precision).toBe(2);
    expect(out.minMove).toBe(0.01);
  });

  it('determinePriceFormat computes precision from values and minMove', () => {
    const values = [1, 1.5, 1.75, 2.0];
    const out = determinePriceFormat(values);
    // Values have up to 2 decimal places, so precision should be at least 2
    expect(out.precision).toBeGreaterThanOrEqual(2);
    expect(out.minMove).toBeGreaterThan(0);
  });

  it('formatPrice returns empty string for invalid values and formatted string for valid', () => {
    expect(formatPrice(undefined as any, 2)).toBe('');
    expect(formatPrice(NaN as any, 2)).toBe('');
    expect(formatPrice(1.2345, 2)).toBe('1.23');
    expect(formatPrice(1, 4)).toBe('1.0000');
  });
});
