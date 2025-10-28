import { Candle } from '../types/series';
import { Timeframe } from '../types/series';

/**
 * Get the interval in seconds for a given timeframe
 */
export const getTimeframeIntervalSeconds = (timeframe: Timeframe): number => {
  switch (timeframe) {
    case 'M1': return 60;
    case 'M5': return 300;
    case 'M15': return 900;
    case 'M30': return 1800;
    case 'H1': return 3600;
    case 'H4': return 14400;
    case 'Daily': return 86400;
    case 'Weekly': return 604800;
    case 'Monthly': return 2592000; // Approximate 30 days
    default: return 86400;
  }
};

/**
 * Round a timestamp down to the start of its timeframe period
 */
export const alignTimestampToTimeframe = (timestamp: number, timeframe: Timeframe): number => {
  const interval = getTimeframeIntervalSeconds(timeframe);

  // For Daily, Weekly, Monthly we need special handling (use UTC alignment)
  if (timeframe === 'Daily' || timeframe === 'Weekly' || timeframe === 'Monthly') {
    const date = new Date(timestamp * 1000);

    if (timeframe === 'Daily') {
      // Align to midnight UTC
      date.setUTCHours(0, 0, 0, 0);
      return Math.floor(date.getTime() / 1000);
    }

    if (timeframe === 'Weekly') {
      // Align to Monday midnight UTC
      const dayOfWeek = date.getUTCDay();
      const daysToMonday = (dayOfWeek + 6) % 7; // Days since Monday
      date.setUTCDate(date.getUTCDate() - daysToMonday);
      date.setUTCHours(0, 0, 0, 0);
      return Math.floor(date.getTime() / 1000);
    }

    if (timeframe === 'Monthly') {
      // Align to first day of month midnight UTC
      date.setUTCDate(1);
      date.setUTCHours(0, 0, 0, 0);
      return Math.floor(date.getTime() / 1000);
    }
  }

  // For intraday timeframes, simple modulo alignment
  return Math.floor(timestamp / interval) * interval;
};

/**
 * Aggregate M1 candles into a higher timeframe
 */
export const aggregateCandles = (
  m1Candles: Candle[],
  targetTimeframe: Timeframe
): Candle[] => {
  if (targetTimeframe === 'M1' || m1Candles.length === 0) {
    return m1Candles;
  }

  const aggregated: Candle[] = [];
  const candleMap = new Map<number, Candle>();

  for (const m1Candle of m1Candles) {
    // Skip candles with invalid timestamps
    if (!m1Candle.time || m1Candle.time <= 0) {
      continue;
    }

    const alignedTime = alignTimestampToTimeframe(m1Candle.time, targetTimeframe);

    const existing = candleMap.get(alignedTime);

    if (existing) {
      // Update the aggregated candle
      existing.high = Math.max(existing.high, m1Candle.high);
      existing.low = Math.min(existing.low, m1Candle.low);
      existing.close = m1Candle.close; // Latest close
      existing.volume = (existing.volume || 0) + (m1Candle.volume || 0);
    } else {
      // Create new aggregated candle
      candleMap.set(alignedTime, {
        time: alignedTime,
        open: m1Candle.open,
        high: m1Candle.high,
        low: m1Candle.low,
        close: m1Candle.close,
        volume: m1Candle.volume || 0,
      });
    }
  }

  // Convert map to sorted array
  const sortedKeys = Array.from(candleMap.keys()).sort((a, b) => a - b);
  for (const key of sortedKeys) {
    const candle = candleMap.get(key);
    if (candle) {
      aggregated.push(candle);
    }
  }

  return aggregated;
};

/**
 * Stream aggregate M1 candles - processes in chunks
 */
export const streamAggregateCandles = (
  m1Candles: Candle[],
  targetTimeframe: Timeframe,
  onProgress?: (processed: number, total: number) => void
): Promise<Candle[]> => {
  return new Promise((resolve) => {
    if (targetTimeframe === 'M1' || m1Candles.length === 0) {
      resolve(m1Candles);
      return;
    }

    const candleMap = new Map<number, Candle>();
    const chunkSize = 10000; // Process 10k candles at a time
    let currentIndex = 0;

    const processChunk = () => {
      const endIndex = Math.min(currentIndex + chunkSize, m1Candles.length);

      for (let i = currentIndex; i < endIndex; i++) {
        const m1Candle = m1Candles[i];

        // Skip candles with invalid timestamps
        if (!m1Candle.time || m1Candle.time <= 0) {
          continue;
        }

        const alignedTime = alignTimestampToTimeframe(m1Candle.time, targetTimeframe);

        const existing = candleMap.get(alignedTime);

        if (existing) {
          existing.high = Math.max(existing.high, m1Candle.high);
          existing.low = Math.min(existing.low, m1Candle.low);
          existing.close = m1Candle.close;
          existing.volume = (existing.volume || 0) + (m1Candle.volume || 0);
        } else {
          candleMap.set(alignedTime, {
            time: alignedTime,
            open: m1Candle.open,
            high: m1Candle.high,
            low: m1Candle.low,
            close: m1Candle.close,
            volume: m1Candle.volume || 0,
          });
        }
      }

      currentIndex = endIndex;

      if (onProgress) {
        onProgress(currentIndex, m1Candles.length);
      }

      if (currentIndex < m1Candles.length) {
        // Process next chunk
        setTimeout(processChunk, 0);
      } else {
        // All done - convert to sorted array
        const sortedKeys = Array.from(candleMap.keys()).sort((a, b) => a - b);
        const aggregated: Candle[] = [];
        for (const key of sortedKeys) {
          const candle = candleMap.get(key);
          if (candle) {
            aggregated.push(candle);
          }
        }
        resolve(aggregated);
      }
    };

    processChunk();
  });
};
