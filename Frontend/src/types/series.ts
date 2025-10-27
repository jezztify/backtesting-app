export interface Candle {
  time: number; // Unix timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type CandleSeries = Candle[];

export type Timeframe = 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'Daily' | 'Weekly' | 'Monthly' | 'Unknown';

export interface TimeframeConfig {
  timeframe: Timeframe;
  timeVisible: boolean;
  secondsVisible: boolean;
  tickMarkFormatter?: (time: number, tickMarkType: number, locale: string) => string;
}