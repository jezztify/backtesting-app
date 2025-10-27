# Timeframe Detection Feature

## Overview

The charting application now automatically detects and configures timeframes based on the imported CSV filename. This ensures the chart displays time information appropriately for different data resolutions.

## Supported Timeframes

### Minute-based
- **M1** - 1 Minute charts
- **M5** - 5 Minute charts
- **M15** - 15 Minute charts
- **M30** - 30 Minute charts

### Hour-based
- **H1** - 1 Hour charts
- **H4** - 4 Hour charts

### Day/Week/Month
- **Daily** - Daily charts
- **Weekly** - Weekly charts
- **Monthly** - Monthly charts

## Filename Patterns

The system detects timeframes using the following patterns in filenames:

| Timeframe | Detection Patterns |
|-----------|-------------------|
| M1 | `M1_`, `_M1_` |
| M5 | `M5_`, `_M5_` |
| M15 | `M15_`, `_M15_` |
| M30 | `M30_`, `_M30_` |
| H1 | `H1_`, `_H1_` |
| H4 | `H4_`, `_H4_` |
| Daily | `DAILY`, `_D_`, `_D1_` |
| Weekly | `WEEKLY`, `_W_`, `_W1_` |
| Monthly | `MONTHLY`, `_MN_`, `_MN1_` |

### Example Filenames
- `EURUSD_M15_202501010000_202510221345.csv` → Detected as **M15**
- `EURUSD_H1_202501010000_202510221300.csv` → Detected as **H1**
- `EURUSD_Daily_202501010000_202510220000.csv` → Detected as **Daily**
- `EURUSD_Weekly_202501050000_202510190000.csv` → Detected as **Weekly**

## Automatic Adjustments

When a timeframe is detected, the chart automatically adjusts:

### 1. Time Display
- **Minute/Hour charts**: Shows both date AND time (e.g., "Jan 15, 14:30")
- **Daily charts**: Shows only date (e.g., "Jan 15")
- **Weekly/Monthly charts**: Shows only date (e.g., "Jan 15")

### 2. X-Axis Resolution
The x-axis tick marks automatically adjust based on timeframe:

- **Minute charts (M1, M5, M15, M30)**:
  - Time marks show HH:MM format (e.g., "14:30", "15:00")
  - Day marks show month and day (e.g., "Jan 15")
  - Month/year marks show abbreviated month or year

- **Hourly charts (H1, H4)**:
  - Time marks show HH:MM format (e.g., "14:00", "18:00")
  - Day marks show month and day (e.g., "Jan 15")
  - Appropriate for intraday analysis

- **Daily charts**:
  - All marks show month and day (e.g., "Jan 15", "Jan 20")
  - Month marks show abbreviated month (e.g., "Jan", "Feb")
  - Year marks show full year (e.g., "2025")

- **Weekly/Monthly charts**:
  - Marks show abbreviated month (e.g., "Jan", "Feb", "Mar")
  - Year marks show full year (e.g., "2025")

This ensures that for M15 charts, you see 15-minute intervals on the x-axis instead of just daily marks.

### 3. Padding
Different timeframes have different padding amounts to ensure optimal viewing:

| Timeframe | Padding Bars | Approximate Coverage |
|-----------|--------------|---------------------|
| M1 | 5,760 | 4 days |
| M5 | 1,152 | 4 days |
| M15 | 960 | 10 days |
| M30 | 720 | 15 days |
| H1 | 720 | 30 days |
| H4 | 360 | 60 days |
| Daily | 120 | 4 months |
| Weekly | 52 | 1 year |
| Monthly | 24 | 2 years |

### 4. Visual Indicator
The current timeframe is displayed in the Dataset section of the sidebar:
```
Dataset
EURUSD_M15_202501010000_202510221345
Timeframe: 15 Minutes
```

## Technical Implementation

### Files Modified
1. **types/series.ts** - Added `Timeframe` type and `TimeframeConfig` interface
2. **utils/timeframe.ts** - Created timeframe detection and configuration utilities
3. **components/ChartContainer.tsx** - Integrated timeframe-based chart configuration
4. **components/DataLoader.tsx** - Extracts timeframe from filename
5. **components/ToolSidebar.tsx** - Displays detected timeframe
6. **App.tsx** - Manages timeframe state

### Key Functions

#### `detectTimeframeFromFilename(filename: string): Timeframe`
Analyzes a filename and returns the detected timeframe.

#### `getTimeframeConfig(timeframe: Timeframe): TimeframeConfig`
Returns chart configuration settings for a given timeframe, including custom tick mark formatters.

#### `getTimeframeLabel(timeframe: Timeframe): string`
Returns a human-readable label (e.g., "15 Minutes").

#### `getTimeframePadding(timeframe: Timeframe): number`
Returns the appropriate number of padding bars for the timeframe.

#### Custom Tick Mark Formatters
- `createMinuteFormatter()` - Formats time axis for M1, M5, M15, M30
- `createHourlyFormatter()` - Formats time axis for H1, H4
- `createDailyFormatter()` - Formats time axis for Daily
- `createLongTermFormatter()` - Formats time axis for Weekly, Monthly

## Testing

Comprehensive tests are available in `src/__tests__/timeframe.test.ts`:

- Filename pattern detection for all supported timeframes
- Label generation
- Padding calculation
- Tick mark formatter generation
- Time formatting validation
- Unknown/fallback handling

Run tests with:
```bash
npm test
```

All 14 tests should pass, including validation of custom tick mark formatters.

## Future Enhancements

Potential improvements for the timeframe system:

1. **Custom Timeframe Override** - Allow users to manually set timeframe
2. **Auto-detection from Data** - Analyze candle spacing to detect timeframe
3. **Timeframe Selector** - UI component to switch between timeframes
4. **Time Format Customization** - User preferences for time display
5. **Additional Timeframes** - Support for M2, M3, H2, H8, etc.

## Fallback Behavior

If no timeframe pattern is detected in the filename:
- Timeframe is set to **"Unknown"**
- Default padding of 120 bars is used (same as Daily)
- Time display is hidden (shows only date)
- Label displays "Unknown" in the sidebar

## Migration Notes

Existing CSV files without timeframe patterns in their filenames will:
- Continue to work normally
- Use default "Unknown" timeframe settings
- Can be renamed to include timeframe patterns for automatic detection

No breaking changes - all existing functionality is preserved.
