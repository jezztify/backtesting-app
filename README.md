# Manual Backtesting Workspace

Lightweight prototype for a manual backtesting workspace with a TradingView-like chart, drawing tools, and a tick playback system.

> This project is for study and educational use only. The author does not hold liability for any damages, losses, or issues that may arise from use by other users.
If you like this project, give it a star so others will discover it too.

[![Watch the video](https://img.youtube.com/vi/-SRq_xEaiFg/0.jpg)](https://www.youtube.com/watch?v=-SRq_xEaiFg)
## Quick start

1. Install dependencies

```bash
npm install
```

2. Run the dev server

```bash
npm run dev
```

3. Build for production

```bash
npm run build
```

4. Run tests

```bash
npm test
```

The Vite dev server runs on http://localhost:5173 by default.

## At-a-glance features

- Interactive chart powered by `lightweight-charts` (React + TypeScript)
- Multiple timeframes and aggregation: Tick, M1, M5, M15, H1, H4, Daily, Weekly (via `src/utils/timeframeAggregation.ts`) 
- Tick playback system: play/pause, step forward/backward, adjustable tick rate, and live tick advancement (see `src/utils/tickPlayback.ts` and `Frontend/docs/tick-playback-system.md`)
- Drawing tools: Rectangle, Trendline, and Long/Short Position tools with selection, move, duplicate, delete, undo/redo, and property editing (implemented in `src/components/DrawingOverlay.tsx` and `src/components/ToolSidebar.tsx`)
- Trading panel / simulated positions: place and edit manual positions, position markers rendered on the chart (`src/components/TradingPanel.tsx` and `src/state/tradingStore.ts`)
- Market Data & Data Loader: sample datasets included (see `src/data/`) and a Market Data panel for loading/inspecting data (`src/components/MarketDataPanel.tsx`, `src/components/DataLoader.tsx`)
- Persistence: drawings and playback/chart state persist to `localStorage` via `src/services/persistence.ts`
- Theme toggle (light/dark) via `src/components/ThemeToggle.tsx`
- Properties panel and modal for editing drawing/chart properties (`src/components/PropertiesPanel.tsx`, `src/components/PropertiesPanelModal.tsx`)
- Tool sidebar: quick access to tools, dataset label, timeframe display, and reset actions (`src/components/ToolSidebar.tsx`)
- Utilities: CSV parsing, geometry helpers (clipping, line math), format helpers (`src/utils/csv.ts`, `src/utils/geometry.ts`, `src/utils/format.ts`)
- State management: lightweight global stores using `zustand` (`src/state/*`)
- Tests: Vitest unit tests for core utilities and stores (see `Frontend/src/__tests__`)

## Using the Market Data panel (Twelve Data)

The app includes a built-in Market Data panel (header button "Market Data") that can fetch time-series from Twelve Data directly and save the returned JSON for import. This is the recommended workflow (no curl or external downloads required):

1) Open Market Data

- In the app header click the "Market Data" button to open the Market Data panel.

2) Save your Twelve Data API key

- Select the provider (Twelve Data) and paste your API key into the API Key field, then click "Save". The panel stores the key in `localStorage` so you don't need to re-enter it every session.

3) Configure a fetch

- Enter the symbol (e.g., `EUR/USD`), choose the source interval (e.g., `1min`) and optionally an aggregate interval (if you want the panel to pre-aggregate the data for you).
- Set the start and end dates (YYYY-MM-DD). For long ranges, enable "Download in 5-day chunks" to avoid hitting rate limits.

4) Fetch and save

- Click "Fetch Data". The panel will call Twelve Data (chunked when requested), display a preview, and enable a "Save Data" button.
- Click "Save Data" to download the JSON file to your machine. The filename is auto-generated (e.g., `EURUSD_1min_20251001_20251010.json`).

5) Import into the workspace

- Use the `Import Data` control in the header (the same button used for file uploads) to import the saved JSON. `DataLoader` recognises Twelve Data JSON (it looks for `values` and `meta.interval`) and will convert the records into the app's candle format and set an appropriate timeframe.

Notes and tips

- The Market Data panel handles rate limits by default (it will chunk requests in 5-day windows and throttle requests to avoid hitting Twelve Data limits).
- Saved API keys are stored in `localStorage` under `marketDataApiKeys` (provider keyed).
- The panel can optionally aggregate data to a larger interval before saving; this is useful if you want M15 or H1 candles built server-side and saved as JSON.
- If you prefer to keep fetched JSON inside the repo for development, save the downloaded file to `Frontend/src/data/` and open it via `Import Data` or by referencing it from the app (the app's sample loader can load files under `src/data/`).

## UI overview

- Chart area (`src/components/ChartContainer.tsx`) — the main price/time series display and axis
- Drawing overlay (`src/components/DrawingOverlay.tsx`) — SVG overlay for drawings and interactions
- Tool sidebar (`src/components/ToolSidebar.tsx`) — select tools, view dataset/timeframe, quick actions
- Playback controls (`src/components/PlaybackControls.tsx`) — play/pause, step, rate control
- Market data panel & loader (`src/components/MarketDataPanel.tsx`, `src/components/DataLoader.tsx`)
- Properties panel & modal (`src/components/PropertiesPanel.tsx`, `src/components/PropertiesPanelModal.tsx`)
- Theme toggle (`src/components/ThemeToggle.tsx`)
- Trading panel (`src/components/TradingPanel.tsx`) — place/edit simulated trades

## Keyboard shortcuts

- V — Select tool
- R — Rectangle tool
- T — Trendline tool
- Space — Play / Pause playback
- ← / → — Step backward / forward one tick
- Delete / Backspace — Delete selected drawing
- Cmd/Ctrl + D — Duplicate selected drawing
- Cmd/Ctrl + Z — Undo
- Cmd/Ctrl + Shift + Z — Redo

## Project structure (important files)

- `Frontend/src/` — application source
	- `components/` — React UI components (chart, overlay, controls, panels)
	- `data/` — sample datasets (JSON) and `sampleData.ts`
	- `state/` — `zustand` stores: `canvasStore.ts`, `drawingStore.ts`, `tradingStore.ts`
	- `services/` — persistence (`persistence.ts`)
	- `utils/` — helpers: `csv.ts`, `geometry.ts`, `tickPlayback.ts`, `timeframe.ts`, `timeframeAggregation.ts`
	- `__tests__/` — unit tests (Vitest)

## Documentation

Detailed design notes and feature docs live in `Frontend/docs/`:

- `manual-backtesting-plan.md` — high-level plan and goals
- `position-tool-guide.md` — behavior and UI of the position tool
- `tick-playback-system.md` — tick playback design and controls
- `timeframe-feature.md` — how timeframes & aggregation work

## Testing & quality

- Unit tests: `npm test` runs Vitest. Core utilities and stores are covered (timeframe aggregation, tick playback, geometry clipping, CSV conversion, trading store behaviors).
- Linting & formatting: ESLint + Prettier configured in the repo (see `package.json` devDependencies).

## Notes, limitations & next steps

- Prototype status: this repo is a research/education prototype, not production-ready. It favors clarity over absolute performance. For large numbers of drawings or extremely high-frequency tick playback, consider switching the overlay to a canvas rendering strategy.
- Timezone handling and dataset selection are intentionally minimal (sample data in-repo). A dataset picker and server-side data source could be added.
- Persistence uses `localStorage`. For multi-device sync or multi-user work, add a backend persistence layer.

## Contributing

Contributions welcome — open issues or PRs. Keep changes small and focused. Add or update tests for any new behaviors.

## License

See `LICENSE` for the license used by the frontend scaffolding.

---

If you'd like, I can also: update a short README section that lists available sample data files, add a badge to show tests status, or open a PR that adds a dataset picker UI. Which would you prefer next?
