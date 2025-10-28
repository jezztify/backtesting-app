# Position Tool Guide

This guide describes the behaviour and UI of the Position tool (Long / Short) used to create simulated trades on the chart. Implementation points are in `Frontend/src/components/DrawingOverlay.tsx`, `Frontend/src/components/TradingPanel.tsx`, and `Frontend/src/state/tradingStore.ts`.

## What the Position Tool does

- Places a visual position on the chart that contains: Entry, Take Profit (TP), and Stop Loss (SL).
- Supports Long and Short orientation with color-coded visuals (default green for long, red for short).
- Positions are stored in the `tradingStore` and persisted along with other drawings.

## Visual elements

- Position box: semi-transparent rectangle spanning entry↔TP.
- Entry line: solid horizontal line with an "Entry" label and exact price.
- TP line: dashed green horizontal line labeled "TP".
- SL line: dashed red horizontal line labeled "SL".
- Drag handles: visible when selected — corner handles and side handles for precise adjustment.

## Default behavior & risk/reward

- By default, drawing a position sets Entry (one edge of the rectangle) and TP (opposite edge). The SL is auto-computed to a default R:R of 2:1 (this can be adjusted in the Properties panel).
- Defaults are conservative; users can manually edit any of Entry/TP/SL after placement.

## How to use

1. Activate the tool: press `L` for Long or `S` for Short (toolbar buttons also available).
2. Click-and-drag on the chart to define the rectangle. For Long, drag up from entry to target; for Short, drag down.
3. Release to create the position. The new position is selected automatically.

While selected:

- Drag inside the box to move the entire position (keeps relative distances).
- Drag corner handles to resize the box — Entry/TP update to match edges.
- Use the side handles to fine-tune Entry, TP or SL independently.
- Right-click and choose "Properties" to set exact numeric values.

## Shortcuts & keyboard

- `L` — Activate Long Position tool
- `S` — Activate Short Position tool
- `V` or `Esc` — Select tool / cancel current placement
- `Delete` / `Backspace` — Delete selected position
- `Cmd/Ctrl + Z` — Undo
- `Cmd/Ctrl + Shift + Z` — Redo

## Implementation notes & references

- Positions are persisted via `persistence.ts` and restored on load.
- The `tradingStore` holds position objects including timestamps, entry/TP/SL prices, size, and metadata.
- PnL calculations shown in the `TradingPanel` are estimated based on displayed price and position direction.

## Tips

- Use small drags for tight SL/TP testing; larger drags to visualize broader targets.
- Combine with tick playback (`PlaybackControls`) to test entry timing and slippage visually.
- Export drawings to JSON for sharing scenarios with teammates.
   - Drag to resize the entire position rectangle
