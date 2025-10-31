import React from 'react';
import { render } from '@testing-library/react';
import { vi } from 'vitest';

// Mock PropertiesPanelModal and PlaceLimitOrderModal which DrawingOverlay imports
vi.mock('../components/PropertiesPanelModal', () => ({ default: () => React.createElement('div', null, 'props-modal') }));
vi.mock('../components/PlaceLimitOrderModal', () => ({ default: () => React.createElement('div', null, 'place-order') }));

// Mock drawing and trading stores
vi.mock('../state/drawingStore', () => ({
    useDrawingStore: (selector: any) => selector({
        activeTool: 'select',
        drawings: [],
        draft: null,
        selectionId: null,
        beginDraft: () => { },
        updateDraft: () => { },
        commitDraft: () => { },
        cancelDraft: () => { },
        selectDrawing: () => { },
        createHistoryCheckpoint: () => { },
        updateDrawingPoints: () => { },
        updatePositionStyle: () => { },
    }),
}));
vi.mock('../state/tradingStore', () => ({
    useTradingStore: (selector: any) => selector({ placeLimitOrder: () => { }, cancelOrder: () => { }, positions: [], equity: 1000 }),
}));

// Mock geometry utils used heavily
vi.mock('../utils/geometry', () => ({
    distanceToSegment: () => 1,
    extendLineToBounds: () => ({ x1: 0, y1: 0, x2: 10, y2: 10 }),
    isPointInRect: () => false,
    clipLineToBounds: () => ({ x1: 0, y1: 0, x2: 10, y2: 10 }),
}));

import DrawingOverlay from '../components/DrawingOverlay';

describe('DrawingOverlay smoke', () => {
    it('renders without crashing', () => {
        const converters = {
            toCanvas: () => ({ x: 10, y: 10 }),
            toChart: () => ({ time: 1, price: 1 }),
        };

        const { container } = render(
            <svg>
                <DrawingOverlay width={200} height={200} converters={converters as any} renderTick={0} pricePrecision={5} />
            </svg>
        );

        expect(container).toBeTruthy();
    });
});
