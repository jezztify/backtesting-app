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
      setPlaybackIndex((index) => {
        const fallback = Math.max(candles.length - 1, 0);
        return Math.min(persisted.playbackIndex, fallback);
      });
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
    saveWorkspaceState(datasetId, {
      drawings,
      playbackIndex,
    });
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
      <header>
        <div className="header-title">
          <h1>Manual Backtesting Workspace</h1>
        </div>
        <div className="header-controls">
          <ThemeToggle value={themePreference} onChange={setThemePreference} />
          <DataLoader onDatasetLoaded={handleDatasetLoaded} />
          {rawM1Candles && (
            <TimeframeSelector
              selectedTimeframe={timeframe}
              onTimeframeChange={handleTimeframeChange}
              disabled={isAggregating}
            />
          )}
          {isAggregating && (
            <div className="aggregation-indicator">
              Aggregating data... {aggregationProgress}%
            </div>
          )}
          <button
            style={{ marginLeft: 16, padding: '6px 18px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 500, cursor: 'pointer' }}
            onClick={() => setActiveView('marketData')}
          >
            Market Data
          </button>
        </div>
      </header>
      {activeView === 'workspace' && (
        <div className="workspace">
          <div style={{ minWidth: 260, marginRight: 16 }}>
            <ToolSidebar
              datasetLabel={datasetLabel}
              timeframe={timeframe}
              onResetSample={handleResetSample}
              onOpenCanvasSettings={() => setShowCanvasModal(true)}
            />
          </div>
          <div className="chart-area" style={{ flex: 1, minWidth: 0 }}>
            <div className="chart-wrapper">
              <ChartContainer
                candles={candles}
                // Pass the raw playbackIndex (in base tick units) so the chart
                // can re-aggregate base ticks up to the correct tick when
                // building the visible dataset. Previously this passed the
                // derived displayPlaybackIndex which is an index into the
                // already-aggregated display candles; that caused mismatches
                // when the chart re-aggregated using the wrong index and led
                // to the inconsistent dates observed when switching timeframes.
                playbackIndex={playbackIndex}
                timeframe={timeframe}
                isPlaying={isPlaying}
                theme={effectiveTheme}
                onChartReady={handleChartReady}
                showCanvasModal={showCanvasModal}
                setShowCanvasModal={setShowCanvasModal}
                baseTicks={tickSourceData}
                baseTimeframe={tickSource}
              />
            </div>
            <div className="playback-panel">
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
              <div style={{ marginTop: 12 }}>
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
          <div style={{ marginBottom: 32 }}>
            <button
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#e5e7eb', color: '#111', fontWeight: 500, cursor: 'pointer' }}
              onClick={() => setActiveView('workspace')}
            >
              ← Back to Workspace
            </button>
          </div>
          <MarketDataPanel />
        </div>
      )}
    </div>
  );
};

export default App;