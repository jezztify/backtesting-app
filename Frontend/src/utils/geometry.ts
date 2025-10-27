import { ChartPoint, Drawing, RectangleDrawing, TrendlineDrawing } from '../types/drawings';

export interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const normalizeRectangle = (start: ChartPoint, end: ChartPoint): Bounds => {
  return {
    left: Math.min(start.time, end.time),
    right: Math.max(start.time, end.time),
    top: Math.max(start.price, end.price),
    bottom: Math.min(start.price, end.price),
  };
};

export const cloneDrawing = (drawing: Drawing): Drawing => {
  if (drawing.type === 'rectangle') {
    const rect = drawing as RectangleDrawing;
    return {
      ...rect,
      start: { ...rect.start },
      end: { ...rect.end },
      style: { ...rect.style },
    };
  }

  const trend = drawing as TrendlineDrawing;
  return {
    ...trend,
    start: { ...trend.start },
    end: { ...trend.end },
    style: { ...trend.style },
  };
};

export const cloneDrawingList = (drawings: Drawing[]): Drawing[] =>
  drawings.map((drawing) => cloneDrawing(drawing));

export interface CanvasPoint {
  x: number;
  y: number;
}

export const isPointInRect = (point: CanvasPoint, rect: { x: number; y: number; width: number; height: number }): boolean => {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
};

export const distanceToSegment = (point: CanvasPoint, start: CanvasPoint, end: CanvasPoint): number => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy);
  const tClamped = clamp(t, 0, 1);
  const projX = start.x + tClamped * dx;
  const projY = start.y + tClamped * dy;
  return Math.hypot(point.x - projX, point.y - projY);
};

export const extendLineToBounds = (
  start: CanvasPoint,
  end: CanvasPoint,
  width: number,
  height: number,
  extendLeft: boolean,
  extendRight: boolean
): { extendedStart: CanvasPoint; extendedEnd: CanvasPoint } => {
  if (!extendLeft && !extendRight) {
    return { extendedStart: start, extendedEnd: end };
  }

  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (Math.abs(dx) < 1e-6) {
    return {
      extendedStart: { x: start.x, y: extendLeft ? 0 : start.y },
      extendedEnd: { x: start.x, y: extendRight ? height : end.y },
    };
  }

  const slope = dy / dx;
  const intercept = start.y - slope * start.x;

  const xLeft = 0;
  const yLeft = slope * xLeft + intercept;
  const xRight = width;
  const yRight = slope * xRight + intercept;

  return {
    extendedStart: extendLeft ? { x: xLeft, y: yLeft } : start,
    extendedEnd: extendRight ? { x: xRight, y: yRight } : end,
  };
};

export const clipLineToBounds = (
  start: CanvasPoint,
  end: CanvasPoint,
  width: number,
  height: number
): { clippedStart: CanvasPoint; clippedEnd: CanvasPoint } | null => {
  // Cohen-Sutherland line clipping algorithm
  const INSIDE = 0; // 0000
  const LEFT = 1;   // 0001
  const RIGHT = 2;  // 0010
  const BOTTOM = 4; // 0100
  const TOP = 8;    // 1000

  const computeOutCode = (x: number, y: number): number => {
    let code = INSIDE;
    if (x < 0) code |= LEFT;
    else if (x > width) code |= RIGHT;
    if (y < 0) code |= TOP;
    else if (y > height) code |= BOTTOM;
    return code;
  };

  let x0 = start.x;
  let y0 = start.y;
  let x1 = end.x;
  let y1 = end.y;

  let outcode0 = computeOutCode(x0, y0);
  let outcode1 = computeOutCode(x1, y1);

  while (true) {
    if (!(outcode0 | outcode1)) {
      // Both points inside
      return { clippedStart: { x: x0, y: y0 }, clippedEnd: { x: x1, y: y1 } };
    } else if (outcode0 & outcode1) {
      // Both points outside same region - line is completely outside
      return null;
    } else {
      // Line crosses boundary - clip it
      const outcodeOut = outcode0 ? outcode0 : outcode1;
      let x: number;
      let y: number;

      if (outcodeOut & TOP) {
        x = x0 + (x1 - x0) * (0 - y0) / (y1 - y0);
        y = 0;
      } else if (outcodeOut & BOTTOM) {
        x = x0 + (x1 - x0) * (height - y0) / (y1 - y0);
        y = height;
      } else if (outcodeOut & RIGHT) {
        y = y0 + (y1 - y0) * (width - x0) / (x1 - x0);
        x = width;
      } else { // LEFT
        y = y0 + (y1 - y0) * (0 - x0) / (x1 - x0);
        x = 0;
      }

      if (outcodeOut === outcode0) {
        x0 = x;
        y0 = y;
        outcode0 = computeOutCode(x0, y0);
      } else {
        x1 = x;
        y1 = y;
        outcode1 = computeOutCode(x1, y1);
      }
    }
  }
};