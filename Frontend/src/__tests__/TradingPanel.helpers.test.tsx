import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Reuse the same store mock pattern as other tests so DOM tests for the panel work
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

import TradingPanel, { computePnl, formatLot } from '../components/TradingPanel';

describe('TradingPanel helpers and small behaviors', () => {
    beforeEach(() => {
        // reset fns
        storeState.reset = vi.fn();
        storeState.setStartingBalance = vi.fn();
        storeState.setLeverage = vi.fn();
        storeState.setLotSize = vi.fn();
        storeState.history = [];
    });

    it('computePnl produces signed P&L for long and short positions', () => {
        const long = { side: 'long', entryPrice: 1, size: 100 } as any;
        const short = { side: 'short', entryPrice: 1.5, size: 50 } as any;

        // long: (price - entry) * size
        expect(computePnl(long, 1.5)).toBeCloseTo(50);

        // short: reversed sign
        // price moved to 1.2 -> delta = -0.3, signed = -(-0.3)? Actually computePnl uses signed = p.side === 'long' ? delta : -delta
        // for short at entry 1.5 price now 1.2 => delta = -0.3 -> signed = -(-0.3) = 0.3 -> pnl = 0.3 * size
        expect(computePnl(short, 1.2)).toBeCloseTo(0.3 * 50);
    });

    it('formatLot formats sizes to lots with pluralization and trimming', () => {
        expect(formatLot(100000, 100000)).toBe('1 lot');
        expect(formatLot(200000, 100000)).toBe('2 lots');
        expect(formatLot(150000, 100000)).toBe('1.5 lots');
        // negative sizes should keep sign
        expect(formatLot(-100000, 100000)).toBe('-1 lot');
        // non-finite should return stringified value
        expect(formatLot(Number.POSITIVE_INFINITY as any, 100000)).toBe(String(Number.POSITIVE_INFINITY));
    });

    it('Reset Account button calls store reset when confirmed', async () => {
        // make confirm return true
        const orig = (global as any).confirm;
        (global as any).confirm = () => true;

        render(<TradingPanel /> as any);

        const btn = screen.getByRole('button', { name: /Reset Account/i });
        await userEvent.click(btn);

        expect(storeState.reset).toHaveBeenCalled();

        // restore
        (global as any).confirm = orig;
    });
});
