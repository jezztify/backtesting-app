export type ToolType = 'select' | 'rectangle' | 'trendline' | 'long' | 'short' | 'volumeProfile';

export type ChartTime = number;

export interface ChartPoint {
  time: ChartTime;
  price: number;
}

export interface DrawingStyle {
  strokeColor: string;
  strokeOpacity?: number;
  fillColor?: string;
  lineWidth?: number;
  opacity?: number;
}

export interface RectangleDrawing {
  id: string;
  type: 'rectangle';
  start: ChartPoint;
  end: ChartPoint;
  style: DrawingStyle & { fillColor: string; opacity: number; strokeOpacity: number };
  midline?: boolean; // If true, draw a midline through the rectangle
  // Optional link to a trading order id created from this drawing
  linkedOrderId?: string;
}

export interface VolumeProfileDrawing {
  id: string;
  type: 'volumeProfile';
  start: ChartPoint; // left/top corner (time, price)
  end: ChartPoint; // right/bottom corner (time, price)
  buckets?: number; // number of price bins (overridden by rowSize if provided)
  // Number of rows (bins) to display. If set, overrides the `buckets` setting.
  rowCount?: number;
  style: DrawingStyle & {
    fillColor?: string;
    strokeColor?: string;
    opacity?: number;
    // Up/Down specific colors and opacities
    upFillColor?: string;
    downFillColor?: string;
    upOpacity?: number;
    downOpacity?: number;
  };
}

export interface TrendlineDrawing {
  id: string;
  type: 'trendline';
  start: ChartPoint;
  end: ChartPoint;
  extendLeft: boolean;
  extendRight: boolean;
  style: DrawingStyle & { strokeColor: string; lineWidth: number };
  // Optional link to a trading order id created from this drawing
  linkedOrderId?: string;
}

export interface PositionStyle extends DrawingStyle {
  strokeColor: string;
  lineWidth: number;
  takeProfitFillColor: string;
  takeProfitFillOpacity: number;
  stopLossFillColor: string;
  stopLossFillOpacity: number;
  // When true, render the computed Risk/Reward ratio on the chart as part of the position drawing
  showRiskReward?: boolean;
}

export interface PositionDrawing {
  id: string;
  type: 'long' | 'short';
  point: ChartPoint; // Entry point
  start: ChartPoint; // Rectangle start (for visual bounds)
  end: ChartPoint; // Rectangle end (for visual bounds)
  stopLoss?: number; // Stop loss price
  takeProfit?: number; // Take profit price
  style: PositionStyle;
  // Optional link to a trading order id created from this drawing
  linkedOrderId?: string;
}

export type Drawing = RectangleDrawing | TrendlineDrawing | PositionDrawing | VolumeProfileDrawing;

export interface DraftDrawing {
  type: Drawing['type'];
  start: ChartPoint;
  end: ChartPoint;
}

export interface HitTestResult {
  drawingId: string;
  type: Drawing['type'];
}