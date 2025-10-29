import { create } from 'zustand';
import { Position, ClosedTrade, AccountState, PositionSide } from '../types/trading';

const generateId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `pos-${Math.random().toString(36).slice(2)}-${Date.now()}`;
};

interface TradingState extends AccountState {
    positions: Position[];
    history: ClosedTrade[];
    // standard lot size in units (e.g. 100000 for forex standard lot)
    lotSize: number;
    setStartingBalance: (amount: number) => void;
    setLeverage: (lev: number) => void;
    setLotSize: (n: number) => void;
    openMarketPosition: (side: PositionSide, size: number, price: number, opts?: { stopLoss?: number; takeProfit?: number }) => string;
    placeLimitOrder: (side: PositionSide, size: number, price: number, opts?: { stopLoss?: number; takeProfit?: number; drawingId?: string }) => string;
    cancelOrder: (positionId: string) => void;
    closePosition: (positionId: string, price: number, time?: number) => void;
    updateMarketPrice: (priceOrBar: number | { high: number; low: number; price?: number }) => void;
    reset: () => void;
}

export const useTradingStore = create<TradingState>((set, get) => ({
    startingBalance: 10000,
    balance: 10000,
    realizedPnl: 0,
    unrealizedPnl: 0,
    equity: 10000,
    leverage: 100,
    lotSize: 100000,
    positions: [],
    history: [],
    setLotSize: (n: number) => {
        const v = Number.isFinite(n) ? n : 100000;
        return set(() => ({ lotSize: Math.max(1, v) }));
    },
    setStartingBalance: (amount: number) =>
        set(() => ({ startingBalance: amount, balance: amount, realizedPnl: 0, unrealizedPnl: 0, equity: amount })),
    setLeverage: (lev: number) => {
        // ensure leverage is a finite number and at least 1
        const v = Number.isFinite(lev) ? lev : 1;
        return set(() => ({ leverage: Math.max(1, v) }));
    },
    openMarketPosition: (side, size, price, opts) => {
        const id = generateId();
        const position: Position = {
            id,
            side,
            size,
            entryPrice: price,
            entryTime: Date.now(),
            stopLoss: opts?.stopLoss,
            takeProfit: opts?.takeProfit,
            orderType: 'market',
            status: 'open',
        };

        set((state) => ({ positions: [...state.positions, position] }));
        // update unrealized/equity immediately (caller should call updateMarketPrice with current price)
        return id;
    },
    placeLimitOrder: (side, size, price, opts) => {
        const id = generateId();
        const position: Position = {
            id,
            side,
            size,
            entryPrice: price,
            entryTime: Date.now(),
            stopLoss: opts?.stopLoss,
            takeProfit: opts?.takeProfit,
            orderType: 'limit',
            status: 'pending',
            drawingId: opts?.drawingId,
        };
        set((state) => ({ positions: [...state.positions, position] }));
        return id;
    },
    cancelOrder: (positionId) => {
        set((state) => ({ positions: state.positions.filter((p) => p.id !== positionId) }));
    },
    closePosition: (positionId, price, time) => {
        // eslint-disable-next-line no-console
        console.log('[tradingStore] closePosition called for', positionId, 'price', price);
        const state = get();
        const pos = state.positions.find((p) => p.id === positionId);
        if (!pos) {
            // eslint-disable-next-line no-console
            console.log('[tradingStore] closePosition: position not found', positionId);
            return;
        }
        // eslint-disable-next-line no-console
        console.log('[tradingStore] closePosition: found position', pos.id, 'status', pos.status);

        const pnl = computePnlForPosition(pos, price);

        const closed: ClosedTrade = {
            id: generateId(),
            positionId: pos.id,
            side: pos.side,
            size: pos.size,
            entryPrice: pos.entryPrice,
            exitPrice: price,
            entryTime: pos.entryTime,
            exitTime: time ?? Date.now(),
            realizedPnl: pnl,
        };

        set((s) => ({
            positions: s.positions.filter((p) => p.id !== positionId),
            history: [closed, ...s.history],
            balance: s.balance + pnl,
            realizedPnl: s.realizedPnl + pnl,
            unrealizedPnl: 0,
            equity: s.balance + pnl,
        }));
    },
    updateMarketPrice: (priceOrBar) => {
        const s = get();
        // normalize input: accept a number or an object { high, low, price? }
        const high = typeof priceOrBar === 'number' ? priceOrBar : priceOrBar.high;
        const low = typeof priceOrBar === 'number' ? priceOrBar : priceOrBar.low;
        const last = typeof priceOrBar === 'number' ? priceOrBar : (priceOrBar.price ?? (high + low) / 2);

        // Auto-execute pending limit orders when market price range (high/low) reaches the entry price
        const newPositions = s.positions.map((p) => {
            if (p.orderType === 'limit' && p.status === 'pending') {
                if (p.side === 'long' && low <= p.entryPrice) {
                    // eslint-disable-next-line no-console
                    console.log('[tradingStore] Executing pending long limit', p.id, 'at market low', low, 'entryPrice', p.entryPrice);
                    return { ...(p as Position), status: 'open', orderType: 'limit', entryTime: Date.now() } as Position;
                }
                if (p.side === 'short' && high >= p.entryPrice) {
                    // eslint-disable-next-line no-console
                    console.log('[tradingStore] Executing pending short limit', p.id, 'at market high', high, 'entryPrice', p.entryPrice);
                    return { ...(p as Position), status: 'open', orderType: 'limit', entryTime: Date.now() } as Position;
                }
            }
            return p;
        });
        // Replace positions with any executed ones
        set({ positions: newPositions as Position[] });

        // After executing pending orders, check open positions for TP/SL hits and close them
        const afterExecPositions = get().positions;
        const idsToClose: string[] = [];

        for (const p of afterExecPositions) {
            if (p.status !== 'open') continue;
            // Take Profit check using market high/low ranges
            if (p.takeProfit !== undefined) {
                // eslint-disable-next-line no-console
                console.log('[tradingStore] TP check for', p.id, 'side', p.side, 'high', high, 'low', low, 'tp', p.takeProfit);
                if (p.side === 'long' && high >= p.takeProfit) {
                    // eslint-disable-next-line no-console
                    console.log('[tradingStore] TP hit (long)', p.id, 'high', high, 'tp', p.takeProfit);
                    idsToClose.push(p.id);
                    continue; // already decided to close, skip SL check
                }
                if (p.side === 'short' && low <= p.takeProfit) {
                    // eslint-disable-next-line no-console
                    console.log('[tradingStore] TP hit (short)', p.id, 'low', low, 'tp', p.takeProfit);
                    idsToClose.push(p.id);
                    continue;
                }
            }
            // Stop Loss check using market high/low ranges
            if (p.stopLoss !== undefined) {
                // eslint-disable-next-line no-console
                console.log('[tradingStore] SL check for', p.id, 'side', p.side, 'high', high, 'low', low, 'sl', p.stopLoss);
                if (p.side === 'long' && low <= p.stopLoss) {
                    // eslint-disable-next-line no-console
                    console.log('[tradingStore] SL hit (long)', p.id, 'low', low, 'sl', p.stopLoss);
                    idsToClose.push(p.id);
                    continue;
                }
                if (p.side === 'short' && high >= p.stopLoss) {
                    // eslint-disable-next-line no-console
                    console.log('[tradingStore] SL hit (short)', p.id, 'high', high, 'sl', p.stopLoss);
                    idsToClose.push(p.id);
                    continue;
                }
            }
        }

        // Close any positions that hit TP/SL
        for (const id of idsToClose) {
            // Ensure position still exists before closing
            const pos = get().positions.find((p) => p.id === id);
            if (pos) {
                // eslint-disable-next-line no-console
                console.log('[tradingStore] Closing position', id, 'at price', last);
                // Use current last price as exit price
                get().closePosition(id, last);
            }
        }

        // Recompute unrealized PnL and equity after any closes
        const remaining = get().positions;
        const unrealized = remaining.reduce((acc, p) => acc + computePnlForPosition(p, last), 0);
        const equity = get().balance + unrealized;
        set({ unrealizedPnl: unrealized, equity });
    },
    reset: () => set((_) => ({ positions: [], history: [], startingBalance: 10000, balance: 10000, realizedPnl: 0, unrealizedPnl: 0, equity: 10000, leverage: 1 })),
}));

function computePnlForPosition(pos: Position, price: number) {
    // Pending orders have no PnL until executed
    if (pos.status === 'pending') return 0;
    // Simple P&L = (price - entry) * size for long, inverted for short
    const delta = price - pos.entryPrice;
    const signed = pos.side === 'long' ? delta : -delta;
    // `pos.size` is stored as units (base currency units). PnL is delta * units.
    // Historically this code multiplied by lotSize (treating size as lots). The app
    // stores sizes in units (consistent with the UI and other calculations), so
    // remove the extra multiplication here.
    return signed * pos.size;
}
