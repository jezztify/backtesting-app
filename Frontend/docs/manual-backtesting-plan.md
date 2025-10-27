# Manual Backtesting Workspace Plan

## Overview

Build a browser-based manual backtesting environment that mimics key TradingView ergonomics while remaining fully controllable for strategy experimentation. The initial focus is delivering a high-fidelity price chart with essential drawing tools so traders can replay historical data, annotate price action, and log hypothetical trades.

## Vision & Success Criteria

- Provide an intuitive, TradingView-like charting experience with smooth zoom/pan, multiple timeframes, and crisp rendering on modern browsers.
- Offer core annotations—Rectangle and Trendline—that feel responsive, editable, and persist across sessions.
- Enable traders to import historical OHLCV data (CSV/JSON), step through candles, and capture trade ideas without writing code.
- Keep the architecture extensible for future automation (order simulation, metrics, collaboration).
- Success is measured by reduced friction in manual backtesting sessions (≤2 minutes from data upload to first annotation) and user satisfaction scored via qualitative feedback from pilot traders.

## Target Personas & Use Cases

1. **Discretionary swing trader**: Reviews daily/4H charts, marks supply/demand zones (rectangles) and trend structure (trendlines) before committing capital.
2. **Quant researcher prototyping discretionary overlays**: Needs to validate if human overlays align with algorithmic signals.
3. **Trading coach/mentor**: Annotates scenarios to teach students and wants to share marked-up charts.

Representative scenarios:
- Upload a CSV of BTC/USD daily data, annotate a multi-week range with rectangles, and draw a trendline breakout.
- Replay candles bar-by-bar, pausing to add notes and compare setups.
- Export annotated states to JSON for future review or discussion.

## Functional Requirements

### Charting
- Create and render lightweight candlestick (and optional volume histogram) charts using TradingView’s `lightweight-charts` library.
- Support zoom, pan, and fit-to-content interactions with smooth animations.
- Provide timeframe presets (e.g., 1M, 1W, 1D, 4H, 1H) mapped to data aggregation functions.
- Implement data ingestion via CSV upload (OHLCV with ISO timestamps) and future API integration.
- Include playback controls: play/pause, step forward/back, jump to timestamp, adjustable playback speed.

### Drawing Tools
- Tool palette toggling between Select, Rectangle, Trendline.
- **Rectangle tool**: click-drag to create; handles for resize, properties panel for border/fill color, opacity, extend options.
- **Trendline tool**: two-point click placement, adjustable anchor handles, extend-to-right/left toggles, style panel (color, width, line style), slope/percentage display.
- Selection state with keyboard shortcuts (delete, duplicate, toggle visibility).
- Undo/redo stack for drawing operations.

### Data & State Persistence
- Store chart layouts, drawing states, and playback position in browser storage (IndexedDB or Local Storage) keyed by dataset ID.
- Provide import/export (JSON) for sharing chart states.

### User Experience
- Responsive layout optimized for desktop/tablet, with collapsible side panels.
- Light/dark theme support.
- Contextual tooltips and onboarding overlays for first-time use.

## Non-Functional Requirements

- **Performance**: Maintain ≥60 FPS during interactions on datasets with ≥5,000 candles.
- **Reliability**: No data loss during session; autosave interval ≤5 seconds.
- **Accessibility**: Keyboard navigation for tool switching, color contrast compliant with WCAG AA.
- **Extensibility**: Clear abstraction layers (chart core, drawing primitives, persistence) to add new tools or plugins.

## Technical Architecture

### Frontend
- Framework: React + TypeScript (bundled with Vite).
- State management: Zustand for reactive global states (tools, chart settings, playback), supplemented by React Query for async data (future API calls).
- Styling: Tailwind CSS or CSS-in-JS (e.g., Vanilla Extract) with design tokens for theming.
- Chart core: TradingView `lightweight-charts` v5.0 (per [docs](https://tradingview.github.io/lightweight-charts/docs)).
- Drawing layer: Implement as Lightweight Charts primitives (see repo `src/plugins/`) to leverage canvas layering, `requestUpdate`, and built-in z-ordering.

### Data Layer
- Data ingestion adapter normalizes CSV/JSON into typed OHLCV records (`{ time: number | string; open; high; low; close; volume }`).
- Playback engine maintains current index, emits events to update chart cursor and UI.
- Persistence service abstracts Local Storage/IndexedDB; future server sync via REST/GraphQL.

### Module Breakdown
- `chart-core`: wraps `createChart`, manages series lifecycle, exposes imperative API for playback.
- `tooling`: state machines for each drawing tool, hit-testing utilities, geometry math, undo/redo command stack.
- `ui`: panels, toolbars, settings dialogs, file import flows.
- `persistence`: serialization/deserialization of layouts and drawings, versioned schema.
- `tests`: unit tests (Vitest) for geometry and reducers; Playwright suites for tooling flows.

### Integration with TradingView Primitives
- Follow the project’s [Development Guide](../.github/DEVELOPMENTGUIDE.md) for primitive lifecycle (attached/detached, `requestUpdate`, stable view arrays).
- Build tool renderers via `IPrimitivePaneRenderer.draw` using `useBitmapCoordinateSpace` for crisp visuals.
- Coordinate conversions rely on `series.priceScale().priceToCoordinate` and `timeScale().timeToCoordinate`, cached per update cycle.

## Data Flow & State Diagram (Textual)

1. User uploads data → parser normalizes → chart series receives `setData` → playback engine indexes candles.
2. Playback events emit `onBarChange` → tool manager updates active geometry (e.g., snapping to bar) → primitive renderer redraws overlays.
3. Drawing operations dispatch commands → command stack updates state → persistence service saves snapshot → UI reflects new selection.

## Drawing Tool Design Considerations

- **Rectangle**: store anchors as price/time pairs; compute screen-space bounds each frame; support inverted axes (dragging upwards).
- **Trendline**: maintain anchor coordinates in chart space, derive slope, allow infinite extension by clamping to chart bounds; display optional slope label.
- Use a shared hit-test utility returning `PrimitiveHoveredItem` with `cursorStyle` updates.
- Provide style presets and allow saving custom templates in later releases.

## UX & Interaction Patterns

- Floating toolbar on the left for drawing tools; horizontal top bar for playback/timeframes.
- Properties panel opens on the right when an object is selected.
- Keyboard shortcuts: `V` select, `R` rectangle, `T` trendline, `Del` delete, `Ctrl/Cmd+Z` undo, `Ctrl/Cmd+Y` redo, space toggles playback.
- Snap-to-candle toggle (magnet mode) in toolbar.

## Implementation Roadmap

### Phase 1 – Foundations (Weeks 1-2)
- Scaffold React + TypeScript project with Vite.
- Integrate `lightweight-charts`, render sample dataset, configure responsive layout.
- Establish global state store and theme tokens.

### Phase 2 – Data & Playback (Weeks 3-4)
- Implement CSV upload, validation, and normalization pipeline.
- Build playback controller with keyboard shortcuts and progress slider.
- Persist sessions (auto-save) and handle dataset switching.

### Phase 3 – Drawing Toolkit MVP (Weeks 5-6)
- Introduce tool manager, selection state, and overlay primitives.
- Implement Rectangle primitive with edit handles and style controls.
- Implement Trendline primitive with extend options and slope display.
- Add undo/redo infrastructure and JSON export/import for drawings.

### Phase 4 – Polish & QA (Weeks 7-8)
- Improve accessibility (focus outlines, ARIA labels, high-contrast themes).
- Add tutorial overlay, refine error handling for uploads.
- Expand test coverage: geometry unit tests, Playwright e2e for drawing flows, regression snapshots.
- Prepare documentation: user guide, troubleshooting, contribution guidelines.

## Validation Strategy

- **Unit tests**: geometry (rectangle bounds, trendline slope), snapping logic, persistence serializers (Vitest).
- **Integration tests**: simulate drawing/editing/deleting through Playwright, verify state persisted across reloads.
- **Performance checks**: profile redraw frequency with Chrome DevTools; target <10ms per draw cycle.
- **User testing**: run pilot sessions with traders, collect qualitative feedback, iterate on ergonomics.
- **Regression**: visual snapshots of chart + overlays to detect rendering changes.

## Future Enhancements

- Additional drawing tools (Fibonacci retracements, channels, text notes).
- Multi-chart layouts with linked crosshair and synchronized playback.
- Strategy journaling: trade log with screenshots, risk metrics, tagging.
- Cloud sync and collaboration (shared sessions, comments).
- Indicator overlays (moving averages, RSI) and scripting hooks for semi-automated analysis.

## References & Resources

- TradingView Lightweight Charts Documentation (v5.0): https://tradingview.github.io/lightweight-charts/docs
- Lightweight Charts Primitive Development Guide (repository `.github/DEVELOPMENTGUIDE.md`).
- TradingView product inspiration: https://www.tradingview.com/lightweight-charts/
- IndexedDB API (MDN): https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- Playwright Testing Guide: https://playwright.dev/docs/test-intro
