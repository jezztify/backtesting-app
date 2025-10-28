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
    setStartingBalance: (amount: number) => void;
    openMarketPosition: (side: PositionSide, size: number, price: number, opts?: { stopLoss?: number; takeProfit?: number }) => string;
    closePosition: (positionId: string, price: number, time?: number) => void;
    updateMarketPrice: (price: number) => void;
    reset: () => void;
}

export const useTradingStore = create<TradingState>((set, get) => ({
    startingBalance: 10000,
    balance: 10000,
    realizedPnl: 0,
    unrealizedPnl: 0,
    equity: 10000,
    positions: [],
    history: [],
    setStartingBalance: (amount: number) =>
        set(() => ({ startingBalance: amount, balance: amount, realizedPnl: 0, unrealizedPnl: 0, equity: amount })),
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
        };

        set((state) => ({ positions: [...state.positions, position] }));
        // update unrealized/equity immediately (caller should call updateMarketPrice with current price)
        return id;
    },
    closePosition: (positionId, price, time) => {
        const state = get();
        const pos = state.positions.find((p) => p.id === positionId);
        if (!pos) return;

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
    updateMarketPrice: (price) => {
        const s = get();
        const unrealized = s.positions.reduce((acc, p) => acc + computePnlForPosition(p, price), 0);
        const equity = s.balance + unrealized;
        set({ unrealizedPnl: unrealized, equity });
    },
    reset: () => set((_) => ({ positions: [], history: [], startingBalance: 10000, balance: 10000, realizedPnl: 0, unrealizedPnl: 0, equity: 10000 })),
}));

function computePnlForPosition(pos: Position, price: number) {
    // Simple P&L = (price - entry) * size for long, inverted for short
    const delta = price - pos.entryPrice;
    const signed = pos.side === 'long' ? delta : -delta;
    return signed * pos.size;
}
