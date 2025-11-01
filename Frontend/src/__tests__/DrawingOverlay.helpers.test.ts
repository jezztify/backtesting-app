import {
  getRectangleHandlePositions,
  getRectangleChartCorners,
  getRectangleOppositeCorner,
  getPositionHandleXs,
  clampPositionPrice,
  hasMinimumVerticalSpacing,
  normalizeRectanglePoints,
  getPointerPosition,
  snapToNearestCandleHighLow,
  snapToNearestCandleHigh,
  snapToNearestCandleLow,
} from '../components/DrawingOverlay';

describe('DrawingOverlay helpers', () => {
  it('calculates rectangle handle positions', () => {
    const rect = { x: 10, y: 20, width: 40, height: 60 };
    const pos = getRectangleHandlePositions(rect as any);
    expect(pos['top-left']).toEqual({ x: 10, y: 20 });
    expect(pos['top-right']).toEqual({ x: 50, y: 20 });
    expect(pos['bottom-left']).toEqual({ x: 10, y: 80 });
    expect(pos['middle-right']).toEqual({ x: 50, y: 50 });
  });

  it('computes chart corners and opposite corner mapping', () => {
    const a = { time: 1, price: 100 };
    const b = { time: 3, price: 90 };
    const corners = getRectangleChartCorners(a as any, b as any);
    // min time =1, max time=3, min price=90, max price=100
    expect(corners['top-left']).toEqual({ time: 1, price: 100 });
    expect(corners['bottom-right']).toEqual({ time: 3, price: 90 });

    const opp = getRectangleOppositeCorner('top-left', a as any, b as any);
    // opposite of top-left is bottom-right
    expect(opp).toEqual({ time: 3, price: 90 });
  });

  it('returns position handle xs and handles zero/negative widths', () => {
    const rect = { x: 5, width: 20 };
    expect(getPositionHandleXs(rect as any)).toEqual({ left: 5, right: 25 });

    const zero = { x: 10, width: 0 };
    expect(getPositionHandleXs(zero as any)).toEqual({ left: 10, right: 10 });

    const neg = { x: 10, width: -4 };
    // center for negative width
    expect(getPositionHandleXs(neg as any)).toEqual({ left: 8, right: 8 });
  });

  it('clamps position prices for long and short drawings', () => {
    const long = { type: 'long', point: { price: 100 }, takeProfit: 110, stopLoss: 95 } as any;
    expect(clampPositionPrice(long, 'takeProfit', 90)).toBe(100); // floor = max(entry, stopLoss) = 100
    expect(clampPositionPrice(long, 'stopLoss', 105)).toBe(100); // ceiling = min(entry, tp) = 100
    expect(clampPositionPrice(long, 'point', 500)).toBe(110); // bounded by tp

    const short = { type: 'short', point: { price: 100 }, takeProfit: 90, stopLoss: 105 } as any;
    expect(clampPositionPrice(short, 'takeProfit', 105)).toBe(100); // ceiling
    expect(clampPositionPrice(short, 'stopLoss', 80)).toBe(100); // floor
    expect(clampPositionPrice(short, 'point', 0)).toBe(90); // bounded by tp
  });

  it('checks minimum vertical spacing using converters', () => {
    // converters map price -> canvas y = price * 10
    const converters = {
      toCanvas: ({ price }: any) => ({ x: 0, y: price * 10 }),
      toChart: () => null,
    } as any;

  const drawing = { type: 'long', point: { time: 0, price: 100 }, takeProfit: 102, stopLoss: 99 } as any;

  // candidate price that yields less than MIN_POSITION_PIXEL_HEIGHT difference (12px)
  expect(hasMinimumVerticalSpacing(drawing, 'takeProfit', 100.5, converters)).toBe(false);

  // Use a drawing with larger vertical spacing so the check returns true
  const drawingWide = { type: 'long', point: { time: 0, price: 100 }, takeProfit: 140, stopLoss: 60 } as any;
  expect(hasMinimumVerticalSpacing(drawingWide, 'takeProfit', 105, converters)).toBe(true);
  });

  it('normalizes rectangle points', () => {
    const a = { time: 10, price: 200 };
    const b = { time: 5, price: 150 };
    const normalized = normalizeRectanglePoints(a as any, b as any);
    expect(normalized.start).toEqual({ time: 5, price: 150 });
    expect(normalized.end).toEqual({ time: 10, price: 200 });
  });

  it('computes pointer position relative to element rect', () => {
    const target: any = {
      getBoundingClientRect: () => ({ left: 10, top: 20 }),
    };
    const ev: any = { currentTarget: target, clientX: 15, clientY: 30 };
    const pos = getPointerPosition(ev as any);
    expect(pos).toEqual({ x: 5, y: 10 });
  });

  it('snaps to nearest candle highs/lows', () => {
    const candles = [
      { time: 1000, high: 110, low: 90, open: 95, close: 105, volume: 1 },
      { time: 2000, high: 210, low: 190, open: 195, close: 205, volume: 1 },
    ];

    // nearest to time 1005 is first candle; price 100 is equidistant to high/low -> high chosen
    expect(snapToNearestCandleHighLow(1005, 100, candles as any)).toBe(110);
    // closer to low
    expect(snapToNearestCandleHighLow(1005, 95, candles as any)).toBe(90);

    // snap high/low functions
    expect(snapToNearestCandleHigh(1005, candles as any)).toBe(110);
    expect(snapToNearestCandleLow(1005, candles as any)).toBe(90);

    // empty candles -> return original / null
    expect(snapToNearestCandleHighLow(1, 50, [])).toBe(50);
    expect(snapToNearestCandleHigh(1, [])).toBeNull();
    expect(snapToNearestCandleLow(1, [])).toBeNull();
  });
});
