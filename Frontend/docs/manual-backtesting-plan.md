# Backtesting Workspace — Plan & Architecture

This document summarizes the design, scope, and implementation plan for the Backtesting Workspace (frontend). It complements the user-facing docs and maps behaviors to the source code under `Frontend/src/`.

## Goals

- Provide a compact, browser-based environment for manual backtesting and chart annotation.
- Let users replay historical data (tick-by-tick), annotate price action with drawing tools, and place simulated positions.
- Keep the codebase modular and testable so features can be extended (indicators, strategy simulation, cloud sync).

## Success Criteria

- Clear, responsive chart interactions with multiple timeframes and smooth playback.
- Drawing tools (Rectangle, Trendline, Position) that are editable, persistent, and keyboard-friendly.
- Reliable persistence and straightforward import/export of datasets and drawing state.

## Key Components (mapped to code)

- Chart core: `Frontend/src/components/ChartContainer.tsx` (wraps `lightweight-charts`)
- Playback: `Frontend/src/utils/tickPlayback.ts` and `Frontend/src/components/PlaybackControls.tsx`
- Timeframe aggregation: `Frontend/src/utils/timeframeAggregation.ts` and `Frontend/src/utils/timeframe.ts`
- Drawing & interaction layer: `Frontend/src/components/DrawingOverlay.tsx`, `Frontend/src/components/ToolSidebar.tsx`
- Position handling: `Frontend/src/components/TradingPanel.tsx` and `Frontend/src/state/tradingStore.ts`
- Persistence: `Frontend/src/services/persistence.ts`
- State stores: `Frontend/src/state/*` (canvasStore, drawingStore, tradingStore)

## High-level Data Flow

1. User loads dataset (JSON/CSV) via `DataLoader` → normalized OHLCV array
2. Playback engine or direct chart setData updates the `lightweight-charts` series
3. Drawing tools read/write geometry in chart coordinates and persist to `drawingStore`
4. Autosave writes layout + drawings to `localStorage` via `persistence.ts`

## Phased Roadmap (short)

- Phase A — Core chart + sample data: render candles, basic playback, theme toggle
- Phase B — Drawing layer MVP: Rectangle + Trendline, selection, properties modal
- Phase C — Position tool + trading panel: visual positions and simple PnL calc
- Phase D — Polish: undo/redo, keyboard shortcuts, tests, documentation

## Testing & Validation

- Unit tests for aggregation & geometry (`Frontend/src/__tests__`)
- Manual/automated integration tests for drawing flows (planned Playwright)
- Performance profiling for redraw cycles and playback rates

## Next steps / Wishlist

- Add dataset-picker + server-backed datasets
- Expand drawing toolset (Fibonacci, channels, text)
- Add export/import presets for user styles
- Add a lightweight metrics panel to log manual trades

---

References: `Frontend/docs/` and inline code comments in `Frontend/src/`.
