# Backtesting Workspace

Lightweight prototype for a Backtesting Workspace with a TradingView-like chart, drawing tools, and a tick playback system.

> Educational / prototype software — use at your own risk. Contributions and issues are welcome.

## Quick start

1. Start the dev server (from repo root):
```bash
./scripts/start-dev.sh
```

2. Build for production:

```bash
npm run build
```

3. Run tests:

```bash
npm test
```

The Vite dev server runs on http://localhost:5173 by default.

## At-a-glance features (current)

- Interactive chart powered by `lightweight-charts` (React + TypeScript).
- Multi-layout support: single or dual chart view. In dual view you can independently choose timeframes for each chart and drag the vertical resizer to adjust their relative widths.
- Multiple timeframes and aggregation: Tick, M1, M5, M15, H1, H4, Daily, Weekly (see `src/utils/timeframeAggregation.ts`).
- Tick playback system: play/pause, step forward/backward, adjustable tick rate, tick-source selection and progressive aggregation (see `src/utils/tickPlayback.ts`).
- Drawing tools: Select, Rectangle, Trendline, Fibonacci, Volume Profile, Position (Long/Short). Drawings are stored in a global drawing store and persist to workspace state.
- Drawing persistence & defaults: last-used style for tools (for example Fibonacci levels and Volume Profile style) are persisted and used to seed new drawings.
- Robust import: DataLoader accepts Twelve Data JSON, Dukascopy (including arrays-of-arrays format), and exported JSON files produced by the Import Market Data panel.
- Drawing overlay sizing fix: the SVG overlay is sized to the chart canvas (does not cover chart axes) to avoid visual interference with axis labels and hit-testing.
- Timeframe selectors: moved inside each chart canvas area (left/right) in dual layout for clearer context.
- Compact header & control placement: header controls were compacted to fit a thin header and the Layout selector moved next to Load Market Data.
- Bottom panel rework: playback controls and trading panel are separated but grouped inside a single `.bottom-panel` area (playback on top, trading panel below).
- Trading panel: simulated account with starting balance, equity, realized & unrealized P&L; supports position placement and resizing of the panel area.
- Tool icons: UI uses Material Symbols Outlined for several icons (e.g., trendline, Fibonacci, Volume Profile). If your environment needs the font, add the Google stylesheet to `index.html`.
- State management: lightweight global stores using `zustand` (`src/state/*`).
- Persistence: workspace (drawings, preferences) save/load via `src/services/persistence.ts` (localStorage-backed).
- Tests: Vitest unit/smoke tests live under `Frontend/src/__tests__` and cover core utilities, aggregation logic and stores.

## Importing Market Data

Use the Import Market Data panel to fetch Twelve Data time-series and save JSON for import. The `DataLoader` also recognizes Dukascopy JSON and several common local JSON shapes.

- Recommended: use the Import Market Data panel to fetch and save provider JSON, then import via the Load Market Data control.
- Dukascopy: arrays-of-arrays and object formats are supported. Very large Dukascopy files may be heavy for unit tests or the browser; consider chunking or server-side preprocessing for huge ranges.

## UI overview (file pointers)

- Chart area: `Frontend/src/components/ChartContainer.tsx` — main chart + converters.
- Drawing overlay: `Frontend/src/components/DrawingOverlay.tsx` — SVG overlay sized to canvas.
- Tool sidebar: `Frontend/src/components/ToolSidebar.tsx` — tools and icons.
- Playback controls: `Frontend/src/components/PlaybackControls.tsx` — play/pause/seek UI.
- Market data import & loader: `Frontend/src/components/MarketDataPanel.tsx`, `Frontend/src/components/DataLoader.tsx`.
- Trading panel: `Frontend/src/components/TradingPanel.tsx` and store `Frontend/src/state/tradingStore.ts`.
- Persistence: `Frontend/src/services/persistence.ts`.
- Utilities: CSV parsing, geometry and timeframe helpers in `Frontend/src/utils/`.

## Keyboard shortcuts

- V — Select tool
- R — Rectangle tool
- T — Trendline tool
- F — Fibonacci tool
- P — Volume Profile tool
- Space — Play / Pause playback
- ← / → — Step backward / forward one tick
- Delete / Backspace — Delete selected drawing
- Cmd/Ctrl + D — Duplicate selected drawing
- Cmd/Ctrl + Z — Undo
- Cmd/Ctrl + Shift + Z — Redo

## Notes, limitations & next steps

- Prototype: this is a research / educational prototype. It prioritizes clarity and features over production optimizations.
- Very large datasets: loading extremely large tick datasets can stress the browser and test runner (consider server-side aggregation or streaming parsing for production workloads).
- Visual polish: header compacting and compact mode may need minor style tweaks for some controls — feel free to file issues or PRs for UX refinements.
- Improvements to consider: persist chart split percentage, add double-click-to-reset resizer, provide worker-based parsing for huge files, and more granular responsive layouts for the bottom panel.

## Contributing

Contributions welcome — open issues or PRs. Please include tests for new logic and keep changes focused.

## License

See `LICENSE` in the repository root.

---
- For long date ranges use the panel's chunking (5-day windows) to avoid provider rate limits when fetching from Twelve Data.
