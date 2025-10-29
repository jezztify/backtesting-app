import { Candle } from '../types/series';

const DAYS_TO_SECONDS = 24 * 60 * 60;

const generateSampleCandles = (): Candle[] => {
  const candles: Candle[] = [];
  let lastClose = 42000;
  const startTime = Math.floor(Date.UTC(2024, 0, 1) / 1000);

  for (let i = 0; i < 200; i += 1) {
    const time = startTime + i * DAYS_TO_SECONDS;
    const volatility = Math.sin(i / 12) * 800 + Math.random() * 400;
    const open = lastClose;
    const direction = Math.random() > 0.5 ? 1 : -1;
    const close = open + direction * (Math.random() * volatility);
    const high = Math.max(open, close) + Math.random() * 200;
    const low = Math.min(open, close) - Math.random() * 200;
    const volume = 500 + Math.random() * 250;

    candles.push({ time, open, high, low, close, volume });
    lastClose = close;
  }

  return candles;
};

export const SAMPLE_DATASET_ID = 'sample-btcusd-daily';

export const sampleData: Candle[] = generateSampleCandles();

export const buildDatasetId = (label: string): string =>
  label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

export default sampleData;