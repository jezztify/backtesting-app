# Timeframe & Aggregation — Feature Overview

This document describes supported timeframes, automatic detection, and the aggregation logic used by the chart. Implementation references: `Frontend/src/utils/timeframe.ts`, `Frontend/src/utils/timeframeAggregation.ts`, and `Frontend/src/components/DataLoader.tsx`.

## Supported timeframes

- Minute: `M1`, `M5`, `M15`, `M30`
- Hour: `H1`, `H4`
- Long: `Daily`, `Weekly`, `Monthly`

## Detection

Timeframe detection is performed primarily by filename patterns when loading files via `DataLoader`. The helper `detectTimeframeFromFilename(filename)` implements simple pattern matching and falls back to `Unknown` when no reliable match exists. Users can override the detected timeframe in the UI (if needed).

Common filename hints:
- `M1`, `M5`, `M15`, `M30`, `H1`, `H4`, `D`, `Daily`, `W`, `Weekly`, `MN`

## Aggregation model

Aggregation converts a base series (tick source) into a target display timeframe. The aggregation function used by playback and by normal display is in `timeframeAggregation.ts` and follows these rules:

- Align each tick to the target candle boundary (e.g., floor minute to 15 for M15).
- For each target candle, compute: open (first tick), high (max), low (min), close (last tick), volume (sum).
- For tick playback, aggregation is computed up to `playbackIndex` to produce partially-formed candles.

Function: `aggregateTicksUpToIndex(baseTicks, baseTimeframe, targetTimeframe, upToIndex)`

Performance notes:

- Aggregation is incremental and can be memoized/cached for completed ranges.
- For very large datasets, limit aggregation to a visible window + buffer to reduce CPU and memory use.

## UI adjustments

- X-axis formats are chosen based on timeframe (minute/hour show times; daily+ show dates).
- Default padding (number of bars shown around the play head) is configured per timeframe in `getTimeframePadding(timeframe)`; these values can be tuned in `timeframe.ts`.

## Tests

Unit tests for detection, label formatting, and padding live in `Frontend/src/__tests__/timeframe.test.ts`.

## Tips & future improvements

- Allow manual override when detection fails.
- Add heuristic detection from data spacing as a fallback to filename patterns.
- Support additional custom timeframes (M2/M3/H2) if needed.
