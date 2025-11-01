import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

// Mutable store state used by the mock so tests can adjust values per-case
const storeState: any = {
    startingBalance: 1000,
    balance: 1000,
    equity: 1000,
    realizedPnl: 0,
    unrealizedPnl: 0,
    positions: [],
    history: [],
    openMarketPosition: vi.fn(),
    closePosition: vi.fn(),
    placeLimitOrder: vi.fn(),
    cancelOrder: vi.fn(),
    updateMarketPrice: vi.fn(),
    reset: vi.fn(),
    leverage: 1,
    setLeverage: vi.fn(),
    setStartingBalance: vi.fn(),
    lotSize: 100000,
    setLotSize: vi.fn(),
};

vi.mock('../state/tradingStore', () => ({
    useTradingStore: (selector: any) => selector(storeState),
}));

vi.mock('../components/PlaceLimitOrderModal', () => ({ default: () => React.createElement('div', null, 'place') }));

import TradingPanel from '../components/TradingPanel';

describe('TradingPanel unit', () => {
    beforeEach(() => {
        // reset fns and default values before each test
        storeState.startingBalance = 1000;
        storeState.balance = 1000;
        storeState.equity = 1000;
        storeState.realizedPnl = 0;
        storeState.unrealizedPnl = 0;
        storeState.positions = [];
        storeState.history = [];
        storeState.openMarketPosition = vi.fn();
        storeState.closePosition = vi.fn();
        storeState.placeLimitOrder = vi.fn();
        storeState.cancelOrder = vi.fn();
        storeState.updateMarketPrice = vi.fn();
        storeState.reset = vi.fn();
        storeState.setLeverage = vi.fn();
        storeState.setStartingBalance = vi.fn();
        storeState.setLotSize = vi.fn();
    });

    it('calculates and displays summary metrics (wins/losses/profitability/total P&L)', async () => {
        // create history with two wins and one loss
        storeState.startingBalance = 1000;
        storeState.history = [
            { id: 'a', realizedPnl: 50, exitTime: 1, entryPrice: 1, exitPrice: 2, side: 'long', size: 1 },
            { id: 'b', realizedPnl: -20, exitTime: 2, entryPrice: 2, exitPrice: 1, side: 'short', size: 1 },
            { id: 'c', realizedPnl: 30, exitTime: 3, entryPrice: 1, exitPrice: 1.3, side: 'long', size: 1 },
        ];

        await act(async () => {
            render(<TradingPanel /> as any);
        });

    // Verify numeric summary values are present
    expect(screen.getByText('3')).toBeTruthy();
    // Win / Loss should show 2 / 1 — read the numeric sibling element
    const winLossLabel = screen.getAllByText(/Win \/ Loss/i)[0];
    const winLossValue = winLossLabel.nextElementSibling?.textContent || '';
    expect(winLossValue).toMatch(/2\s*\/\s*1/);

    // Profitability: wins / total = 2/3 => ~66.7%
    expect(screen.getByText(/66\.7%/)).toBeTruthy();

    // Total P&L should be 60 (50 -20 +30)
    expect(screen.getByText(/\$60/)).toBeTruthy();
    });

    it('Account Options save applies setters on valid input', async () => {
        await act(async () => {
            render(<TradingPanel /> as any);
        });

        // Open account options
        const btn = screen.getByRole('button', { name: /Account Options/i });
        await userEvent.click(btn);

    // Find inputs by their current displayed values
    const startingInput = screen.getByDisplayValue('1000') as HTMLInputElement;
    const leverageInput = screen.getByDisplayValue('1') as HTMLInputElement;
    const lotInput = screen.getByDisplayValue('100000') as HTMLInputElement;

    // Change values
    await userEvent.clear(startingInput);
    await userEvent.type(startingInput, '5000');
    await userEvent.clear(leverageInput);
    await userEvent.type(leverageInput, '2');
    await userEvent.clear(lotInput);
    await userEvent.type(lotInput, '200000');

        // Click Save
        const saveBtn = screen.getByRole('button', { name: /Save/i });
        await userEvent.click(saveBtn);

        // Expect setters called with validated values
        expect(storeState.setStartingBalance).toHaveBeenCalledWith(5000);
        expect(storeState.setLeverage).toHaveBeenCalledWith(2);
        // Lot size is rounded
        expect(storeState.setLotSize).toHaveBeenCalledWith(200000);
    });
});
