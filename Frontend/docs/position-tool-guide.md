# Position Tool Guide

## Overview
The Position Tool allows you to place Long and Short trading positions on the chart with full visualization of Entry, Take Profit, and Stop Loss levels using a rectangle-based interface.

## Features

### Visual Components
1. **Position Rectangle**
   - Semi-transparent colored box (green for long, red for short)
   - Solid border defining the position boundaries
   - All levels contained within the rectangle

2. **Entry Level**
   - Solid horizontal line at the entry price
   - "LONG Entry: [price]" or "SHORT Entry: [price]" label
   - For long positions: at the bottom of the rectangle
   - For short positions: at the top of the rectangle

3. **Take Profit Level**
   - Green dashed horizontal line
   - "TP: [price]" label
   - The profit target level within the rectangle

4. **Stop Loss Level**
   - Red dashed horizontal line
   - "SL: [price]" label
   - The risk limit (calculated outside the rectangle)

### Default Risk/Reward
When you draw a position rectangle:
- **Long Position**: 
  - Entry: Bottom edge of rectangle
  - Take Profit: Top edge of rectangle
  - Stop Loss: Calculated at 2:1 risk/reward (50% of the profit distance below entry)
  
- **Short Position**:
  - Entry: Top edge of rectangle
  - Take Profit: Bottom edge of rectangle
  - Stop Loss: Calculated at 2:1 risk/reward (50% of the profit distance above entry)

This gives a default 2:1 reward-to-risk ratio.

## Usage

### Placing Positions
1. Click the "L" button (Long Position) or "S" button (Short Position) in the toolbar
2. Click and drag on the chart to define the position box:
   - **For Long**: Drag upward from entry to take profit
   - **For Short**: Drag downward from entry to take profit
3. Release to create the position with automatically calculated stop loss

### Adjusting Levels
When a position is selected, you'll see multiple handles:

1. **Corner Handles** (white circles at corners):
   - Drag to resize the entire position rectangle
   - Automatically recalculates entry, TP, and SL based on new bounds

2. **Take Profit Handle** (green circle on left edge):
   - Drag vertically to adjust TP level independently

3. **Stop Loss Handle** (red circle on left edge):
   - Drag vertically to adjust SL level independently

4. **Entry Handle** (colored circle on left edge):
   - Drag vertically to adjust entry price independently

### Moving Positions
- Click and drag inside the position rectangle
- The entire position moves, including all levels (entry, TP, SL)
- The relative distances between levels are maintained

### Resizing Positions
- Drag any corner handle to resize the position box
- Entry and TP adjust based on rectangle edges
- SL recalculates to maintain 2:1 risk/reward ratio

### Deleting Positions
- Select the position
- Press Delete key or use context menu

## Keyboard Shortcuts
- `L` - Activate Long Position tool
- `S` - Activate Short Position tool
- `V` or `Esc` - Return to Select tool
- `Delete` - Delete selected position

## Tips
- The larger you draw the rectangle, the larger the profit target
- Resize the rectangle to quickly adjust your risk/reward setup
- Use Shift+Click while drawing for horizontal snapping
- Positions are saved automatically with your drawing state
- You can undo/redo position placements (Ctrl+Z / Ctrl+Y)
- Right-click on a position to access Properties panel for precise adjustments
