import React from 'react';
import { render } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../components/PlaceLimitOrderModal', () => ({ default: () => React.createElement('div', null, 'place') }));
vi.mock('../state/tradingStore', () => ({
    useTradingStore: (selector: any) =>
        selector({
            startingBalance: 10000,
            balance: 10000,
            equity: 10000,
            realizedPnl: 0,
            unrealizedPnl: 0,
            positions: [],
            history: [],
            openMarketPosition: () => { },
            closePosition: () => { },
            placeLimitOrder: () => { },
            cancelOrder: () => { },
            updateMarketPrice: () => { },
            reset: () => { },
            leverage: 1,
            setLeverage: () => { },
            setStartingBalance: () => { },
            lotSize: 100000,
            setLotSize: () => { },
        }),
}));

import TradingPanel from '../components/TradingPanel';

describe('TradingPanel smoke', () => {
    it('renders without crashing', () => {
        const { container } = render(<TradingPanel /> as any);
        expect(container).toBeTruthy();
    });
});
