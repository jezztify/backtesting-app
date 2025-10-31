import React from 'react';
import { render } from '@testing-library/react';
import { vi } from 'vitest';

// Mock lightweight-charts to avoid creating real charts
vi.mock('lightweight-charts', () => ({
    ColorType: { Solid: 'Solid' },
    createChart: (container: any) => {
        const series = {
            applyOptions: () => { },
            priceScale: () => ({ getVisibleRange: () => ({ from: 0, to: 100 }), setVisibleRange: () => { } }),
            setData: () => { },
            update: () => { },
        };

        const chart = {
            applyOptions: () => { },
            addSeries: () => series,
            timeScale: () => ({
                getVisibleLogicalRange: () => ({ from: 0, to: 100 }),
                getVisibleRange: () => ({ from: 0, to: 100 }),
                subscribeVisibleTimeRangeChange: (cb: any) => {
                    // return unsubscribe
                    return () => { };
                },
                unsubscribeVisibleTimeRangeChange: (_cb: any) => { },
            }),
            remove: () => { },
            resize: (_w: number, _h: number) => { },
        };
        return chart;
    },
    CandlestickSeries: Symbol('CandlestickSeries'),
}));

// Mock ResizeObserver (used by ChartContainer internals)
// @ts-ignore
global.ResizeObserver = class {
    observe() { }
    disconnect() { }
};

// Mock canvas store used by ChartContainer
vi.mock('../state/canvasStore', () => {
    const useCanvasStore = (selector: any) => selector({
        settings: { background: '#fff', upFill: '#0f0', downFill: '#f00', upWick: '#0f0', downWick: '#f00', upBorder: '#0f0', downBorder: '#f00' },
        setSettings: () => { },
        resetSettings: () => { },
    });
    // zustand stores expose getState; provide a minimal implementation
    // @ts-ignore
    useCanvasStore.getState = () => ({ setSettings: () => { } });
    return { useCanvasStore };
});

import ChartContainer from '../components/ChartContainer';

describe('ChartContainer smoke', () => {
    it('renders without crashing', () => {
        const { container } = render(
            <ChartContainer
                candles={[]}
                baseTicks={[]}
                baseTimeframe={'M1'}
                playbackIndex={0}
                timeframe={'Daily'}
                theme={'light'}
                showCanvasModal={false}
                setShowCanvasModal={() => { }}
            />
        );

        expect(container).toBeTruthy();
    });
});
