import {
  IChartApi,
  ISeriesApi,
  Time,
  createChart,
  ColorType,
  CandlestickData,
  CandlestickSeries,
  WhitespaceData,
} from 'lightweight-charts';
import { MutableRefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import DrawingOverlay from './DrawingOverlay';
import { determinePriceFormat } from '../utils/format';
import { useCanvasStore } from '../state/canvasStore';
import { Candle, Timeframe } from '../types/series';
import { aggregateTicksUpToIndex } from '../utils/tickPlayback';
import { ChartPoint } from '../types/drawings';
import { getTimeframeConfig, getTimeframePadding, getBarIntervalSeconds, getTimeframeMultiplier } from '../utils/timeframe';

// price format utilities moved to src/utils/format.ts

type ChartThemeColors = {
  background: string;
  text: string;
  grid: string;
  up: string;
  down: string;
};

const FALLBACK_THEME_COLORS: Record<'light' | 'dark', ChartThemeColors> = {
  light: {
    background: '#ffffff',
    text: '#1f2937',
    grid: 'rgba(148, 163, 184, 0.2)',
    up: '#16a34a',
    down: '#ef4444',
  },
  dark: {
    background: '#0f172a',
    text: '#cbd5f5',
    grid: 'rgba(148, 163, 184, 0.1)',
    up: '#26a69a',
    down: '#ef5350',
  },
};

const readCssVariable = (variableName: string): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const value = window.getComputedStyle(document.documentElement).getPropertyValue(variableName);
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const getChartThemeColors = (mode: 'light' | 'dark'): ChartThemeColors => {
  const defaults = FALLBACK_THEME_COLORS[mode];

  return {
    background: readCssVariable('--color-chart-surface') ?? defaults.background,
    text: readCssVariable('--color-chart-text') ?? defaults.text,
    grid: readCssVariable('--color-chart-grid') ?? defaults.grid,
    up: readCssVariable('--color-success') ?? defaults.up,
    down: readCssVariable('--color-danger') ?? defaults.down,
  };
};

const applyThemeToChart = (
  chart: IChartApi,
  series: ISeriesApi<'Candlestick'>,
  colors: ChartThemeColors,
  canvasSettings: any
) => {
  chart.applyOptions({
    layout: {
      background: { type: ColorType.Solid, color: canvasSettings.background },
      textColor: colors.text,
    },
    grid: {
      horzLines: { color: colors.grid },
      vertLines: { color: colors.grid },
    },
    crosshair: {
      vertLine: {
        color: colors.grid,
        labelBackgroundColor: colors.background,
      },
      horzLine: {
        color: colors.grid,
        labelBackgroundColor: colors.background,
      },
    },
  });

  series.applyOptions({
    upColor: canvasSettings.upFill,
    downColor: canvasSettings.downFill,
    wickUpColor: canvasSettings.upWick,
    wickDownColor: canvasSettings.downWick,
    borderUpColor: canvasSettings.upBorder,
    borderDownColor: canvasSettings.downBorder,
    borderVisible: true,
  });
};

interface ChartContainerProps {
  candles: Candle[];
  baseTicks: Candle[];
  baseTimeframe: Timeframe;
  playbackIndex: number;
  timeframe: Timeframe;
  isPlaying?: boolean;
  theme: 'light' | 'dark';
  onChartReady?: (api: {
    scrollToIndex: (index: number, visibleCandles?: number) => void;
    getCanvasWidth: () => number;
    centerPrice: (price: number) => void;
    getVisibleCandlesCount: () => number;
    getLatestLogicalPosition?: () => number;
  }) => void;
  showCanvasModal: boolean;
  setShowCanvasModal: (show: boolean) => void;
  onJumpToCurrent?: () => void;
}

interface PanSession {
  initialRange: { from: number; to: number };
  startLogical: number;
  initialPriceRange: { from: number; to: number } | null;
  startY: number;
}

const createChartInstance = (
  container: HTMLDivElement,
  timeframe: Timeframe,
  themeColors: ChartThemeColors,
  timezone: string
): { chart: IChartApi; series: ISeriesApi<'Candlestick'> } => {
  const timeframeConfig = getTimeframeConfig(timeframe, timezone);

  const chart = createChart(container, {
    layout: {
      background: { type: ColorType.Solid, color: themeColors.background },
      textColor: themeColors.text,
    },
    grid: {
      horzLines: { color: themeColors.grid },
      vertLines: { color: themeColors.grid },
    },
    rightPriceScale: {
      borderVisible: false,
      autoScale: false,  // Disable autoscaling to allow vertical panning
    },
    timeScale: {
      borderVisible: false,
      shiftVisibleRangeOnNewBar: true,
      fixLeftEdge: false,
      fixRightEdge: false,
      allowShiftVisibleRangeOnWhitespaceReplacement: true,
      ignoreWhitespaceIndices: false,  // Ensure whitespace points are rendered
      timeVisible: timeframeConfig.timeVisible,
      secondsVisible: timeframeConfig.secondsVisible,
      tickMarkFormatter: timeframeConfig.tickMarkFormatter,
    },
    crosshair: {
      mode: 1,
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: true,  // Enable vertical touch drag for panning
    },
    handleScale: {
      axisPressedMouseMove: {
        time: true,  // Enable click-and-drag scaling on time (X) axis
        price: true, // Enable click-and-drag scaling on price (Y) axis
      },
      axisDoubleClickReset: {
        time: true,  // Enable double-click X axis to reset time scale
        price: true, // Enable double-click Y axis to reset price scale
      },
      mouseWheel: true,  // Enable mouse wheel scaling
      pinch: true,       // Enable pinch scaling
    },
  });

  const series = chart.addSeries(CandlestickSeries, {
    upColor: themeColors.up,
    downColor: themeColors.down,
    wickUpColor: themeColors.up,
    wickDownColor: themeColors.down,
    borderUpColor: themeColors.up,
    borderDownColor: themeColors.down,
    borderVisible: false,
  });

  return { chart, series };
};

const normalizeTime = (time: Time | undefined): number | null => {
  if (time === undefined) {
    return null;
  }
  if (typeof time === 'number') {
    return time;
  }
  if (typeof time === 'string') {
    const parsed = Date.parse(time);
    return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
  }
  if (typeof time === 'object' && time !== null && 'day' in time && 'month' in time && 'year' in time) {
    return Math.floor(Date.UTC(time.year, time.month - 1, time.day) / 1000);
  }
  return null;
};

const offsetTimeByBars = (time: Time, bars: number, barIntervalSeconds: number): number | null => {
  const normalized = normalizeTime(time);
  if (normalized === null) {
    return null;
  }
  return normalized + (bars * barIntervalSeconds);
};


const normalizeVisibleData = (
  baseTicks: Candle[],
  baseTimeframe: Timeframe,
  playbackIndex: number,
  timeframe: Timeframe
): (CandlestickData | WhitespaceData<Time>)[] => {
  const aggregatedCandles = aggregateTicksUpToIndex(baseTicks, baseTimeframe, timeframe, playbackIndex);

  if (aggregatedCandles.length === 0) {
    return [];
  }

  const data: (CandlestickData | WhitespaceData<Time>)[] = [];
  const PADDING = getTimeframePadding(timeframe);
  const BAR_INTERVAL = getBarIntervalSeconds(timeframe);

  const firstCandleOfFullSet = aggregatedCandles[0];
  const lastCandleOfFullSet = aggregatedCandles[aggregatedCandles.length - 1];

  for (let i = PADDING; i > 0; i--) {
    const paddingTime = offsetTimeByBars(firstCandleOfFullSet.time as Time, -i, BAR_INTERVAL);
    if (paddingTime !== null) {
      data.push({ time: paddingTime as Time });
    }
  }

  aggregatedCandles.forEach((candle, idx) => {
    if (
      Number.isFinite(candle.open) &&
      Number.isFinite(candle.high) &&
      Number.isFinite(candle.low) &&
      Number.isFinite(candle.close)
    ) {
      data.push({
        time: candle.time as Time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      });
    } else {
      // Diagnostic log for invalid candle
      console.warn('Invalid candle detected:', candle, 'at index', idx);
    }
  });

  // Add whitespace for future candles (from last candle to end of padding)
  for (let i = 1; i <= PADDING; i++) {
    const paddingTime = offsetTimeByBars(lastCandleOfFullSet.time as Time, i, BAR_INTERVAL);
    if (paddingTime !== null) {
      data.push({ time: paddingTime as Time });
    }
  }

  return data;
};

const useResizeObserver = (
  ref: MutableRefObject<HTMLDivElement | null>,
  callback: (size: { width: number; height: number }) => void
) => {
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        callback({ width, height });
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, callback]);
};


const ChartContainer = ({ candles = [], baseTicks = [], baseTimeframe, playbackIndex, timeframe, isPlaying = false, theme, onChartReady, showCanvasModal, setShowCanvasModal, onJumpToCurrent }: ChartContainerProps) => {
  // Track previous last candle index, playback index, candle count, and visible candles count for autoscroll logic
  const prevLastCandleIdxRef = useRef<number>(-1);
  const prevPlaybackIdxRef = useRef<number>(-1);
  const prevCandleCountRef = useRef<number>(-1);
  const prevVisibleCandlesCountRef = useRef<number>(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Modal state is now controlled by parent
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const canvasSettings = useCanvasStore(state => state.settings);
  const setCanvasSettings = useCanvasStore.getState().setSettings;
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [renderTick, setRenderTick] = useState(0);
  // Compute price format so child components can align displayed prices with chart precision
  const priceFormat = useMemo(() => {
    const values: number[] = [];
    for (const c of candles) {
      if (Number.isFinite(c.open)) values.push(c.open);
      if (Number.isFinite(c.high)) values.push(c.high);
      if (Number.isFinite(c.low)) values.push(c.low);
      if (Number.isFinite(c.close)) values.push(c.close);
    }
    return determinePriceFormat(values);
  }, [candles]);
  const isPanningRef = useRef(false);
  const isUpdatingDataRef = useRef(false);
  const isScrollingToIndexRef = useRef(false); // Track if we're scrolling to an index
  const playbackLogicalRangeRef = useRef<{ from: number; to: number } | null>(null); // Store logical range when playback starts
  const playbackRangeSizeRef = useRef<number | null>(null); // Store the range size (number of visible bars) when playback starts

  // Ensure props that should be arrays are actual arrays. Parent may pass null explicitly,
  // which would bypass parameter defaults — normalize here to avoid runtime .length errors.
  if (!Array.isArray(candles)) {
    // eslint-disable-next-line no-param-reassign
    // @ts-ignore - normalize potential null/undefined to an empty array for internal use
    candles = [] as Candle[];
  }
  if (!Array.isArray(baseTicks)) {
    // eslint-disable-next-line no-param-reassign
    // @ts-ignore
    baseTicks = [] as Candle[];
  }

  // Capture the logical range when playback starts
  useEffect(() => {
    if (isPlaying && chartRef.current) {
      const timeScale = chartRef.current.timeScale();
      const currentLogicalRange = timeScale.getVisibleLogicalRange();
      if (currentLogicalRange) {
        playbackLogicalRangeRef.current = {
          from: currentLogicalRange.from,
          to: currentLogicalRange.to
        };
        // Store the range size (number of visible bars)
        playbackRangeSizeRef.current = currentLogicalRange.to - currentLogicalRange.from;
        // Record the current visible candles count
        prevVisibleCandlesCountRef.current = Math.round(currentLogicalRange.to - currentLogicalRange.from);
      }
    } else if (!isPlaying) {
      // Clear the stored range when playback stops
      playbackLogicalRangeRef.current = null;
      playbackRangeSizeRef.current = null;
      prevVisibleCandlesCountRef.current = -1;
    }
  }, [isPlaying]);

  // Pre-compute aggregated candles for the current playback index/timeframe so child overlay
  // can access the same candle list for features like volume profile calculations.
  const aggregatedCandlesMemo = useMemo(() => {
    return aggregateTicksUpToIndex(baseTicks, baseTimeframe, timeframe, playbackIndex);
  }, [baseTicks, baseTimeframe, timeframe, playbackIndex]);

  // Center the price axis on a given price
  const centerPrice = useCallback((price: number) => {
    if (!seriesRef.current) return;
    const priceScale = seriesRef.current.priceScale();
    const visibleRange = priceScale.getVisibleRange();
    if (!visibleRange) return;
    const rangeSize = visibleRange.to - visibleRange.from;
    const newFrom = price - rangeSize / 2;
    const newTo = price + rangeSize / 2;
    priceScale.setVisibleRange({ from: newFrom, to: newTo });
  }, []);

  // Expose scroll API to parent
  const scrollToIndex = useCallback((index: number, visibleCandles: number = 100) => {
    if (!chartRef.current || candles.length === 0) {
      return;
    }

    // Mark that we're intentionally scrolling
    isScrollingToIndexRef.current = true;

    const totalCandles = candles.length;
    const paddingOffset = getTimeframePadding(timeframe);
    const maxLogicalIndex = totalCandles + paddingOffset * 2 - 1;

    // Clamp target to available candle range
    const clampedTargetIndex = Math.max(0, Math.min(index, totalCandles - 1));

    // Translate to logical index space (which includes padding whitespace)
    const logicalTarget = clampedTargetIndex + paddingOffset;

    // Show the specified number of visible candles (default 100)
    const barsBeforeTarget = Math.floor(visibleCandles * 0.8); // 80% bars before
    const barsAfterTarget = visibleCandles - barsBeforeTarget; // 20% bars after

    const actualBarsBefore = Math.min(barsBeforeTarget, logicalTarget);
    const actualBarsAfter = Math.min(barsAfterTarget, maxLogicalIndex - logicalTarget);

    const logicalStart = logicalTarget - actualBarsBefore;
    const logicalEnd = logicalTarget + actualBarsAfter;

    if (logicalEnd >= logicalStart) {
      chartRef.current.timeScale().setVisibleLogicalRange({
        from: logicalStart,
        to: logicalEnd,
      });
    }

    // Reset the flag after a short delay
    setTimeout(() => {
      isScrollingToIndexRef.current = false;
    }, 100);
  }, [candles.length, timeframe]);

  const getCanvasWidth = useCallback(() => {
    return dimensions.width;
  }, [dimensions.width]);

  const getVisibleCandlesCount = useCallback(() => {
    if (!chartRef.current) {
      return 100; // Default if chart not ready
    }
    const timeScale = chartRef.current.timeScale();
    const visibleLogicalRange = timeScale.getVisibleLogicalRange();
    if (!visibleLogicalRange) {
      return 100; // Default if no range available
    }
    // Return the number of visible bars (rounded to nearest integer)
    return Math.round(visibleLogicalRange.to - visibleLogicalRange.from);
  }, []);

  // Return the logical timescale index of the latest (right-most) timeframe candle.
  // This index is in the chart's logical space and already accounts for padding
  // whitespace added to the left of the dataset.
  const getLatestLogicalPosition = useCallback((): number => {
    const lastIndex = Math.max(0, candles.length - 1);
    const paddingOffset = getTimeframePadding(timeframe);
    return lastIndex + paddingOffset;
  }, [candles.length, timeframe]);

  useEffect(() => {
    if (onChartReady && chartRef.current) {
      onChartReady({ scrollToIndex, getCanvasWidth, centerPrice, getVisibleCandlesCount, getLatestLogicalPosition });
    }
  }, [onChartReady, scrollToIndex, getCanvasWidth, centerPrice, getVisibleCandlesCount, getLatestLogicalPosition]);

  // When playback is active, run getLatestLogicalPosition on every tick
  // (playbackIndex updates each tick from the parent). We store the last
  // value in a ref so other internal logic can read it if needed.
  const latestLogicalAtTickRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isPlaying) return;
    try {
      const pos = getLatestLogicalPosition();
      latestLogicalAtTickRef.current = pos;
      // no-op otherwise; function intentionally invoked each tick
    } catch (err) {
      // ignore errors from caller
    }
  }, [isPlaying, playbackIndex, getLatestLogicalPosition]);

  useEffect(() => {
    if (seriesRef.current && priceFormat) {
      seriesRef.current.applyOptions({ priceFormat });
    }
  }, [priceFormat]);

  const beginPan = useCallback(
    (startX: number, startY: number): PanSession | null => {
      // Allow panning during playback so users can drag the view manually.
      // Playback-related auto-scrolling respects isPanningRef to avoid fighting the user.

      const chart = chartRef.current;
      const series = seriesRef.current;
      if (!chart || !series) {
        return null;
      }
      isPanningRef.current = true; // Mark that we're panning
      const timeScale = chart.timeScale();
      const startLogical = timeScale.coordinateToLogical(startX);
      const range = timeScale.getVisibleLogicalRange();
      if (startLogical === null || !range) {
        return null;
      }

      // Get the initial price range for vertical panning
      const priceScale = series.priceScale();
      const initialPriceRange = priceScale.getVisibleRange();
      
      return {
        initialRange: { from: range.from, to: range.to },
        startLogical,
        initialPriceRange,
        startY,
      };
    },
    [isPlaying]
  );

  const continuePan = useCallback((session: PanSession, currentX: number, currentY: number) => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) {
      return;
    }

    // Horizontal panning (time axis)
    const timeScale = chart.timeScale();
    const currentLogical = timeScale.coordinateToLogical(currentX);
    if (currentLogical === null) {
      return;
    }
    const delta = session.startLogical - currentLogical;
    timeScale.setVisibleLogicalRange({
      from: session.initialRange.from + delta,
      to: session.initialRange.to + delta,
    });

    // Vertical panning (price axis)
    if (session.initialPriceRange) {
      const priceScale = series.priceScale();
      const startPrice = series.coordinateToPrice(session.startY);
      const currentPrice = series.coordinateToPrice(currentY);

      if (startPrice !== null && currentPrice !== null) {
        const priceDelta = startPrice - currentPrice;
        const rangeSize = session.initialPriceRange.to - session.initialPriceRange.from;

        priceScale.setVisibleRange({
          from: session.initialPriceRange.from + priceDelta,
          to: session.initialPriceRange.to + priceDelta,
        });
      }
    }
  }, []);

  const endPan = useCallback(() => {
    // Panning ended
    isPanningRef.current = false;

    // Update the stored playback visible-range size so autoscroll will
    // use the user's new visible-candles count after they drag/zoom the time axis.
    if (chartRef.current) {
      const timeScale = chartRef.current.timeScale();
      const visibleLogicalRange = timeScale.getVisibleLogicalRange();
      if (visibleLogicalRange) {
        // Store the current visible-range size (number of logical bars)
        playbackRangeSizeRef.current = visibleLogicalRange.to - visibleLogicalRange.from;
      }
    }

    // Update drawings now that panning is done
    setRenderTick((tick) => tick + 1);
  }, [playbackIndex, candles.length]);

  const panHandlers = useMemo(
    () => ({
      start: beginPan,
      move: continuePan,
      end: endPan,
    }),
    [beginPan, continuePan, endPan]
  );

  useLayoutEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const themeColors = getChartThemeColors(theme);
    const { chart, series } = createChartInstance(containerRef.current, timeframe, themeColors, 'UTC');
    chartRef.current = chart;
    seriesRef.current = series;

  const bounding = containerRef.current.getBoundingClientRect();
    chart.resize(bounding.width, bounding.height);
    setDimensions({ width: bounding.width, height: bounding.height });

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const handleVisibleChange = () => {
      // Don't update drawings while actively panning or updating data - only when idle
      if (isPanningRef.current || isUpdatingDataRef.current) {
        return;
      }

      if (timeoutId !== null) {
        return; // Already scheduled an update
      }
      timeoutId = setTimeout(() => {
        setRenderTick((tick) => tick + 1);
        timeoutId = null;
      }, 32);
    };

    chart.timeScale().subscribeVisibleTimeRangeChange(handleVisibleChange);

    // Detect pointer interactions on the container (including axes) so native axis drags
    // set the panning flag. We use capture on pointerdown to catch events before the chart
    // consumes them, and listen for pointerup on window to clear the flag.
    const onPointerDownCapture = () => {
      isPanningRef.current = true;
    };
    const onPointerUp = () => {
      // Clear panning flag for native pointer interactions (axis drag, etc.)
      isPanningRef.current = false;

      // Update stored playback visible-range size to match whatever the user left
      // the chart at after dragging/zooming the time axis. This ensures subsequent
      // autoscrolls use the user's chosen visible-candles count.
      if (chartRef.current) {
        const visibleLogicalRange = chartRef.current.timeScale().getVisibleLogicalRange();
        if (visibleLogicalRange) {
          playbackRangeSizeRef.current = visibleLogicalRange.to - visibleLogicalRange.from;
        }
      }
    };
    containerRef.current.addEventListener('pointerdown', onPointerDownCapture, true);
    window.addEventListener('pointerup', onPointerUp);

    // Double-click on the time axis should jump to current (latest bar).
    const TIME_AXIS_HEIGHT = 24; // px — keep in sync with rendering
    const onDoubleClick = (e: MouseEvent) => {
      try {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        // If the double-click happened within the bottom TIME_AXIS_HEIGHT px,
        // consider it a time-axis double-click and trigger jump to current.
        if (e.clientY >= rect.bottom - TIME_AXIS_HEIGHT) {
          onJumpToCurrent?.();
        }
      } catch (err) {
        // non-fatal
      }
    };

    containerRef.current.addEventListener('dblclick', onDoubleClick);

    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(handleVisibleChange);
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      containerRef.current?.removeEventListener('pointerdown', onPointerDownCapture, true);
      window.removeEventListener('pointerup', onPointerUp);
      containerRef.current?.removeEventListener('dblclick', onDoubleClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe]);
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) {
      return;
    }

    const colors = getChartThemeColors(theme);
    applyThemeToChart(chartRef.current, seriesRef.current, colors, canvasSettings);
  }, [theme, canvasSettings]);

  useResizeObserver(containerRef, ({ width, height }) => {
    if (!chartRef.current) {
      return;
    }
    chartRef.current.resize(width, height);
    setDimensions({ width, height });
    setRenderTick((tick) => tick + 1);
  });

  // Track if we've done the initial fitContent
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) {
      return;
    }

    // Mark that we're updating data to prevent intermediate render ticks
    isUpdatingDataRef.current = true;

    // Get aggregated candles directly for robust autoscroll
    const aggregatedCandles = aggregateTicksUpToIndex(baseTicks, baseTimeframe, timeframe, playbackIndex);
    const visibleData = normalizeVisibleData(baseTicks, baseTimeframe, playbackIndex, timeframe);
    const lastCandleIdx = aggregatedCandles.length - 1;
    const candleCount = aggregatedCandles.length;

    if (visibleData.length > 0) {
      const timeScale = chartRef.current.timeScale();
      let targetLogicalRange: { from: number; to: number } | null = null;
      let targetTimeRange: any | null = null;

      // Get current visible candles count in the current timeframe
      const visibleLogicalRange = timeScale.getVisibleLogicalRange();
      let visibleTimeframeCandlesCount = 0;
      if (visibleLogicalRange) {
        // The logical range includes padding, so map logical indices to aggregated candles
        const paddingOffset = getTimeframePadding(timeframe);
        const fromIdx = Math.max(0, Math.floor(visibleLogicalRange.from) - paddingOffset);
        const toIdx = Math.min(aggregatedCandles.length, Math.ceil(visibleLogicalRange.to) - paddingOffset);
        visibleTimeframeCandlesCount = Math.max(0, toIdx - fromIdx);
      }

      // Only autoscroll when a new timeframe candle is created during playback
      // but don't autoscroll while the user is actively panning (including axis drag)
      if (
        isPlaying &&
        playbackRangeSizeRef.current !== null &&
        candleCount > prevCandleCountRef.current &&
        !isPanningRef.current
      ) {
        // Visible candles increased, scroll to latest
        const paddingOffset = getTimeframePadding(timeframe);
        const currentLogicalIndex = lastCandleIdx + paddingOffset;
        const rangeSize = playbackRangeSizeRef.current;
        const halfRange = rangeSize / 2;
        targetLogicalRange = {
          from: currentLogicalIndex - halfRange,
          to: currentLogicalIndex + halfRange
        };
        chartRef.current.timeScale().setVisibleLogicalRange(targetLogicalRange);
      } else if (hasInitializedRef.current && !isPanningRef.current) {
        // Not playing - use current visible range (time-based)
        const currentVisibleRange = timeScale.getVisibleRange();
        if (currentVisibleRange) {
          targetTimeRange = currentVisibleRange;
          chartRef.current.timeScale().setVisibleRange(targetTimeRange);
        }
      }

      seriesRef.current.setData(visibleData);

      // Only fit content on initial load, not on every update (prevents stuttering)
      if (!hasInitializedRef.current) {
        setTimeout(() => {
          if (chartRef.current) {
            chartRef.current.timeScale().fitContent();
            hasInitializedRef.current = true;
            isUpdatingDataRef.current = false;
            setRenderTick((tick) => tick + 1);
          }
        }, 50);
      } else {
        // Update immediately during playback to prevent stuttering
        isUpdatingDataRef.current = false;
        setRenderTick((tick) => tick + 1);
      }
      prevVisibleCandlesCountRef.current = visibleTimeframeCandlesCount;
    } else {
      seriesRef.current.setData([]);
      isUpdatingDataRef.current = false;
      prevVisibleCandlesCountRef.current = 0;
    }
    // Update previous last candle index, playback index, and candle count for next tick
    prevLastCandleIdxRef.current = lastCandleIdx;
    prevPlaybackIdxRef.current = playbackIndex;
    prevCandleCountRef.current = candleCount;
    // Don't call setRenderTick here - we'll do it manually after the range is restored
  }, [baseTicks, baseTimeframe, playbackIndex, timeframe, isPlaying]);

  const converters = useMemo(() => {
    // Store the candles reference at memo creation time for stability
    const candlesRef = candles;

    return {
      toCanvas: (point: ChartPoint) => {
        if (!chartRef.current || !seriesRef.current || candlesRef.length === 0) {
          return null;
        }

        const timeScale = chartRef.current.timeScale();
        let x = timeScale.timeToCoordinate(point.time as Time);
        const y = seriesRef.current.priceToCoordinate(point.price);

        // If timeToCoordinate returns null, the time is outside the currently loaded data range
        // We need to extrapolate the coordinate. Prefer using the chart's current visible
        // logical range as reference (more reliable when switching timeframes), falling
        // back to the full dataset edges if necessary.
        if (x === null || x === undefined) {
          // Prefer visible range of the chart as stable reference points
          const visibleRange = timeScale.getVisibleRange?.();
          if (visibleRange && visibleRange.from !== undefined && visibleRange.to !== undefined) {
            const vrFrom = visibleRange.from as Time;
            const vrTo = visibleRange.to as Time;
            const x1 = timeScale.timeToCoordinate(vrFrom);
            const x2 = timeScale.timeToCoordinate(vrTo);
            const firstTime = normalizeTime(vrFrom);
            const lastTime = normalizeTime(vrTo);
            if (x1 !== null && x2 !== null && firstTime !== null && lastTime !== null && lastTime > firstTime) {
              const timeRange = lastTime - firstTime;
              const pixelRange = x2 - x1;
              const pixelsPerTimeUnit = pixelRange / timeRange;
              const timeFromFirst = point.time - firstTime;
              x = (x1 + timeFromFirst * pixelsPerTimeUnit) as any;
            }
          }

          // Fallback: use full dataset edges if visible range was not usable
          if (x === null || x === undefined) {
            const firstCandleTime = normalizeTime(candlesRef[0].time as Time);
            const lastCandleTime = normalizeTime(candlesRef[candlesRef.length - 1].time as Time);

            if (firstCandleTime !== null && lastCandleTime !== null) {
              const x1 = timeScale.timeToCoordinate(candlesRef[0].time as Time);
              const x2 = timeScale.timeToCoordinate(candlesRef[candlesRef.length - 1].time as Time);
              if (x1 !== null && x2 !== null) {
                const timeRange = lastCandleTime - firstCandleTime;
                const pixelRange = x2 - x1;
                if (timeRange > 0) {
                  const pixelsPerTimeUnit = pixelRange / timeRange;
                  const timeFromFirst = point.time - firstCandleTime;
                  x = (x1 + timeFromFirst * pixelsPerTimeUnit) as any;
                }
              }
            }
          }
        }

        if (x === undefined || y === undefined || x === null || y === null) {
          return null;
        }

        // Validate that coordinates are finite numbers (not NaN or Infinity)
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          return null;
        }

        return { x, y };
      },
      toChart: (canvasPoint: { x: number; y: number }) => {
        if (!chartRef.current || !seriesRef.current) {
          return null;
        }
        const time = chartRef.current.timeScale().coordinateToTime(canvasPoint.x);
        const price = seriesRef.current.coordinateToPrice(canvasPoint.y);
        if (price === null || price === undefined) {
          return null;
        }
        const normalizedTime = normalizeTime(time);
        if (normalizedTime === null) {
          return null;
        }
        return { time: normalizedTime, price } satisfies ChartPoint;
      },
    };
  }, [renderTick, candles]);

  // ...priceFormat is computed earlier and reused here

  // Theme colors for the empty-state message
  const themeColors = useMemo(() => getChartThemeColors(theme), [theme]);

  return (
    <div
      className="chart-container"
      ref={containerRef}
      onContextMenu={e => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      {/* Pass the drawing overlay the actual canvas area (exclude price axis and time axis)
          so pointer events and drawing visuals only cover the chart plotting area. */}
      {(() => {
        const PRICE_AXIS_WIDTH = 60; // reserve space for right price axis
        const TIME_AXIS_HEIGHT = 24; // reserve space for bottom time axis (kept small to ensure x-axis remains visible)
        const canvasWidth = Math.max(0, dimensions.width - PRICE_AXIS_WIDTH);
        const canvasHeight = Math.max(0, dimensions.height - TIME_AXIS_HEIGHT);
        return (
          <DrawingOverlay
            width={canvasWidth}
            height={canvasHeight}
            converters={converters}
            pricePrecision={priceFormat.precision}
            renderTick={renderTick}
            aggregatedCandles={aggregatedCandlesMemo}
            baseTicks={baseTicks}
            panHandlers={panHandlers}
            timeAxisHeight={TIME_AXIS_HEIGHT}
          />
        );
      })()}

      {(baseTicks.length === 0 || candles.length === 0) && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: themeColors.text,
            background: 'transparent',
            padding: '8px 12px',
            borderRadius: 8,
            zIndex: 500,
            pointerEvents: 'none',
            fontSize: 16,
            fontWeight: 600,
            textAlign: 'center',
            whiteSpace: 'nowrap',
          }}
        >
          Start importing data
        </div>
      )}

      {showCanvasModal && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: 10,
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
            padding: 24,
            zIndex: 9999,
            minWidth: 320,
          }}
        >
          <h3 style={{ marginTop: 0 }}>Canvas Properties</h3>
          <label style={{ display: 'block', marginBottom: 12 }}>
            Background Color
            <input
              type="color"
              value={canvasSettings.background}
              onChange={e => setCanvasSettings({ background: e.target.value })}
              style={{ marginLeft: 12 }}
            />
          </label>
          <fieldset style={{ border: '1px solid #eee', borderRadius: 8, marginBottom: 16, padding: 12 }}>
            <legend style={{ fontWeight: 600, color: '#16a34a' }}>Long (Up Candle)</legend>
            <label style={{ display: 'block', marginBottom: 10 }}>
              Border
              <input type="color" value={canvasSettings.upBorder} onChange={e => setCanvasSettings({ upBorder: e.target.value })} style={{ marginLeft: 12 }} />
            </label>
            <label style={{ display: 'block', marginBottom: 10 }}>
              Fill
              <input type="color" value={canvasSettings.upFill} onChange={e => setCanvasSettings({ upFill: e.target.value })} style={{ marginLeft: 12 }} />
            </label>
            <label style={{ display: 'block', marginBottom: 10 }}>
              Wick
              <input type="color" value={canvasSettings.upWick} onChange={e => setCanvasSettings({ upWick: e.target.value })} style={{ marginLeft: 12 }} />
            </label>
          </fieldset>
          <fieldset style={{ border: '1px solid #eee', borderRadius: 8, marginBottom: 16, padding: 12 }}>
            <legend style={{ fontWeight: 600, color: '#ef4444' }}>Short (Down Candle)</legend>
            <label style={{ display: 'block', marginBottom: 10 }}>
              Border
              <input type="color" value={canvasSettings.downBorder} onChange={e => setCanvasSettings({ downBorder: e.target.value })} style={{ marginLeft: 12 }} />
            </label>
            <label style={{ display: 'block', marginBottom: 10 }}>
              Fill
              <input type="color" value={canvasSettings.downFill} onChange={e => setCanvasSettings({ downFill: e.target.value })} style={{ marginLeft: 12 }} />
            </label>
            <label style={{ display: 'block', marginBottom: 10 }}>
              Wick
              <input type="color" value={canvasSettings.downWick} onChange={e => setCanvasSettings({ downWick: e.target.value })} style={{ marginLeft: 12 }} />
            </label>
          </fieldset>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
            <button
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#e5e7eb', color: '#111', fontWeight: 500, cursor: 'pointer' }}
              onClick={() => {
                if (window.confirm('Reset all canvas settings to default values?')) {
                  // Reset canvas settings to default
                  if (typeof window !== 'undefined') {
                    // Dynamically import to avoid circular deps in SSR
                    import('../state/canvasStore').then(mod => {
                      mod.useCanvasStore.getState().resetSettings();
                    });
                  }
                }
              }}
            >
              Reset to Default
            </button>
            <button
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 500, cursor: 'pointer' }}
              onClick={() => setShowCanvasModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Converters extracted for unit testing: pure functions that mirror the runtime
// behavior of the internal converters used inside the component.
export const toCanvasPoint = (
  point: { time: any; price: number },
  chart: any,
  series: any,
  candlesRef: any[]
): { x: number; y: number } | null => {
  if (!chart || !series || !Array.isArray(candlesRef) || candlesRef.length === 0) {
    return null;
  }

  const timeScale = chart.timeScale();
  let x = timeScale.timeToCoordinate(point.time as Time);
  const y = series.priceToCoordinate(point.price);

  // Extrapolate if necessary when timeToCoordinate returns null/undefined
  if (x === null || x === undefined) {
    const firstCandleTime = normalizeTime(candlesRef[0].time as Time);
    const lastCandleTime = normalizeTime(candlesRef[candlesRef.length - 1].time as Time);

    if (firstCandleTime !== null && lastCandleTime !== null) {
      const x1 = timeScale.timeToCoordinate(candlesRef[0].time as Time);
      const x2 = timeScale.timeToCoordinate(candlesRef[candlesRef.length - 1].time as Time);

      if (x1 !== null && x2 !== null) {
        const timeRange = lastCandleTime - firstCandleTime;
        const pixelRange = x2 - x1;

        if (timeRange > 0) {
          const pixelsPerTimeUnit = pixelRange / timeRange;
          const timeFromFirst = point.time - firstCandleTime;
          x = (x1 + timeFromFirst * pixelsPerTimeUnit) as any;
        }
      }
    }
  }

  if (x === undefined || y === undefined || x === null || y === null) {
    return null;
  }

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return { x, y };
};

export const toChartPoint = (canvasPoint: { x: number; y: number }, chart: any, series: any): { time: number; price: number } | null => {
  if (!chart || !series) {
    return null;
  }
  const time = chart.timeScale().coordinateToTime(canvasPoint.x);
  const price = series.coordinateToPrice(canvasPoint.y);
  if (price === null || price === undefined) {
    return null;
  }
  const normalizedTime = normalizeTime(time);
  if (normalizedTime === null) {
    return null;
  }
  return { time: normalizedTime, price };
};

export { normalizeTime, offsetTimeByBars, normalizeVisibleData, getChartThemeColors, readCssVariable, createChartInstance, applyThemeToChart };
export default ChartContainer;