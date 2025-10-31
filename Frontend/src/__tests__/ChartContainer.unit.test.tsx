import React from 'react';
import { render, act } from '@testing-library/react';
import { vi } from 'vitest';

// Mock DrawingOverlay to capture converters passed by ChartContainer
vi.mock('../components/DrawingOverlay', () => ({
    default: (props: any) => {
        // expose converters for assertions
        // @ts-ignore
        // capture converters and panHandlers so tests can invoke them
        // @ts-ignore
        (global as any).__LAST_DRAWING_CONVERTERS = props.converters;
        // @ts-ignore
        (global as any).__LAST_DRAWING_PANHANDLERS = props.panHandlers;
        return React.createElement('div', { 'data-testid': 'drawing' });
    },
}));

// Mock lightweight-charts with spyable functions
vi.mock('lightweight-charts', () => {
    const series = {
        applyOptions: vi.fn(),
        priceScale: () => ({
            getVisibleRange: () => ({ from: 0, to: 100 }),
            setVisibleRange: vi.fn(),
        }),
        setData: vi.fn(),
        update: vi.fn(),
        priceToCoordinate: vi.fn((p: number) => p * 10),
        coordinateToPrice: vi.fn((y: number) => y / 10),
    } as any;

    const chart = {
        applyOptions: vi.fn(),
        addSeries: vi.fn(() => series),
        timeScale: vi.fn(() => ({
            getVisibleLogicalRange: vi.fn(() => ({ from: 0, to: 100 })),
            getVisibleRange: vi.fn(() => ({ from: 0, to: 100 })),
            subscribeVisibleTimeRangeChange: vi.fn((cb: any) => {
                // store callback so tests can invoke if needed
                (global as any).__TIME_RANGE_CB = cb;
                return () => { };
            }),
            unsubscribeVisibleTimeRangeChange: vi.fn(),
            coordinateToLogical: vi.fn((x: number) => Math.floor(x / 10)),
            setVisibleLogicalRange: vi.fn(),
            setVisibleRange: vi.fn(),
            coordinateToTime: vi.fn((x: number) => 1600000000 + Math.round(x)),
            timeToCoordinate: vi.fn((t: number) => Number(t) % 1000),
        })),
        remove: vi.fn(),
        resize: vi.fn(),
    } as any;

    return {
        ColorType: { Solid: 'Solid' },
        createChart: vi.fn((_c: any) => chart),
        CandlestickSeries: Symbol('CandlestickSeries'),
    };
});

// Minimal ResizeObserver mock that immediately calls the callback with a contentRect
// when observe() is called.
// @ts-ignore
global.ResizeObserver = class {
    cb: any;
    constructor(cb: any) {
        this.cb = cb;
    }
    observe(el?: any) {
        // Simulate an initial measurement
        this.cb([{ target: el, contentRect: { width: 800, height: 400 } }]);
    }
    unobserve() { }
    disconnect() { }
};

// Mock canvas store used by ChartContainer
vi.mock('../state/canvasStore', () => {
    const useCanvasStore = (selector: any) => selector({
        settings: { background: '#fff', upFill: '#0f0', downFill: '#f00', upWick: '#0f0', downWick: '#f00', upBorder: '#0f0', downBorder: '#f00' },
        setSettings: vi.fn(),
        resetSettings: vi.fn(),
    });
    // @ts-ignore
    useCanvasStore.getState = () => ({ setSettings: vi.fn() });
    return { useCanvasStore };
});

import ChartContainer from '../components/ChartContainer';

describe('ChartContainer unit', () => {
    it('creates chart, sets data and exposes onChartReady API', async () => {
        const onChartReady = vi.fn();

        const baseTicks = [
            { time: 1600000000, open: 1, high: 2, low: 0.5, close: 1.5 },
            { time: 1600000060, open: 1.5, high: 2.5, low: 1.4, close: 2.0 },
        ];

        const { container } = render(
            <ChartContainer
                candles={baseTicks}
                baseTicks={baseTicks}
                baseTimeframe={'M1'}
                playbackIndex={1}
                timeframe={'M5'}
                theme={'light'}
                onChartReady={onChartReady}
                showCanvasModal={false}
                setShowCanvasModal={() => { }}
            />
        );

        // Allow effects/useLayoutEffect to run
        await act(async () => {
            // no-op to flush
        });

        // onChartReady should have been called
        expect(onChartReady).toHaveBeenCalled();

        // Access the mocked chart and series via lightweight-charts mock
        const lc = await import('lightweight-charts');
        const chart = (lc.createChart as any).mock.results[0].value;
        const series = chart.addSeries();

        // series.setData should have been called with normalized visible data
        expect(series.setData).toHaveBeenCalled();

        // the ResizeObserver mock should have called chart.resize during mount
        expect(chart.resize).toHaveBeenCalledWith(800, 400);

        // The DrawingOverlay mock captured converters - validate toCanvas/toChart conversions
        const converters = (global as any).__LAST_DRAWING_CONVERTERS;
        expect(converters).toBeTruthy();

        const canvasPoint = converters.toCanvas ? converters.toCanvas({ time: 1600000000, price: 1.5 }) : null;
        // Our mock series.priceToCoordinate returns price*10
        expect(canvasPoint).toBeTruthy();
        if (canvasPoint) {
            expect(canvasPoint.y).toBeCloseTo(1.5 * 10);
        }

        const chartPoint = converters.toChart ? converters.toChart({ x: 10, y: 15 }) : null;
        expect(chartPoint).toBeTruthy();
        if (chartPoint) {
            // coordinateToPrice mock returns y/10
            expect(chartPoint.price).toBeCloseTo(15 / 10);
        }
    });

    it('scrollToIndex from onChartReady sets visible logical range', async () => {
        let api: any = null;
        const onChartReady = (a: any) => { api = a; };

        const baseTicks = [
            { time: 1600000000, open: 1, high: 2, low: 0.5, close: 1.5 },
            { time: 1600000060, open: 1.5, high: 2.5, low: 1.4, close: 2.0 },
            { time: 1600000120, open: 2.0, high: 3.0, low: 1.9, close: 2.5 },
        ];

        render(
            <ChartContainer
                candles={baseTicks}
                baseTicks={baseTicks}
                baseTimeframe={'M1'}
                playbackIndex={2}
                timeframe={'M5'}
                theme={'light'}
                onChartReady={onChartReady}
                showCanvasModal={false}
                setShowCanvasModal={() => { }}
            />
        );

        // Allow effects/useLayoutEffect to run
        await act(async () => { });

        // Ensure API was provided
        expect(api).toBeTruthy();
        // Call scrollToIndex to request scrolling
        api.scrollToIndex(1, 10);

        // The mocked lightweight-charts timeScale.setVisibleLogicalRange should be called
        const lc = await import('lightweight-charts');
        const chart = (lc.createChart as any).mock.results[0].value;
        const timeScale = chart.timeScale();
        expect(timeScale.setVisibleLogicalRange).toHaveBeenCalled();
    });

    it('panHandlers start/move/end update time and price ranges', async () => {
        // Prepare API capture
        let api: any = null;
        const onChartReady = (a: any) => { api = a; };

        const baseTicks = [
            { time: 1600000000, open: 1, high: 2, low: 0.5, close: 1.5 },
            { time: 1600000060, open: 1.5, high: 2.5, low: 1.4, close: 2.0 },
            { time: 1600000120, open: 2.0, high: 3.0, low: 1.9, close: 2.5 },
        ];

        render(
            <ChartContainer
                candles={baseTicks}
                baseTicks={baseTicks}
                baseTimeframe={'M1'}
                playbackIndex={2}
                timeframe={'M5'}
                theme={'light'}
                onChartReady={onChartReady}
                showCanvasModal={false}
                setShowCanvasModal={() => { }}
            />
        );

        await act(async () => { });

        // Retrieve panHandlers captured by our DrawingOverlay mock
        const panHandlers = (global as any).__LAST_DRAWING_PANHANDLERS;
        expect(panHandlers).toBeTruthy();

        const startSession = panHandlers.start(20, 100);
        expect(startSession).not.toBeNull();
        // Move the pan a bit
        panHandlers.move(startSession, 25, 110);

        const lc = await import('lightweight-charts');
        const chart = (lc.createChart as any).mock.results[0].value;
        const timeScale = chart.timeScale();
        const series = chart.addSeries();

        // timeScale.setVisibleLogicalRange should have been called by continuePan
        expect(timeScale.setVisibleLogicalRange).toHaveBeenCalled();

        // priceScale.setVisibleRange should have been called as vertical pan was attempted
        const priceScale = series.priceScale();
        expect(priceScale.setVisibleRange).toHaveBeenCalled();

        // Call end handler
        panHandlers.end();
        // end should have cleared panning flag internally and updated render tick; at minimum ensure it doesn't throw
    });

    it('converters.toCanvas extrapolates when timeToCoordinate returns null', async () => {
        const baseTicks = [
            { time: 1600000000, open: 1, high: 2, low: 0.5, close: 1.5 },
            { time: 1600000060, open: 1.5, high: 2.5, low: 1.4, close: 2.0 },
            { time: 1600000120, open: 2.0, high: 3.0, low: 1.9, close: 2.5 },
        ];

        render(
            <ChartContainer
                candles={baseTicks}
                baseTicks={baseTicks}
                baseTimeframe={'M1'}
                playbackIndex={2}
                timeframe={'M5'}
                theme={'light'}
                showCanvasModal={false}
                setShowCanvasModal={() => { }}
            />
        );

        await act(async () => { });

        const lc = await import('lightweight-charts');
        const chart = (lc.createChart as any).mock.results[0].value;
        const timeScale = chart.timeScale();

        // Make timeToCoordinate return null for target times, but defined for first/last candles
        timeScale.timeToCoordinate = vi.fn((t: any) => {
            const n = Number(t);
            if (n === baseTicks[0].time) return 100;
            if (n === baseTicks[baseTicks.length - 1].time) return 200;
            return null;
        });

        const converters = (global as any).__LAST_DRAWING_CONVERTERS;
        expect(converters).toBeTruthy();

        const out = converters.toCanvas ? converters.toCanvas({ time: 1600000180, price: 2.0 }) : null;
        // Extrapolation should produce a coordinate (not null)
        expect(out).not.toBeNull();
        if (out) {
            expect(Number.isFinite(out.x)).toBe(true);
            expect(Number.isFinite(out.y)).toBe(true);
        }
    });
});
