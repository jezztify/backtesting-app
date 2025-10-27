# Purpose

This project is for study and educational use only. The author does not hold liability for any damages, losses, or issues that may arise from use by other users.

# Manual Backtesting Workspace

Lightweight prototype for a manual backtesting workspace with a TradingView-like chart and basic drawing tools (Rectangle, Trendline).

## Features
- **🌐 Fetch Market Data**: View and fetch market data in a dedicated panel
- **📊 Multiple Timeframes**: Select timeframe interactively using the timeframe selector (Tick, M1, M5, M15, H1, H4, Daily, Weekly)
- **🎨 Drawing Tools**: Rectangle, Trendline, Long/Short Position tools with full customization
- **⏯️ Playback Controls**: Step through historical data with play/pause, tick rate adjustment, and forward/backward controls
- **💾 Persistence**: Drawings and playback state saved to localStorage automatically
- **⚡ Performance**: Built with lightweight-charts for smooth rendering
- **🧰 Tool Sidebar**: Always-visible sidebar for tool selection, dataset label, timeframe display, and quick actions

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Run dev server:

```bash
npm run dev
```

3. Run tests:

```bash
npm test
```

The app runs on http://localhost:5173 by default.

## UI Overview

- **Chart**: TradingView-like chart with interactive timeframe selector at the top
- **Tool Sidebar**: Select drawing tools, view dataset label, see current timeframe, reset chart, open canvas settings
- **Playback Controls**: Play/pause, step, tick rate adjustment
- **Theme Toggle**: Switch between light and dark mode
- **Canvas Properties Modal**: Customize chart colors and styles

## Data

- The app loads sample data by default (no dataset selection UI)
- Timeframe selector changes chart aggregation and axis formatting

## Timeframe Support

The chart supports Tick, Minute, Hourly, Daily, and Weekly timeframes. Timeframe selection updates chart aggregation and axis formatting. See [Timeframe Feature Documentation](docs/timeframe-feature.md) for details.

## What's Included

- React + TypeScript app scaffolded with Vite
- `lightweight-charts` for chart rendering
- Drawing primitives implemented as an SVG overlay (selection, rectangle, trendline)
- Interactive timeframe selection and chart configuration
- Local persistence via localStorage
- Comprehensive test suite

## Keyboard Shortcuts

- **V** - Select tool
- **R** - Rectangle tool
- **T** - Trendline tool
- **Space** - Play/Pause
- **←/→** - Step backward/forward
- **Delete/Backspace** - Delete selection
- **Cmd/Ctrl + D** - Duplicate selection
- **Cmd/Ctrl + Z** - Undo
- **Cmd/Ctrl + Shift + Z** - Redo

## Notes

- This is an in-repo prototype; for production, consider using `lightweight-charts` primitives or a canvas overlay for better performance with many drawings.
- Drawing clipping is implemented using the Cohen-Sutherland algorithm to keep drawings within chart bounds.
- Timezone selection and dataset selection features have been removed for simplicity.
