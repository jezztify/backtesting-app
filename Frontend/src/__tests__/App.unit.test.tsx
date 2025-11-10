import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';
import sampleData from '../data/sampleData';

// Mock heavy subcomponents so we can inspect props and trigger callbacks
vi.mock('../components/ChartContainer', () => {
  return {
    __esModule: true,
    default: (props: any) => {
      // call onChartReady synchronously so chartApiRef is set in App
      if (props.onChartReady) {
        props.onChartReady({
          scrollToIndex: vi.fn((idx: number) => {
            // store last index for tests via global
            (global as any).__lastScrollToIndex = idx;
          }),
          getCanvasWidth: vi.fn(() => 800),
          centerPrice: vi.fn((p: number) => {
            (global as any).__lastCenterPrice = p;
          }),
          getVisibleCandlesCount: vi.fn(() => 50),
        });
      }
      return <div data-testid="chart-container">mock-chart</div>;
    },
  };
});

vi.mock('../components/PlaybackControls', () => {
  return {
    __esModule: true,
    default: (props: any) => {
      // expose handlers to global so tests can trigger them
      (global as any).__playbackProps = props;
      return <div data-testid="playback-controls">mock-playback</div>;
    },
  };
});

vi.mock('../components/MarketDataPanel', () => {
  return {
    __esModule: true,
    default: ({ onBack }: any) => (
      <div>
        <button data-testid="market-back" onClick={() => onBack()}>
          Back
        </button>
      </div>
    ),
  };
});

vi.mock('../components/ToolSidebar', () => {
  return {
    __esModule: true,
    default: (props: any) => (
      <div>
        <button data-testid="reset-sample" onClick={() => props.onResetSample()}>
          Reset
        </button>
      </div>
    ),
  };
});

vi.mock('../components/ThemeToggle', () => ({
  __esModule: true,
  default: ({ value, onChange }: any) => (
    <button data-testid="theme-toggle" onClick={() => onChange(value === 'light' ? 'dark' : 'light')}>
      Theme
    </button>
  ),
}));

vi.mock('../components/DataLoader', () => ({
  __esModule: true,
  default: ({ onDatasetLoaded }: any) => (
    <button data-testid="data-loader" onClick={() => onDatasetLoaded('lbl', [], 'Daily')}>
      Load
    </button>
  ),
}));

vi.mock('../components/TimeframeSelector', () => ({
  __esModule: true,
  default: ({ selectedTimeframe, onTimeframeChange }: any) => (
    <select data-testid="tf-selector" value={selectedTimeframe} onChange={(e) => onTimeframeChange(e.target.value)}>
      <option value="Daily">Daily</option>
      <option value="M15">M15</option>
    </select>
  ),
}));

vi.mock('../components/TradingPanel', () => ({
  __esModule: true,
  default: (props: any) => <div data-testid="trading-panel">mock-trading</div>,
}));

// Mock hooks and utilities
vi.mock('../hooks/useTheme', () => ({
  useTheme: () => ({ preference: 'light', setPreference: vi.fn(), effectiveTheme: 'light' }),
}));

const clearAllMock = vi.fn();

vi.mock('../state/drawingStore', () => ({
  useDrawingStore: (selector: any) => selector({
    drawings: [],
    setDatasetId: vi.fn(),
    loadSnapshot: vi.fn(),
    clearAll: clearAllMock,
  }),
}));

vi.mock('../services/persistence', () => ({
  loadWorkspaceState: vi.fn(() => undefined),
  saveWorkspaceState: vi.fn(() => {}),
}));

vi.mock('../utils/timeframe', () => ({
  getTimeframeMultiplier: vi.fn(() => 1),
}));

vi.mock('../utils/tickPlayback', () => ({
  aggregateTicksUpToIndex: vi.fn((data: any) => data),
}));

vi.mock('../utils/timeframeAggregation', () => ({
  streamAggregateCandles: vi.fn(async (data: any) => data),
}));

vi.mock('../utils/csv', () => ({
  parseCsvCandles: vi.fn(async () => ({ candles: [] })),
}));

describe('App component', () => {
  beforeEach(() => {
    // clear globals used by mocks
    (global as any).__lastScrollToIndex = undefined;
    (global as any).__lastCenterPrice = undefined;
    (global as any).__playbackProps = undefined;
    // clear mock call history
    clearAllMock.mockClear();
  });

  it('renders workspace and can switch to marketData view and back', async () => {
    render(<App />);

    // Initially workspace should render chart container
    expect(await screen.findByTestId('chart-container')).toBeInTheDocument();

    // Click Fetch Market Data button in header
    const fetchBtn = screen.getByText(/Fetch\s*Market Data/i);
    fireEvent.click(fetchBtn);

    // MarketDataPanel should be shown (mock renders a back button)
    expect(await screen.findByTestId('market-back')).toBeInTheDocument();

    // Click back to return to workspace
    fireEvent.click(screen.getByTestId('market-back'));
    expect(await screen.findByTestId('chart-container')).toBeInTheDocument();
  });

  it('handles chart ready and jump to current (scroll + centerPrice)', async () => {
    render(<App />);

    // wait for playback props to be captured by mock
    await screen.findByTestId('playback-controls');

    // Ensure the playbackProps were exposed by our mock
    const props = (global as any).__playbackProps;
    expect(props).toBeDefined();
    expect(typeof props.onJumpToCurrent).toBe('function');

    // Trigger onJumpToCurrent which should call chartApiRef.scrollToIndex and centerPrice
    act(() => {
      props.onJumpToCurrent();
    });

    // scrollToIndex should have been called (value stored in global)
    expect((global as any).__lastScrollToIndex).toBeDefined();
    // centerPrice should have been called with the last candle close
    const lastClose = sampleData[sampleData.length - 1].close;
    expect((global as any).__lastCenterPrice).toBe(lastClose);
  });

  it('resets sample when ToolSidebar onResetSample is called', async () => {
    render(<App />);

    // tool sidebar mock exposes a reset button
    const resetBtn = await screen.findByTestId('reset-sample');
    fireEvent.click(resetBtn);

    // After reset, chart container still present and playback controls exist
    expect(await screen.findByTestId('chart-container')).toBeInTheDocument();
    expect(await screen.findByTestId('playback-controls')).toBeInTheDocument();
  });

  it('clears all drawings when new market data is loaded', async () => {
    render(<App />);

    // Click data loader to trigger dataset load
    const loadBtn = await screen.findByTestId('data-loader');
    act(() => {
      fireEvent.click(loadBtn);
    });

    // Verify clearAll was called when data was loaded
    expect(clearAllMock).toHaveBeenCalled();
  });
});
