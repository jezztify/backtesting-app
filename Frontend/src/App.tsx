import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import ChartContainer from './components/ChartContainer';
import MarketDataPanel from './components/MarketDataPanel';
import ToolSidebar from './components/ToolSidebar';
import TradingPanel from './components/TradingPanel';
import { determinePriceFormat } from './utils/format';
import PlaybackControls, { TickRate } from './components/PlaybackControls';
// import PropertiesPanel from './components/PropertiesPanel';
import DataLoader from './components/DataLoader';
import TimeframeSelector from './components/TimeframeSelector';
import ThemeToggle from './components/ThemeToggle';
import sampleData, { SAMPLE_DATASET_ID, buildDatasetId } from './data/sampleData';
// No direct CSV import; will fetch at runtime
import { parseCsvCandles } from './utils/csv';
import { detectTimeframeFromFilename } from './utils/timeframe';
import { Candle, Timeframe } from './types/series';
import { useDrawingStore } from './state/drawingStore';
import { loadWorkspaceState, saveWorkspaceState } from './services/persistence';
import { streamAggregateCandles } from './utils/timeframeAggregation';
import { aggregateTicksUpToIndex } from './utils/tickPlayback';
import { getTimeframeMultiplier } from './utils/timeframe';
import { useTheme } from './hooks/useTheme';

const App = () => {
  // View state: 'workspace' or 'marketData'
  const [activeView, setActiveView] = useState<'workspace' | 'marketData'>('workspace');
  const { preference: themePreference, setPreference: setThemePreference, effectiveTheme } = useTheme();
  // Load EURUSD_TICKDATA_012024_032025.csv by default on initial mount
  useEffect(() => {
    (async () => {
      // Only run on first mount
      if (candles === sampleData) {
        try {
          const response = await fetch('/src/data/EURUSD_TICKDATA_012024_032025.csv');
          const csvText = await response.text();
          const file = new File([csvText], 'EURUSD_TICKDATA_012024_032025.csv');
          const result = await parseCsvCandles(file);
          if (result.candles.length > 0) {
            const timeframe = detectTimeframeFromFilename(file.name);
            handleDatasetLoaded('EURUSD_TICKDATA_012024_032025', result.candles, timeframe);
          }
        } catch (err) {
          // Optionally handle fetch/parse errors
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [datasetId, setDatasetId] = useState<string>(SAMPLE_DATASET_ID);
  const [datasetLabel, setDatasetLabel] = useState<string>('Sample BTC/USD Daily');
  const [rawM1Candles, setRawM1Candles] = useState<Candle[] | null>(null); // Store raw M1 data
  const [tickSourceData, setTickSourceData] = useState<Candle[] | null>(null); // Current tick source data
  const [candles, setCandles] = useState<Candle[]>(sampleData);
  const [playbackIndex, setPlaybackIndex] = useState<number>(sampleData.length - 1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [tickRate, setTickRate] = useState<TickRate>(10);
  const [tickSource, setTickSource] = useState<Timeframe>('M1'); // The base timeframe to use as tick data
  const [timeframe, setTimeframe] = useState<Timeframe>('Daily');
  // When in dual layout, the second chart can use an independent timeframe
  const [timeframeRight, setTimeframeRight] = useState<Timeframe>(timeframe);
  const [candlesRight, setCandlesRight] = useState<Candle[]>(candles);
  // Layout: 'single' or 'dual' charts
  const [layout, setLayout] = useState<'single' | 'dual'>('single');
  // Percentage width allocated to the left chart in dual layout (10-90)
  const [splitPercent, setSplitPercent] = useState<number>(50);
  const chartWrapperRef = useRef<HTMLDivElement | null>(null);
  const resizingRef = useRef<{ startX: number; startPercent: number } | null>(null);

  const startChartResize = (clientX: number) => {
    resizingRef.current = { startX: clientX, startPercent: splitPercent };
    window.addEventListener('mousemove', onChartMouseMove);
    window.addEventListener('mouseup', stopChartResize);
    window.addEventListener('touchmove', onChartTouchMove as any, { passive: false });
    window.addEventListener('touchend', stopChartResize as any);
  };

  const onChartMouseMove = (e: MouseEvent) => {
    if (!resizingRef.current) return;
    const delta = e.clientX - resizingRef.current.startX;
    const container = chartWrapperRef.current;
    if (!container) return;
    const width = container.getBoundingClientRect().width || 1;
    const deltaPercent = (delta / width) * 100;
    let next = resizingRef.current.startPercent + deltaPercent;
    next = Math.max(10, Math.min(90, next));
    setSplitPercent(next);
  };

  const onChartTouchMove = (e: TouchEvent) => {
    if (!resizingRef.current) return;
    if (e.touches && e.touches[0]) {
      const delta = e.touches[0].clientX - resizingRef.current.startX;
      const container = chartWrapperRef.current;
      if (!container) return;
      const width = container.getBoundingClientRect().width || 1;
      const deltaPercent = (delta / width) * 100;
      let next = resizingRef.current.startPercent + deltaPercent;
      next = Math.max(10, Math.min(90, next));
      setSplitPercent(next);
      e.preventDefault();
    }
  };

  const stopChartResize = () => {
    resizingRef.current = null;
    window.removeEventListener('mousemove', onChartMouseMove);
    window.removeEventListener('mouseup', stopChartResize);
    window.removeEventListener('touchmove', onChartTouchMove as any);
    window.removeEventListener('touchend', stopChartResize as any);
  };
  const [isAggregating, setIsAggregating] = useState<boolean>(false);
  const [aggregationProgress, setAggregationProgress] = useState<number>(0);
  const [useTickPlayback, setUseTickPlayback] = useState<boolean>(true); // Enable tick-by-tick playback

  // Store chart API reference
  const chartApiRef = useRef<{
    scrollToIndex: (index: number, visibleCandles?: number) => void;
    getCanvasWidth: () => number;
    centerPrice: (price: number) => void;
    getVisibleCandlesCount: () => number;
  } | null>(null);

  const drawings = useDrawingStore((state) => state.drawings);
  const setDatasetIdInStore = useDrawingStore((state) => state.setDatasetId);
  const loadSnapshot = useDrawingStore((state) => state.loadSnapshot);

  // Calculate display candles based on tick playback
  // When useTickPlayback is enabled, aggregate ticks up to playbackIndex in real-time
  const displayCandles = useMemo(() => {
    if (!useTickPlayback || !tickSourceData) {
      // Normal mode: show pre-aggregated candles
      return candles;
    }

    // Tick playback mode: aggregate progressively up to playbackIndex
    // Even when tickSource === timeframe, we still slice to show progressive playback
    return aggregateTicksUpToIndex(tickSourceData, tickSource, timeframe, playbackIndex);
  }, [useTickPlayback, tickSourceData, tickSource, timeframe, playbackIndex, candles]);

  // Calculate the playback index in terms of displayCandles
  // This is what should be passed to ChartContainer
  const displayPlaybackIndex = useMemo(() => {
    if (!useTickPlayback || !tickSourceData) {
      // Normal mode: playbackIndex already refers to the candles array
      return playbackIndex;
    }

    // Tick playback mode: the display index is the last formed candle
    return Math.max(0, displayCandles.length - 1);
  }, [useTickPlayback, tickSourceData, playbackIndex, displayCandles.length]);

  const previousDisplayLengthRef = useRef<number>(displayCandles.length);

  // Helper function to calculate the correct display index for scrollToIndex
  // This ensures consistent calculation across all scroll operations
  const calculateDisplayIndex = useCallback((offset: number = 0): number => {
    let baseIndex: number;

    if (useTickPlayback) {
      // In tick playback mode, current display index is the last formed candle
      baseIndex = displayCandles.length - 1;
    } else {
      // In normal mode, playbackIndex IS the display index
      baseIndex = playbackIndex;
    }

    // Simply add the offset - no need for halfVisibleBars here
    // The scrollToIndex function in ChartContainer handles the centering with 40 before / 10 after
    return baseIndex + offset;
  }, [useTickPlayback, displayCandles.length, playbackIndex]);

  useEffect(() => {
    // Load workspace state once when the dataset changes (do not reload on playback
    // updates like `candles.length` because that would overwrite user drawings while
    // playing back ticks).
    setDatasetIdInStore(datasetId);
    const persisted = loadWorkspaceState(datasetId);
    if (persisted) {
      loadSnapshot(persisted.drawings);
      // restore last used fibonacci levels into the drawing store when present
      if (persisted.lastFibonacciLevels && Array.isArray(persisted.lastFibonacciLevels)) {
        try {
          // use the store setter to restore levels
          // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
          const { useDrawingStore } = require('./state/drawingStore');
          useDrawingStore.getState().setLastFibonacciLevels(persisted.lastFibonacciLevels);
        } catch (err) {
          // non-fatal
        }
      }
      setPlaybackIndex((index) => {
        const fallback = Math.max(candles.length - 1, 0);
        return Math.min(persisted.playbackIndex, fallback);
      });
      // Note: intentionally do NOT restore layout or splitPercent from persisted
      // workspace state when loading a dataset. Restoring these would change the
      // user's current layout when they load market data; keep the current
      // layout settings instead (we still restore drawings and playback index).
    } else {
      loadSnapshot([]);
      setPlaybackIndex(Math.max(candles.length - 1, 0));
    }
    // Intentionally only run when datasetId changes or when the snapshot-related
    // functions change. Removing `candles.length` avoids clearing drawings during
    // normal playback updates.
  }, [datasetId, loadSnapshot, setDatasetIdInStore]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    // Persist drawings + playback index + last-used fibonacci levels
    try {
      // read lastFibonacciLevels directly from the drawing store
      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
      const { useDrawingStore } = require('./state/drawingStore');
      const lastFibonacciLevels = useDrawingStore.getState().lastFibonacciLevels;
      saveWorkspaceState(datasetId, {
        drawings,
        playbackIndex,
        lastFibonacciLevels,
        layout,
        splitPercent,
      });
    } catch (err) {
      // fallback: still save drawings/playbackIndex
      saveWorkspaceState(datasetId, {
        drawings,
        playbackIndex,
        layout,
        splitPercent,
      });
    }
  }, [datasetId, drawings, playbackIndex]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }
    // tickRate is ticks/second, so interval is 1000ms / tickRate
    const intervalMs = 1000 / (tickRate * getTimeframeMultiplier(tickSource));
    const interval = window.setInterval(() => {
      setPlaybackIndex((index) => {
        // In tick playback mode, max index is tick source data length
        // In normal mode, max index is candles length
        const maxIdx = useTickPlayback && tickSourceData
          ? tickSourceData.length - 1
          : candles.length - 1;

        if (index >= maxIdx) {
          return index;
        }
        return index + 1;
      });
    }, intervalMs);
    return () => window.clearInterval(interval);
  }, [isPlaying, tickRate, useTickPlayback, tickSourceData, candles.length]);

  // Auto-scroll to follow playback whenever the playback position updates
  // But ONLY when playbackIndex changes during active playback, not when starting
  const previousIsPlayingRef = useRef(isPlaying);

  useEffect(() => {
    const currentDisplayLength = displayCandles.length;

    if (!isPlaying || !chartApiRef.current) {
      previousIsPlayingRef.current = isPlaying;
      previousDisplayLengthRef.current = currentDisplayLength;
      return;
    }

    // Skip auto-scroll on the first render when playback just started
    // This allows the chart to maintain the user's chosen view at start
    if (!previousIsPlayingRef.current) {
      previousIsPlayingRef.current = isPlaying;
      previousDisplayLengthRef.current = currentDisplayLength;
      return;
    }

    if (currentDisplayLength <= previousDisplayLengthRef.current) {
      previousDisplayLengthRef.current = currentDisplayLength;
      return;
    }

    previousIsPlayingRef.current = isPlaying;
    previousDisplayLengthRef.current = currentDisplayLength;

    // Get the current number of visible candles to maintain the zoom level
    const visibleCandles = chartApiRef.current.getVisibleCandlesCount();
    const ticksourceMultiplier = getTimeframeMultiplier(tickSource);
    const displayIndex = calculateDisplayIndex(ticksourceMultiplier * 2);
  }, [isPlaying, playbackIndex, tickSource, calculateDisplayIndex, displayCandles.length]);

  useEffect(() => {
    const maxIdx = useTickPlayback && tickSourceData
      ? tickSourceData.length - 1
      : candles.length - 1;

    if (playbackIndex >= maxIdx && isPlaying) {
      setIsPlaying(false);
    }
  }, [playbackIndex, candles.length, tickSourceData, useTickPlayback, isPlaying]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const drawingActions = useDrawingStore.getState();

      switch (event.key.toLowerCase()) {
        case 'v':
          drawingActions.setActiveTool('select');
          break;
        case 'r':
          drawingActions.setActiveTool('rectangle');
          break;
        case 't':
          drawingActions.setActiveTool('trendline');
          break;
        case 'p':
          drawingActions.setActiveTool('volumeProfile');
          break;
        case 'delete':
        case 'backspace':
          drawingActions.deleteSelection();
          break;
        case 'd':
          if (event.metaKey || event.ctrlKey) {
            event.preventDefault();
            drawingActions.duplicateSelection();
          }
          break;
        case 'z':
          if (event.metaKey || event.ctrlKey) {
            event.preventDefault();
            if (event.shiftKey) {
              drawingActions.redo();
            } else {
              drawingActions.undo();
            }
          }
          break;
        case 'y':
          if (event.metaKey || event.ctrlKey) {
            event.preventDefault();
            drawingActions.redo();
          }
          break;
        case ' ': {
          event.preventDefault();
          setIsPlaying((value) => !value);
          break;
        }
        case 'arrowright':
          event.preventDefault();
          setPlaybackIndex((index) => {
            const maxIdx = useTickPlayback && tickSourceData
              ? tickSourceData.length - 1
              : candles.length - 1;
            return Math.min(index + 1, maxIdx);
          });
          break;
        case 'arrowleft':
          event.preventDefault();
          setPlaybackIndex((index) => Math.max(index - 1, 0));
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [candles.length, tickSourceData, useTickPlayback]);

  const handleDatasetLoaded = (label: string, data: Candle[], detectedTimeframe: Timeframe) => {
    const sortedData = [...data].sort((a, b) => a.time - b.time);
    const targetLabel = label.trim() || 'Imported dataset';
    const newId = buildDatasetId(targetLabel);
    setDatasetLabel(targetLabel);
    setDatasetId(newId);

    // Check if this is M1 tick data (we'll store it for aggregation)
    if (detectedTimeframe === 'M1' || label.toUpperCase().includes('TICKDATA')) {
      setRawM1Candles(sortedData);
      setTickSourceData(sortedData); // Initially use M1 as tick source
      setTickSource('M1');
      setTimeframe('M15'); // Default to M15 for tick data
      setUseTickPlayback(true); // Enable tick-by-tick playback

      // Aggregate to M15 by default for initial display
      setIsAggregating(true);
      streamAggregateCandles(sortedData, 'M15', (processed, total) => {
        setAggregationProgress(Math.floor((processed / total) * 100));
      }).then((aggregated) => {
        setCandles(aggregated);
        setCandlesRight(aggregated);
        setPlaybackIndex(0); // Start from beginning for tick playback
        setIsAggregating(false);
        setAggregationProgress(0);
        // Jump to current after initial load
        setTimeout(() => {
          if (chartApiRef.current) {
            const ticksourceMultiplier = getTimeframeMultiplier('M1');
            const displayIndex = Math.max(0, aggregated.length - 1) + ticksourceMultiplier * 2;
            chartApiRef.current.scrollToIndex(displayIndex);
          }
        }, 0);
      });
    } else {
      setRawM1Candles(null);
      setTickSourceData(null);
      setCandles(sortedData);
      setPlaybackIndex(Math.max(sortedData.length - 1, 0));
      setTimeframe(detectedTimeframe);
      setUseTickPlayback(false);
    }

    setIsPlaying(false);
  };

  // Wrapper handlers for embedding timeframe selectors inside each canvas.
  // If we have raw M1 tick data, delegate to the aggregation handlers which
  // re-aggregate and update candles; otherwise just update the timeframe state
  // so the UI reflects the selection (non-tick datasets don't need aggregation).
  const onLeftTimeframeChange = async (newTf: Timeframe) => {
    if (rawM1Candles) {
      await handleTimeframeChange(newTf);
    } else {
      setTimeframe(newTf);
    }
  };

  const onRightTimeframeChange = async (newTf: Timeframe) => {
    if (rawM1Candles) {
      await handleTimeframeChangeRight(newTf);
    } else {
      setTimeframeRight(newTf);
    }
  };

  const handleTimeframeChange = async (newTimeframe: Timeframe) => {
    if (!rawM1Candles) {
      // No raw M1 data, can't change timeframe
      return;
    }

    // Store current timestamp to maintain position
    const currentTimestamp = tickSourceData && playbackIndex < tickSourceData.length
      ? tickSourceData[playbackIndex].time
      : null;

    setTimeframe(newTimeframe);
    const wasPlaying = isPlaying;
    setIsPlaying(false);
    setIsAggregating(true);
    setAggregationProgress(0);

    // If current tick source is finer than new timeframe, that's ok
    // If current tick source is coarser than new timeframe, reset to M1
    const timeframes: Timeframe[] = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'Daily', 'Weekly', 'Monthly'];
    const newTimeframeIndex = timeframes.indexOf(newTimeframe);
    const currentTickSourceIndex = timeframes.indexOf(tickSource);

    let effectiveTickSource = tickSource;
    if (currentTickSourceIndex > newTimeframeIndex) {
      // Tick source is coarser than display timeframe - reset to M1
      effectiveTickSource = 'M1';
      setTickSource('M1');
    }

    // Aggregate from M1 to tick source (if needed)
    let sourceData = rawM1Candles;
    if (effectiveTickSource !== 'M1') {
      sourceData = await streamAggregateCandles(rawM1Candles, effectiveTickSource, (processed, total) => {
        setAggregationProgress(Math.floor((processed / total) * 50));
      });
    }

    // Store the tick source data for tick-by-tick playback
    setTickSourceData(sourceData);

    // Then aggregate from tick source to display timeframe (for initial display)
    const aggregated = await streamAggregateCandles(sourceData, newTimeframe, (processed, total) => {
      const baseProgress = effectiveTickSource !== 'M1' ? 50 : 0;
      setAggregationProgress(baseProgress + Math.floor((processed / total) * 50));
    });

    setCandles(aggregated);

    // Find the equivalent position in the tick source data
    if (currentTimestamp !== null) {
      // Find the index in tick source that is closest to current timestamp
      const newIndex = sourceData.findIndex(candle => candle.time >= currentTimestamp);
      if (newIndex !== -1) {
        setPlaybackIndex(newIndex);
      } else {
        // If timestamp not found (beyond end), set to last index
        setPlaybackIndex(Math.max(sourceData.length - 1, 0));
      }
    } else {
      setPlaybackIndex(0);
    }

    setIsAggregating(false);
    setAggregationProgress(0);

    // Resume playing if it was playing before
    if (wasPlaying) {
      setIsPlaying(true);
    }
  };

  // Change timeframe for the right-side chart only (dual layout). This mirrors
  // handleTimeframeChange but updates `candlesRight` and `timeframeRight` so
  // the second chart can display an independent aggregation.
  const handleTimeframeChangeRight = async (newTimeframe: Timeframe) => {
    if (!rawM1Candles) {
      return;
    }

    const currentTimestamp = tickSourceData && playbackIndex < tickSourceData.length
      ? tickSourceData[playbackIndex].time
      : null;

    setTimeframeRight(newTimeframe);
    const wasPlaying = isPlaying;
    setIsPlaying(false);
    setIsAggregating(true);
    setAggregationProgress(0);

    const timeframes: Timeframe[] = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'Daily', 'Weekly', 'Monthly'];
    const newTimeframeIndex = timeframes.indexOf(newTimeframe);
    const currentTickSourceIndex = timeframes.indexOf(tickSource);

    let effectiveTickSource = tickSource;
    if (currentTickSourceIndex > newTimeframeIndex) {
      effectiveTickSource = 'M1';
    }

    // Aggregate from M1 to effective tick source if needed
    let sourceData = rawM1Candles;
    if (effectiveTickSource !== 'M1') {
      sourceData = await streamAggregateCandles(rawM1Candles, effectiveTickSource, (processed, total) => {
        setAggregationProgress(Math.floor((processed / total) * 50));
      });
    }

    // Aggregate from tick source to the requested display timeframe
    const aggregated = await streamAggregateCandles(sourceData, newTimeframe, (processed, total) => {
      const baseProgress = effectiveTickSource !== 'M1' ? 50 : 0;
      setAggregationProgress(baseProgress + Math.floor((processed / total) * 50));
    });

    setCandlesRight(aggregated);

    // Map playback index into sourceData
    if (currentTimestamp !== null) {
      const newIndex = sourceData.findIndex(c => c.time >= currentTimestamp);
      if (newIndex !== -1) setPlaybackIndex(newIndex);
      else setPlaybackIndex(Math.max(sourceData.length - 1, 0));
    } else {
      setPlaybackIndex(0);
    }

    setIsAggregating(false);
    setAggregationProgress(0);

    if (wasPlaying) setIsPlaying(true);
  };

  const handleResetSample = () => {
    setDatasetLabel('Sample BTC/USD Daily');
    setDatasetId(SAMPLE_DATASET_ID);
    setCandles(sampleData);
    setPlaybackIndex(sampleData.length - 1);
    setIsPlaying(false);
    setTimeframe('Daily');
    setRawM1Candles(null); // Clear tick data
    setTickSourceData(null);
    setUseTickPlayback(false);
  };

  const seek = (index: number) => {
    const maxIdx = useTickPlayback && tickSourceData
      ? tickSourceData.length - 1
      : candles.length - 1;
    setPlaybackIndex(() => Math.min(Math.max(index, 0), Math.max(maxIdx, 0)));
  };

  const step = (direction: -1 | 1) => {
    setPlaybackIndex((index) => {
      const maxIdx = useTickPlayback && tickSourceData
        ? tickSourceData.length - 1
        : candles.length - 1;

      if (direction === -1) {
        return Math.max(index - 1, 0);
      }
      return Math.min(index + 1, maxIdx);
    });
  };

  const handleJumpToCurrent = () => {
    if (!chartApiRef.current) {
      return;
    }

    // Jump forward by 1000 bars in the display timeframe
    const ticksourceMultiplier = getTimeframeMultiplier(tickSource);
    const targetDisplayIndex = calculateDisplayIndex(ticksourceMultiplier * 2);

    chartApiRef.current.scrollToIndex(targetDisplayIndex);

    // Center the price axis on the current candle's close price
    let currentCandle = displayCandles[targetDisplayIndex];
    if (!currentCandle && displayCandles.length > 0) {
      currentCandle = displayCandles[displayCandles.length - 1];
    }
    if (currentCandle && typeof currentCandle.close === 'number') {
      chartApiRef.current.centerPrice(currentCandle.close);
    }
  };

  const handleTogglePlay = () => {
    // Don't scroll when starting playback - let the user keep their chosen view
    // Auto-scroll will kick in naturally as playback progresses
    setIsPlaying((value) => !value);
  };

  const handleChartReady = (api: {
    scrollToIndex: (index: number, visibleCandles?: number) => void;
    getCanvasWidth: () => number;
    centerPrice: (price: number) => void;
    getVisibleCandlesCount: () => number;
  }) => {
    chartApiRef.current = api;
  };

  const handleTickSourceChange = async (newTickSource: Timeframe) => {
    if (!rawM1Candles) return;

    // Store current timestamp to maintain position
    const currentTimestamp = tickSourceData && playbackIndex < tickSourceData.length
      ? tickSourceData[playbackIndex].time
      : null;

    setTickSource(newTickSource);
    const wasPlaying = isPlaying;
    setIsPlaying(false);

    // Re-aggregate from M1 to the new tick source
    setIsAggregating(true);
    setAggregationProgress(0);

    // First aggregate M1 to the new tick source
    const newTickSourceData = await streamAggregateCandles(rawM1Candles, newTickSource, (processed, total) => {
      setAggregationProgress(Math.floor((processed / total) * 50)); // First half of progress
    });

    // Store the new tick source data for playback
    setTickSourceData(newTickSourceData);

    // Then aggregate tick source to display timeframe (if different)
    let finalData = newTickSourceData;
    if (newTickSource !== timeframe) {
      finalData = await streamAggregateCandles(newTickSourceData, timeframe, (processed, total) => {
        setAggregationProgress(50 + Math.floor((processed / total) * 50)); // Second half
      });
    }

    setCandles(finalData);

    // Find the equivalent position in the new tick source data
    if (currentTimestamp !== null) {
      // Find the index in new tick source that is closest to current timestamp
      const newIndex = newTickSourceData.findIndex(candle => candle.time >= currentTimestamp);
      if (newIndex !== -1) {
        setPlaybackIndex(newIndex);
      } else {
        // If timestamp not found (beyond end), set to last index
        setPlaybackIndex(Math.max(newTickSourceData.length - 1, 0));
      }
    } else {
      setPlaybackIndex(0);
    }

    setIsAggregating(false);
    setAggregationProgress(0);

    // Resume playing if it was playing before
    if (wasPlaying) {
      setIsPlaying(true);
    }
  };

  // Determine available tick sources (must be <= display timeframe)
  const getAvailableTickSources = (): Timeframe[] => {
    if (!rawM1Candles) {
      return [timeframe]; // No tick data, only display timeframe available
    }

    const timeframes: Timeframe[] = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'Daily', 'Weekly', 'Monthly'];
    const currentIndex = timeframes.indexOf(timeframe);

    // Only allow tick sources that are same or finer granularity than display timeframe
    return timeframes.slice(0, currentIndex + 1);
  };

  const availableTickSources = getAvailableTickSources();

  const [showCanvasModal, setShowCanvasModal] = useState(false);

  return (
    <div className="app">
      <header style={{ height: 24, overflow: 'hidden' }}>
        <div className="header-title" style={{ height: 24, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          <h1 style={{ fontSize: 12, margin: 0, lineHeight: '20px' }}>Backtesting Workspace</h1>
        </div>
        <div className="header-controls" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 24, overflow: 'hidden' }}>
          <div style={{ height: 20, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
            <ThemeToggle value={themePreference} onChange={setThemePreference} />
          </div>
          <div style={{ height: 20, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
            <DataLoader onDatasetLoaded={handleDatasetLoaded} />
          </div>
          {/* Layout selector placed next to Load Market Data (DataLoader) */}
          <label style={{ marginLeft: 12, display: 'inline-flex', alignItems: 'center', height: 20, fontSize: 12 }}>
            Layout:
            <select value={layout} onChange={(e) => setLayout(e.target.value as any)} style={{ marginLeft: 8, height: 20, fontSize: 12, padding: '0 6px' }}>
              <option value="single">1 chart</option>
              <option value="dual">2 charts</option>
            </select>
          </label>
          {isAggregating && (
            <div className="aggregation-indicator" style={{ height: 20, fontSize: 12, display: 'flex', alignItems: 'center' }}>
              Aggregating data... {aggregationProgress}%
            </div>
          )}
          <button
            style={{ marginLeft: 16, padding: '2px 8px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 500, cursor: 'pointer', height: 20, fontSize: 12, lineHeight: '20px' }}
            onClick={() => setActiveView('marketData')}
          >
            Fetch Market Data
          </button>
        </div>
      </header>
      {activeView === 'workspace' && (
        <div className="workspace">
          <ToolSidebar
            datasetLabel={datasetLabel}
            timeframe={timeframe}
            onResetSample={handleResetSample}
            onOpenCanvasSettings={() => setShowCanvasModal(true)}
          />
          <div className="chart-area" style={{ flex: 1, minWidth: 0 }}>
            <div ref={chartWrapperRef} className="chart-wrapper" style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
              {layout === 'single' ? (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 8 }}>
                    <TimeframeSelector selectedTimeframe={timeframe} onTimeframeChange={onLeftTimeframeChange} disabled={isAggregating} />
                  </div>
                  <ChartContainer
                    candles={candles}
                    playbackIndex={playbackIndex}
                    timeframe={timeframe}
                    isPlaying={isPlaying}
                    theme={effectiveTheme}
                    onChartReady={handleChartReady}
                    showCanvasModal={showCanvasModal}
                    setShowCanvasModal={setShowCanvasModal}
                    baseTicks={tickSourceData}
                    baseTimeframe={tickSource}
                    onJumpToCurrent={handleJumpToCurrent}
                  />
                </div>
              ) : (
                // Dual layout: render two ChartContainers side-by-side that share the same
                // drawing store and base tick data, but can use independent timeframes.
                <>
                  <div style={{ flexBasis: `${splitPercent}%`, flexGrow: 0, flexShrink: 0, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 8 }}>
                      <TimeframeSelector selectedTimeframe={timeframe} onTimeframeChange={onLeftTimeframeChange} disabled={isAggregating} />
                    </div>
                    <ChartContainer
                      candles={candles}
                      playbackIndex={playbackIndex}
                      timeframe={timeframe}
                      isPlaying={isPlaying}
                      theme={effectiveTheme}
                      onChartReady={handleChartReady}
                      showCanvasModal={showCanvasModal}
                      setShowCanvasModal={setShowCanvasModal}
                      baseTicks={tickSourceData}
                      baseTimeframe={tickSource}
                      onJumpToCurrent={handleJumpToCurrent}
                    />
                  </div>
                  {/* vertical resizer */}
                  <div
                    className="chart-resizer"
                    onMouseDown={(e) => { e.preventDefault(); startChartResize(e.clientX); }}
                    onTouchStart={(e) => { startChartResize(e.touches[0].clientX); }}
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize charts"
                  />

                  <div style={{ flexBasis: `${100 - splitPercent}%`, flexGrow: 0, flexShrink: 0, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 8 }}>
                      <TimeframeSelector selectedTimeframe={timeframeRight} onTimeframeChange={onRightTimeframeChange} disabled={isAggregating} />
                    </div>
                    <ChartContainer
                      candles={candlesRight}
                      playbackIndex={playbackIndex}
                      timeframe={timeframeRight}
                      isPlaying={isPlaying}
                      theme={effectiveTheme}
                      // second chart doesn't need to rebind the shared onChartReady
                      onChartReady={undefined}
                      showCanvasModal={showCanvasModal}
                      setShowCanvasModal={setShowCanvasModal}
                      baseTicks={tickSourceData}
                      baseTimeframe={tickSource}
                      onJumpToCurrent={handleJumpToCurrent}
                    />
                  </div>
                </>
              )}
            </div>
            <div className="bottom-panel">
              <div className="playback-area">
                <PlaybackControls
                  playbackIndex={playbackIndex}
                  maxIndex={useTickPlayback && tickSourceData
                    ? Math.max(tickSourceData.length - 1, 0)
                    : Math.max(candles.length - 1, 0)
                  }
                  isPlaying={isPlaying}
                  tickRate={tickRate}
                  tickSource={tickSource}
                  availableTickSources={availableTickSources}
                  onTogglePlay={handleTogglePlay}
                  onSeek={seek}
                  onStep={step}
                  onTickRateChange={setTickRate}
                  onTickSourceChange={handleTickSourceChange}
                  onJumpToCurrent={handleJumpToCurrent}
                />
              </div>
              <div className="trading-area">
                {/* Determine price precision from the display candles so the trading panel uses the same formatting */}
                <TradingPanel
                  currentPrice={displayCandles[displayPlaybackIndex]?.close}
                  pricePrecision={(() => {
                    const values: number[] = [];
                    for (const c of displayCandles) {
                      if (Number.isFinite(c.open)) values.push(c.open);
                      if (Number.isFinite(c.high)) values.push(c.high);
                      if (Number.isFinite(c.low)) values.push(c.low);
                      if (Number.isFinite(c.close)) values.push(c.close);
                    }
                    return determinePriceFormat(values).precision;
                  })()}
                />
              </div>
            </div>
          </div>
          {/* PropertiesPanel removed; now shown as modal in DrawingOverlay */}
        </div>
      )}
      {activeView === 'marketData' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', width: '100%' }}>
          <MarketDataPanel onBack={() => setActiveView('workspace')} />
        </div>
      )}
    </div>
  );
};

export default App;