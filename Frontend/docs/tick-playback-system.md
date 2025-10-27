# Tick-by-Tick Playback System

## Overview

The tick-by-tick playback system allows you to watch candles form progressively in real-time during playback, providing a realistic backtesting experience. Instead of showing pre-aggregated completed candles, the system builds candles incrementally as each tick arrives.

## Architecture

### Key Components

#### 1. **State Management** (`App.tsx`)

```typescript
// Raw M1 data (finest granularity available)
const [rawM1Candles, setRawM1Candles] = useState<Candle[] | null>(null);

// Current tick source data (can be M1, M5, M15, etc.)
const [tickSourceData, setTickSourceData] = useState<Candle[] | null>(null);

// Pre-aggregated candles for display timeframe
const [candles, setCandles] = useState<Candle[]>(sampleData);

// Enable/disable tick playback mode
const [useTickPlayback, setUseTickPlayback] = useState<boolean>(false);

// Current tick index (0 to tickSourceData.length-1)
const [playbackIndex, setPlaybackIndex] = useState<number>(0);
```

#### 2. **Display Candles Calculation** (Real-time)

```typescript
const displayCandles = useMemo(() => {
  if (!useTickPlayback || !tickSourceData || tickSource === timeframe) {
    // Normal mode: show pre-aggregated candles
    return candles;
  }

  // Tick playback mode: aggregate progressively up to playbackIndex
  return aggregateTicksUpToIndex(tickSourceData, tickSource, timeframe, playbackIndex);
}, [useTickPlayback, tickSourceData, tickSource, timeframe, playbackIndex, candles]);
```

#### 3. **Playback Loop** (Tick-based)

```typescript
useEffect(() => {
  if (!isPlaying) return;
  
  const intervalMs = 1000 / tickRate; // e.g., 10 ticks/sec = 100ms
  
  const interval = setInterval(() => {
    setPlaybackIndex((index) => {
      const maxIdx = useTickPlayback && tickSourceData 
        ? tickSourceData.length - 1 
        : candles.length - 1;
      
      return index >= maxIdx ? index : index + 1;
    });
  }, intervalMs);
  
  return () => clearInterval(interval);
}, [isPlaying, tickRate, useTickPlayback, tickSourceData, candles.length]);
```

## How It Works

### Example Scenario: M15 Chart with M1 Tick Source

**Settings:**
- **Display Timeframe:** M15
- **Tick Source:** M1
- **Tick Rate:** 10 ticks/sec

**Playback Flow:**

1. **Initial State** (playbackIndex = 0)
   - System shows 0 M1 ticks
   - No M15 candles visible yet

2. **After 1 tick** (playbackIndex = 1)
   - 1 M1 tick processed
   - First M15 candle appears (incomplete, only 1/15 ticks)
   - Candle shows: open = tick1.close, high = tick1.high, low = tick1.low, close = tick1.close

3. **After 5 ticks** (playbackIndex = 5)
   - 5 M1 ticks processed
   - M15 candle updates (5/15 ticks complete)
   - high/low expand to include all 5 ticks, close = tick5.close

4. **After 15 ticks** (playbackIndex = 15)
   - 15 M1 ticks processed = 1 complete M15 candle
   - Second M15 candle starts forming

5. **After 20 ticks** (playbackIndex = 20)
   - First M15 candle complete (ticks 1-15)
   - Second M15 candle forming (ticks 16-20, incomplete at 5/15)

### Visual Representation

```
Time  ->  0    1    2    3    4    5   ...  15   16   17  ...  30
          |-------- M15 Candle 1 ---------|-------- M15 Candle 2 ---------|
Ticks ->  T1   T2   T3   T4   T5   T6  ... T15  T16  T17 ... T30
          ^    ^    ^                      ^    ^
          |    |    |                      |    |
     Candle   Open, High updated    Complete  New candle
     starts   Low, Close updated    candle    starts
```

## User Controls

### 1. Tick Rate Control

**Purpose:** Control how fast ticks are played back

**Options:** 1, 2, 5, 10, 20, 50, 100 ticks/second

**Formula:** `interval (ms) = 1000 / tickRate`

**Examples:**
- 1 tick/sec = 1000ms interval (very slow)
- 10 ticks/sec = 100ms interval (default)
- 100 ticks/sec = 10ms interval (very fast)

### 2. Tick Source Control

**Purpose:** Choose which timeframe to use as tick data

**Available Options:** Any timeframe finer than display timeframe

**Examples:**
- Display M15 → Available sources: M1, M5
- Display H1 → Available sources: M1, M5, M15, M30
- Display Daily → Available sources: M1, M5, M15, M30, H1, H4

**Use Cases:**
- M1 ticks: Maximum granularity, slowest playback (most ticks per candle)
- M5 ticks: Good balance for M15/M30 charts
- M15 ticks: Faster playback for H1/H4 charts

### 3. Display Timeframe Control

**Purpose:** Choose what candle timeframe to display

**Options:** M1, M5, M15, M30, H1, H4, Daily, Weekly, Monthly

**Auto-adjustment:** When you change display timeframe to a finer granularity than current tick source, the tick source automatically adjusts to M1

## Performance Optimization

### Memoization

The `displayCandles` calculation uses `useMemo` to avoid unnecessary re-aggregation:

```typescript
const displayCandles = useMemo(() => {
  // Only recalculates when dependencies change
  return aggregateTicksUpToIndex(tickSourceData, tickSource, timeframe, playbackIndex);
}, [useTickPlayback, tickSourceData, tickSource, timeframe, playbackIndex, candles]);
```

### Efficient Aggregation

The `aggregateTicksUpToIndex` function uses a `Map` for efficient updates:

```typescript
export const aggregateTicksUpToIndex = (
  baseTicks: Candle[],
  baseTimeframe: Timeframe,
  targetTimeframe: Timeframe,
  upToIndex: number
): Candle[] => {
  const candleMap = new Map<number, Candle>();
  
  // Only process ticks up to upToIndex
  for (let i = 0; i <= upToIndex && i < baseTicks.length; i++) {
    const tick = baseTicks[i];
    const alignedTime = alignTimestampToTimeframe(tick.time, targetTimeframe);
    
    const existing = candleMap.get(alignedTime);
    if (!existing) {
      // First tick in this candle
      candleMap.set(alignedTime, { ...tick, time: alignedTime });
    } else {
      // Update existing candle
      existing.high = Math.max(existing.high, tick.high);
      existing.low = Math.min(existing.low, tick.low);
      existing.close = tick.close;
      existing.volume = (existing.volume || 0) + (tick.volume || 0);
    }
  }
  
  return Array.from(candleMap.values()).sort((a, b) => a.time - b.time);
};
```

## Data Flow

```
┌─────────────┐
│ Load CSV    │
│ (M1 data)   │
└──────┬──────┘
       │
       ▼
┌──────────────────────┐
│ rawM1Candles         │
│ (8.6M M1 candles)    │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐     User selects
│ Aggregate M1 → M5    │ ◄── Tick Source: M5
│ tickSourceData       │
│ (1.7M M5 candles)    │
└──────┬───────────────┘
       │
       ├─────────────────────────────┐
       │                             │
       ▼                             ▼
┌──────────────────┐          ┌──────────────────────┐
│ Pre-aggregate    │          │ Real-time aggregate  │
│ M5 → M15         │          │ M5 → M15             │
│ candles          │          │ displayCandles       │
│ (570k M15)       │          │ (progressive)        │
│ (stored)         │          │ (computed)           │
└──────────────────┘          └───────┬──────────────┘
                                      │
                                      ▼
                              ┌──────────────────┐
                              │ Chart Display    │
                              │ (shows forming   │
                              │  candles)        │
                              └──────────────────┘
```

## Benefits

### 1. Realistic Backtesting
- See how candles actually formed during the time period
- Watch high/low extremes develop
- Understand intra-candle price action

### 2. Flexible Granularity
- Choose appropriate tick source for your analysis
- Balance between detail and playback speed
- M1 for maximum detail, M5/M15 for faster review

### 3. Educational Value
- Learn how larger timeframes aggregate from smaller ones
- Understand relationship between timeframes
- See how price action develops in real-time

### 4. Testing Trading Strategies
- Test entry timing within candles
- Validate stop-loss and take-profit levels
- See how strategy would perform with realistic price movement

## Technical Details

### Time Alignment

Each tick is aligned to its parent candle based on the target timeframe:

- **M1 → M15:** Align to 0, 15, 30, 45 minutes
- **M1 → H1:** Align to top of each hour
- **M1 → Daily:** Align to midnight UTC
- **M1 → Weekly:** Align to Monday 00:00 UTC
- **M1 → Monthly:** Align to 1st day of month 00:00 UTC

### Candle Update Logic

When a new tick arrives in an existing candle:
1. **Open:** Unchanged (first tick's open)
2. **High:** `Math.max(existing.high, tick.high)`
3. **Low:** `Math.min(existing.low, tick.low)`
4. **Close:** `tick.close` (last tick's close)
5. **Volume:** `existing.volume + tick.volume`

### Index Management

**Normal Mode:**
- `playbackIndex` refers to index in `candles` array
- `maxIndex = candles.length - 1`
- Chart shows `candles[0...playbackIndex]`

**Tick Playback Mode:**
- `playbackIndex` refers to index in `tickSourceData` array
- `maxIndex = tickSourceData.length - 1`
- Chart shows `aggregateTicksUpToIndex(tickSourceData, tickSource, timeframe, playbackIndex)`

## Future Enhancements

### Possible Improvements

1. **Tick Speed Presets**
   - Add named presets: "Slow", "Normal", "Fast", "Very Fast"
   - Map to appropriate tick rates for different timeframes

2. **Visual Indicators**
   - Show "Building..." indicator on incomplete candles
   - Display tick count progress (e.g., "12/15 ticks")
   - Highlight newly formed candles

3. **Performance**
   - Implement virtual scrolling for very large datasets
   - Add tick range limiting (only load visible range + buffer)
   - Cache aggregation results for common playback ranges

4. **Advanced Controls**
   - "Skip to next complete candle" button
   - "Play until pattern" feature
   - Adjustable playback speed during playback

5. **Analytics**
   - Show tick-by-tick statistics
   - Display intra-candle volatility metrics
   - Generate heat maps of tick distribution

## Troubleshooting

### Issue: Playback is too slow
**Solution:** Increase tick rate (try 20, 50, or 100 ticks/sec)

### Issue: Playback is too fast
**Solution:** Decrease tick rate (try 5, 2, or 1 tick/sec) or use coarser tick source

### Issue: Not enough detail in candles
**Solution:** Use M1 tick source for maximum granularity

### Issue: Too many ticks, playback takes too long
**Solution:** Use coarser tick source (M5 instead of M1, or M15 instead of M5)

### Issue: Performance degradation
**Solution:** 
- Use coarser tick source
- Reduce tick rate
- Check browser memory usage
- Consider implementing range limiting

## Summary

The tick-by-tick playback system provides a sophisticated and realistic way to review historical price data. By progressively building candles from finer-grained tick data, users can see exactly how price action developed, making it ideal for backtesting, education, and strategy development.

**Key Formula:**
```
Display Candles = aggregateTicksUpToIndex(
  tickSourceData[tickSource],
  tickSource,
  displayTimeframe,
  playbackIndex
)

Playback Interval = 1000ms / tickRate
```

**Remember:**
- Tick Source must be ≤ Display Timeframe
- Higher tick rate = faster playback
- Finer tick source = more detail, slower playback
- Use tick playback for realistic backtesting experience
