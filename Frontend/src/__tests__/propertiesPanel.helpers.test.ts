import { describe, it, expect } from 'vitest';
import { clampLineWidth, parseFibonacciLevels, formatLevelsDisplay } from '../utils/propertiesPanel.helpers';

describe('PropertiesPanel helpers', () => {
  it('clampLineWidth constrains values between 1 and 8', () => {
    expect(clampLineWidth(0)).toBe(1);
    expect(clampLineWidth(1)).toBe(1);
    expect(clampLineWidth(4.5)).toBe(4.5);
    expect(clampLineWidth(9)).toBe(8);
  });

  it('parseFibonacciLevels parses percent and decimal and integer strings', () => {
    expect(parseFibonacciLevels('')).toEqual([]);
    expect(parseFibonacciLevels('50%')).toEqual([0.5]);
    expect(parseFibonacciLevels('0.236, 0.382, .5')).toEqual([0.236, 0.382, 0.5]);
    expect(parseFibonacciLevels('50,100')).toEqual([0.5, 1]);
    expect(parseFibonacciLevels('10% 20% 0.3')).toEqual([0.1, 0.2, 0.3]);
    // invalid tokens are ignored
    expect(parseFibonacciLevels('abc, 50%')).toEqual([0.5]);
  });

  it('formatLevelsDisplay returns human-friendly percent strings', () => {
    expect(formatLevelsDisplay([0, 0.236, 1])).toBe('0%, 23.6%, 100%');
    expect(formatLevelsDisplay()).toBe('0%, 23.6%, 38.2%, 50.0%, 61.8%, 78.6%, 100%');
  });
});
