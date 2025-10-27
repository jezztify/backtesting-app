import { describe, expect, it } from 'vitest';
import { distanceToSegment, extendLineToBounds, isPointInRect } from '../utils/geometry';

describe('geometry helpers', () => {
  it('computes point inside rectangle', () => {
    const inside = isPointInRect({ x: 15, y: 15 }, { x: 10, y: 10, width: 20, height: 20 });
    const outside = isPointInRect({ x: 5, y: 5 }, { x: 10, y: 10, width: 20, height: 20 });
    expect(inside).toBe(true);
    expect(outside).toBe(false);
  });

  it('measures distance to line segment', () => {
    const distance = distanceToSegment({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(distance).toBeCloseTo(5, 4);
  });

  it('extends trendline to canvas bounds', () => {
    const { extendedStart, extendedEnd } = extendLineToBounds(
      { x: 50, y: 50 },
      { x: 100, y: 100 },
      200,
      200,
      true,
      true
    );
    expect(extendedStart.x).toBeCloseTo(0, 1);
    expect(extendedEnd.x).toBeCloseTo(200, 1);
  });
});