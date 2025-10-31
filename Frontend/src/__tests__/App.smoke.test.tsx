import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

// Mock heavy child components so rendering App is lightweight
vi.mock('../components/ChartContainer', () => ({
    default: (props: any) => React.createElement('div', { 'data-testid': 'chart' }, 'chart'),
}));
vi.mock('../components/MarketDataPanel', () => ({ default: () => React.createElement('div', null, 'market') }));
vi.mock('../components/ToolSidebar', () => ({ default: () => React.createElement('div', null, 'tools') }));
vi.mock('../components/TradingPanel', () => ({ default: () => React.createElement('div', null, 'trading') }));
vi.mock('../components/PlaybackControls', () => ({ default: () => React.createElement('div', null, 'playback') }));
vi.mock('../components/DataLoader', () => ({ default: () => React.createElement('div', null, 'loader') }));
vi.mock('../components/TimeframeSelector', () => ({ default: () => React.createElement('div', null, 'tf') }));
vi.mock('../components/ThemeToggle', () => ({ default: () => React.createElement('div', null, 'theme') }));

// Mock data and utilities that trigger network, file, or heavy processing
vi.mock('../data/sampleData', () => ({
    default: [],
    SAMPLE_DATASET_ID: 'SAMPLE',
    buildDatasetId: (s: string) => `id-${s}`,
}));

vi.mock('../utils/csv', () => ({ parseCsvCandles: vi.fn(async () => ({ candles: [] })) }));
vi.mock('../utils/timeframe', () => ({
    detectTimeframeFromFilename: vi.fn(() => 'Daily'),
    getTimeframeMultiplier: vi.fn(() => 1),
}));

vi.mock('../services/persistence', () => ({
    loadWorkspaceState: vi.fn(() => null),
    saveWorkspaceState: vi.fn(() => undefined),
}));

vi.mock('../utils/timeframeAggregation', () => ({ streamAggregateCandles: vi.fn(async () => []) }));
vi.mock('../utils/tickPlayback', () => ({ aggregateTicksUpToIndex: vi.fn(() => []) }));

vi.mock('../hooks/useTheme', () => ({ useTheme: () => ({ preference: 'light', setPreference: () => { }, effectiveTheme: 'light' }) }));

// Mock the drawing store hook used in App
vi.mock('../state/drawingStore', () => ({
    useDrawingStore: (selector: any) => selector({
        drawings: [],
        setDatasetId: () => { },
        loadSnapshot: () => { },
    }),
}));

describe('App smoke', () => {
    beforeEach(() => {
        // Mock fetch and File so the initial useEffect in App doesn't fail
        // @ts-ignore - vitest global
        global.fetch = vi.fn(async () => ({ text: async () => '' }));

        // Minimal File mock used by App
        // @ts-ignore
        global.File = class {
            text() {
                return Promise.resolve('');
            }
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders without crashing', async () => {
        // Dynamic import so vitest/ESM resolves the mocked modules correctly
        const AppModule = await import('../App');
        const App = AppModule.default;
        const { getByTestId } = render(React.createElement(App));

        await waitFor(() => {
            expect(getByTestId('chart')).toBeTruthy();
        });
    });
});
