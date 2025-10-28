import { describe, it, expect, beforeEach } from 'vitest';
import { useTradingStore } from '../state/tradingStore';

describe('tradingStore TP/SL behavior', () => {
    beforeEach(() => {
        // reset store
        useTradingStore.getState().reset();
    });

    it('closes market position when price reaches takeProfit (long)', () => {
        const store = useTradingStore.getState();
        // open a market long position at 1.2000 with TP at 1.2050 and SL at 1.1950
        const id = store.openMarketPosition('long', 100, 1.2, { takeProfit: 1.205, stopLoss: 1.195 });
        const s2 = useTradingStore.getState();
        // eslint-disable-next-line no-console
        console.log('after openMarketPosition positions:', s2.positions);
        expect(s2.positions.length).toBe(1);

        // simulate price moving to TP (bar high passes TP)
        store.updateMarketPrice({ high: 1.2051, low: 1.2051 });

        // position should be closed
        const afterClose = useTradingStore.getState();
        expect(afterClose.positions.length).toBe(0);
        expect(afterClose.history.length).toBe(1);
        expect(afterClose.history[0].exitPrice).toBe(1.2051);
    });

    it('closes market position when price reaches stopLoss (long)', () => {
        const store = useTradingStore.getState();
        const id = store.openMarketPosition('long', 50, 1.1, { takeProfit: 1.12, stopLoss: 1.09 });
        const s3 = useTradingStore.getState();
        // eslint-disable-next-line no-console
        console.log('after openMarketPosition positions (SL test):', s3.positions);
        expect(s3.positions.length).toBe(1);

        // simulate price moving to SL (bar low passes SL)
        store.updateMarketPrice({ high: 1.089, low: 1.089 });

        const after = useTradingStore.getState();
        expect(after.positions.length).toBe(0);
        expect(after.history.length).toBe(1);
        expect(after.history[0].exitPrice).toBe(1.089);
    });

    it('executes pending limit order and then hits TP', () => {
        const store = useTradingStore.getState();
        const id = store.placeLimitOrder('long', 10, 1.3, { takeProfit: 1.31, stopLoss: 1.29 });
        const s4 = useTradingStore.getState();
        // eslint-disable-next-line no-console
        console.log('after placeLimitOrder positions:', s4.positions);
        expect(s4.positions.length).toBe(1);
        expect(s4.positions[0].status).toBe('pending');

        // price reaches entry and executes limit (bar low reaches entry)
        store.updateMarketPrice({ high: 1.3, low: 1.3 });
        const afterExec = useTradingStore.getState();
        expect(afterExec.positions[0].status).toBe('open');

        // price reaches TP
        store.updateMarketPrice({ high: 1.3101, low: 1.3101 });
        const afterClose = useTradingStore.getState();
        expect(afterClose.positions.length).toBe(0);
        expect(afterClose.history.length).toBe(1);
        expect(afterClose.history[0].exitPrice).toBe(1.3101);
    });
});
