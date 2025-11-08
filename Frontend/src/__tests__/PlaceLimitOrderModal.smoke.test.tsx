import React from 'react';
import { render } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../state/tradingStore', () => ({
    useTradingStore: (selector: any) => selector({ placeLimitOrder: () => { }, cancelOrder: () => { }, positions: [], equity: 1000 }),
}));

import PlaceLimitOrderModal from '../components/PlaceLimitOrderModal';

describe('PlaceLimitOrderModal smoke', () => {
    it('renders without crashing', () => {
        const { container } = render(
            <PlaceLimitOrderModal 
                drawing={null} 
                equity={1000} 
                pricePrecision={5}
                onPlace={() => {}} 
                onCancel={() => {}}
                onClose={() => {}} 
            />
        );
        expect(container).toBeTruthy();
    });
});
