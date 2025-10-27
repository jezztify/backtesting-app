export type ToolType = 'select' | 'rectangle' | 'trendline' | 'long' | 'short';

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
}

export interface TrendlineDrawing {
  id: string;
  type: 'trendline';
  start: ChartPoint;
  end: ChartPoint;
  extendLeft: boolean;
  extendRight: boolean;
  style: DrawingStyle & { strokeColor: string; lineWidth: number };
}

export interface PositionStyle extends DrawingStyle {
  strokeColor: string;
  lineWidth: number;
  takeProfitFillColor: string;
  takeProfitFillOpacity: number;
  stopLossFillColor: string;
  stopLossFillOpacity: number;
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
}

export type Drawing = RectangleDrawing | TrendlineDrawing | PositionDrawing;

export interface DraftDrawing {
  type: Drawing['type'];
  start: ChartPoint;
  end: ChartPoint;
}

export interface HitTestResult {
  drawingId: string;
  type: Drawing['type'];
}