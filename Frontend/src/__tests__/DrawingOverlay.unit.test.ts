import { describe, it, expect } from 'vitest';
import {
  getPositionHandleXs,
  normalizeRectanglePoints,
  clampPositionPrice,
  hasMinimumVerticalSpacing,
  snapToNearestCandleHighLow,
  snapToNearestCandleHigh,
  snapToNearestCandleLow,
} from '../components/DrawingOverlay';

describe('DrawingOverlay helpers', () => {
  it('getPositionHandleXs returns left/right and centers when width <= 0', () => {
    expect(getPositionHandleXs({ x: 10, width: 100 })).toEqual({ left: 10, right: 110 });
    // width 0 -> center
    expect(getPositionHandleXs({ x: 5, width: 0 })).toEqual({ left: 5, right: 5 });
    // negative width -> center behavior
    expect(getPositionHandleXs({ x: 20, width: -40 })).toEqual({ left: 0, right: 0 });
  });

  it('normalizeRectanglePoints orders times and prices', () => {
    const a = { time: 5, price: 10 };
    const b = { time: 2, price: 20 };
    const res = normalizeRectanglePoints(a, b);
    expect(res.start.time).toBe(2);
    expect(res.end.time).toBe(5);
    expect(res.start.price).toBe(10);
    expect(res.end.price).toBe(20);
  });

  it('clampPositionPrice enforces bounds for long and short drawings', () => {
    const longDrawing: any = { type: 'long', point: { price: 1 }, start: { price: 0 }, end: { price: 2 }, takeProfit: 1.5, stopLoss: 0.9 };
    // takeProfit should not go below floor = max(entry, stopLoss)
    expect(clampPositionPrice(longDrawing, 'takeProfit', 0.5)).toBeGreaterThanOrEqual(1);
    // stopLoss should not exceed ceiling = min(entry, takeProfit)
    expect(clampPositionPrice(longDrawing, 'stopLoss', 2)).toBeLessThanOrEqual(1);

    const shortDrawing: any = { type: 'short', point: { price: 1.5 }, start: { price: 1.4 }, end: { price: 1.6 }, takeProfit: 1.4, stopLoss: 1.6 };
    // short takeProfit should be <= entry/stopLoss as defined
    expect(clampPositionPrice(shortDrawing, 'takeProfit', 2)).toBeLessThanOrEqual(1.5);
    // short stopLoss should be >= floor
    expect(clampPositionPrice(shortDrawing, 'stopLoss', 0)).toBeGreaterThanOrEqual(1.5);
  });

  it('hasMinimumVerticalSpacing respects pixel thresholds via converters', () => {
    // converter maps price -> y = price * 10 (bigger price => larger y distance)
    const converters: any = {
      toCanvas: ({ time, price }: any) => ({ x: 0, y: price * 10 }),
    };

  const posWithSL: any = { type: 'long', point: { time: 1, price: 100 }, start: { time: 1, price: 99 }, end: { time: 2, price: 101 }, takeProfit: 101, stopLoss: 99 };

  // takeProfit at 101 => pixel diff = (101-100)*10 = 10, which is less than MIN_POSITION_PIXEL_HEIGHT (12), so should be false
  expect(hasMinimumVerticalSpacing(posWithSL, 'takeProfit', 101, converters)).toBe(false);

  // If there is no stopLoss present, a larger separation should be allowed
  const posNoSL: any = { type: 'long', point: { time: 1, price: 100 }, start: { time: 1, price: 99 }, end: { time: 2, price: 101 }, takeProfit: 101 };
  expect(hasMinimumVerticalSpacing(posNoSL, 'takeProfit', 102, converters)).toBe(true);
  });

  it('snapToNearestCandleHighLow picks the closer high/low and falls back when no candles', () => {
    expect(snapToNearestCandleHighLow(123, 5)).toBe(5);
    const candles: any[] = [
      { time: 100, high: 10, low: 8 },
      { time: 200, high: 20, low: 18 },
    ];
    // time close to first candle, price closer to high
    expect(snapToNearestCandleHighLow(110, 9, candles)).toBe(10);
  // time close to second candle, price equidistant -> function prefers high when distances equal
  expect(snapToNearestCandleHighLow(205, 19, candles)).toBe(20);
  });

  it('snapToNearestCandleHigh/Low return nearest candle high/low or null when empty', () => {
    expect(snapToNearestCandleHigh(1, [])).toBeNull();
    expect(snapToNearestCandleLow(1, [])).toBeNull();
    const candles: any[] = [{ time: 10, high: 100, low: 90 }];
    expect(snapToNearestCandleHigh(9, candles)).toBe(100);
    expect(snapToNearestCandleLow(9, candles)).toBe(90);
  });
});
