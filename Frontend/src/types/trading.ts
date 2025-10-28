export type PositionSide = 'long' | 'short';

export interface Position {
    id: string;
    side: PositionSide;
    size: number; // units (contract size)
    entryPrice: number;
    entryTime: number; // unix timestamp
    stopLoss?: number;
    takeProfit?: number;
}

export interface ClosedTrade {
    id: string;
    positionId: string;
    side: PositionSide;
    size: number;
    entryPrice: number;
    exitPrice: number;
    entryTime: number;
    exitTime: number;
    realizedPnl: number;
}

export interface AccountState {
    startingBalance: number;
    balance: number; // cash + realized pnl
    realizedPnl: number;
    unrealizedPnl: number;
    equity: number; // balance + unrealized
}
