# Tick Playback System — Design & Usage

This document explains the tick-by-tick playback system used to progressively build candles from finer-grained data. Implementation references: `Frontend/src/utils/tickPlayback.ts`, `Frontend/src/utils/timeframeAggregation.ts`, and `Frontend/src/components/PlaybackControls.tsx`.

## Purpose

Play back historical data at variable speeds while showing in-progress candles built from a tick source (for example, building M15 candles from an M1 tick feed). This provides a realistic view of intra-candle movement useful for testing timing-sensitive entries and exits.

## Core concepts

- Tick source: the fine-grained series used as the input (typically M1 or similar).
- Display timeframe: the timeframe shown on the chart (M15, H1, Daily, ...).
- playbackIndex: the current index into the tick source (how many ticks have been processed).
- tickRate: how many ticks per second are advanced while playing.

## How it works (simple)

1. Load a tick source (e.g., M1 array).
2. While playing, increment `playbackIndex` at interval `1000 / tickRate` ms.
3. Compute display candles by aggregating ticks up to `playbackIndex` into the display timeframe using `aggregateTicksUpToIndex`.
4. Render these partially-formed candles on the chart.

See `aggregateTicksUpToIndex(baseTicks, baseTimeframe, targetTimeframe, upToIndex)` in `timeframeAggregation.ts` for the aggregation logic.

## Controls exposed to users

- Play / Pause (space)
- Step forward / backward (arrow keys)
- Tick Rate (1,2,5,10,20,50,100 ticks/sec)
- Tick Source selector (only sources finer than the display timeframe are available)
- Toggle: Tick Playback Mode (on/off)

## Performance & implementation notes

- Use `useMemo` to avoid re-aggregating the full dataset on every render; only re-compute when `playbackIndex`, `tickSourceData`, or `displayTimeframe` change.
- Keep aggregation incremental: process ticks up to `upToIndex` only. Caching results for completed ranges improves speed when seeking back and forth.
- Limit the visible range to a sliding window around the play head to reduce rendering overhead for very large datasets.

## Practical tips

- For high-detail inspection, use M1 as tick source. For faster review, choose a coarser tick source (M5/M15).
- If playback is CPU-bound, reduce `tickRate` or use a coarser tick source.

## Troubleshooting

- Playback stalls: check `tickSourceData` length and browser performance; lowering `tickRate` often helps.
- Unexpected candle shapes: confirm the alignment function `alignTimestampToTimeframe` in `timeframe.ts`.

## Future ideas

- Visual indicators for building candles (tick counters, progress bars).
- Preset speed modes (Slow/Normal/Fast) that map to tickRate values per display timeframe.
- Caching of aggregated ranges to support instant seeks.
