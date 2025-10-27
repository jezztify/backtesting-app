import { Candle, Timeframe } from '../types/series';
import { alignTimestampToTimeframe, getTimeframeIntervalSeconds } from './timeframeAggregation';

/**
 * Aggregate ticks (of any base timeframe) up to a given index into the target timeframe
 * This creates a "live view" of candles as they would form in real-time
 * 
 * @param baseTicks - The tick data (can be M1, M5, M15, etc.)
 * @param baseTimeframe - The timeframe of the base ticks
 * @param targetTimeframe - The timeframe to aggregate into
 * @param upToIndex - Process only ticks up to this index (inclusive)
 */
export const aggregateTicksUpToIndex = (
    baseTicks: Candle[] | null,
    baseTimeframe: Timeframe,
    targetTimeframe: Timeframe,
    upToIndex: number
): Candle[] => {
    // Handle null or empty input
    if (!baseTicks || baseTicks.length === 0 || upToIndex < 0) {
        return [];
    }

    // If target is same as base, just slice
    if (targetTimeframe === baseTimeframe) {
        return baseTicks.slice(0, upToIndex + 1);
    }

    // Check if we're trying to aggregate to a smaller timeframe (not possible)
    const baseInterval = getTimeframeIntervalSeconds(baseTimeframe);
    const targetInterval = getTimeframeIntervalSeconds(targetTimeframe);
    if (targetInterval < baseInterval) {
        // Can't aggregate M15 into M5, for example
        console.warn(`Cannot aggregate ${baseTimeframe} into smaller timeframe ${targetTimeframe}`);
        return baseTicks.slice(0, upToIndex + 1);
    }

    const aggregated: Candle[] = [];
    const candleMap = new Map<number, Candle>();

    // Process only ticks up to the current playback index
    for (let i = 0; i <= Math.min(upToIndex, baseTicks.length - 1); i++) {
        const tick = baseTicks[i];

        // Skip invalid ticks
        if (!tick.time || tick.time <= 0) {
            continue;
        }

        const alignedTime = alignTimestampToTimeframe(tick.time, targetTimeframe);
        const existing = candleMap.get(alignedTime);

        if (existing) {
            // Update existing candle
            existing.high = Math.max(existing.high, tick.high);
            existing.low = Math.min(existing.low, tick.low);
            existing.close = tick.close; // Latest close from this tick
            existing.volume = (existing.volume || 0) + (tick.volume || 0);
        } else {
            // Create new candle
            candleMap.set(alignedTime, {
                time: alignedTime,
                open: tick.open,
                high: tick.high,
                low: tick.low,
                close: tick.close,
                volume: tick.volume || 0,
            });
        }
    }

    // Convert to sorted array
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
 * Calculate how many ticks are needed to form one complete bar
 * in the target timeframe, given a base timeframe
 */
export const getTicksPerBar = (baseTimeframe: Timeframe, targetTimeframe: Timeframe): number => {
    const baseSeconds = getTimeframeIntervalSeconds(baseTimeframe);
    const targetSeconds = getTimeframeIntervalSeconds(targetTimeframe);
    return Math.max(1, Math.floor(targetSeconds / baseSeconds));
};
