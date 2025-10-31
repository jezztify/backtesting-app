import { describe, it, expect } from 'vitest';
import {
    clamp,
    normalizeRectangle,
    cloneDrawing,
    cloneDrawingList,
    isPointInRect,
    distanceToSegment,
    extendLineToBounds,
    clipLineToBounds,
} from '../utils/geometry';

describe('geometry helpers', () => {
    it('clamps values to range', () => {
        expect(clamp(5, 0, 3)).toBe(3);
        expect(clamp(-1, 0, 3)).toBe(0);
        expect(clamp(2, 0, 3)).toBe(2);
    });

    it('normalizes rectangle bounds', () => {
        const a = { time: 10, price: 2 };
        const b = { time: 5, price: 4 };
        const n = normalizeRectangle(a, b);
        expect(n.left).toBe(5);
        expect(n.right).toBe(10);
        expect(n.top).toBe(4);
        expect(n.bottom).toBe(2);
    });

    it('clones drawings and lists deeply', () => {
        const rect: any = { id: 'r', type: 'rectangle', start: { time: 1, price: 1 }, end: { time: 2, price: 2 }, style: { opacity: 0.5 } };
        const clone = cloneDrawing(rect) as any;
        expect(clone).not.toBe(rect);
        expect(clone.start).not.toBe(rect.start);
        const list = cloneDrawingList([rect]);
        expect(list.length).toBe(1);
        expect(list[0]).not.toBe(rect);
    });

    it('detects point in rect correctly', () => {
        const rect = { x: 0, y: 0, width: 10, height: 10 };
        expect(isPointInRect({ x: 5, y: 5 }, rect)).toBe(true);
        expect(isPointInRect({ x: -1, y: 5 }, rect)).toBe(false);
    });

    it('distanceToSegment handles zero-length and projections', () => {
        const start = { x: 0, y: 0 };
        const end = { x: 0, y: 0 };
        expect(distanceToSegment({ x: 3, y: 4 }, start, end)).toBeCloseTo(5);

        const s2 = { x: 0, y: 0 };
        const e2 = { x: 10, y: 0 };
        // point above middle should be distance 5
        expect(distanceToSegment({ x: 5, y: 5 }, s2, e2)).toBeCloseTo(5);
        // point beyond end should measure to end
        expect(distanceToSegment({ x: 20, y: 0 }, s2, e2)).toBeCloseTo(10);
    });

    it('extendLineToBounds returns same when not extending and handles vertical lines', () => {
        const s = { x: 10, y: 10 };
        const e = { x: 20, y: 20 };
        const r1 = extendLineToBounds(s, e, 100, 100, false, false);
        expect(r1.extendedStart).toEqual(s);
        expect(r1.extendedEnd).toEqual(e);

        // vertical line
        const sv = { x: 5, y: 5 };
        const ev = { x: 5, y: 15 };
        const rv = extendLineToBounds(sv, ev, 200, 200, true, true);
        expect(rv.extendedStart.x).toBe(5);
        expect(rv.extendedEnd.x).toBe(5);
        expect(rv.extendedStart.y).toBe(0);
        expect(rv.extendedEnd.y).toBe(200);
    });

    it('clipLineToBounds returns clipped segments or null for outside lines', () => {
        const inside = clipLineToBounds({ x: 10, y: 10 }, { x: 20, y: 20 }, 100, 100);
        expect(inside).not.toBeNull();
        const outside = clipLineToBounds({ x: -200, y: -200 }, { x: -100, y: -100 }, 50, 50);
        expect(outside).toBeNull();
        // crossing boundary
        const cross = clipLineToBounds({ x: -10, y: 10 }, { x: 10, y: 10 }, 5, 20);
        expect(cross).not.toBeNull();
    });
});
