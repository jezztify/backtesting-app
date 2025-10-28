import React, { useEffect, useMemo, useState } from 'react';
import { useTradingStore } from '../state/tradingStore';

interface Props {
    currentPrice?: number;
}

const format = (n: number) => n.toFixed(2);

const TradingPanel: React.FC<Props> = ({ currentPrice }) => {
    const startingBalance = useTradingStore((s) => s.startingBalance);
    const balance = useTradingStore((s) => s.balance);
    const equity = useTradingStore((s) => s.equity);
    const realizedPnl = useTradingStore((s) => s.realizedPnl);
    const unrealizedPnl = useTradingStore((s) => s.unrealizedPnl);
    const positions = useTradingStore((s) => s.positions);
    const history = useTradingStore((s) => s.history);
    const openMarketPosition = useTradingStore((s) => s.openMarketPosition);
    const closePosition = useTradingStore((s) => s.closePosition);
    const updateMarketPrice = useTradingStore((s) => s.updateMarketPrice);

    const [collapsed, setCollapsed] = useState<boolean>(false);

    useEffect(() => {
        if (typeof currentPrice === 'number') {
            updateMarketPrice(currentPrice);
        }
    }, [currentPrice, updateMarketPrice]);

    // trading open handlers removed — buttons were removed from the UI per request

    const handleClose = (id: string) => {
        if (typeof currentPrice !== 'number') return;
        closePosition(id, currentPrice);
    };



    return (
        <div style={{ borderRadius: 8, background: '#fafafa', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 10, cursor: 'pointer' }} onClick={() => setCollapsed((c) => !c)}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <strong>Trading Panel</strong>
                    <span style={{ color: '#6b7280', fontSize: 12 }}>{collapsed ? '▲' : '▼'}</span>
                </div>
                <div style={{ fontSize: 12, color: '#374151' }}>{collapsed ? '▸' : '▾'}</div>
            </div>

            {!collapsed && (
                <div style={{ padding: 12 }}>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 12 }}>Starting</label>
                            <div style={{ fontWeight: 700 }}>${format(startingBalance)}</div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 12 }}>Equity</label>
                            <div style={{ fontWeight: 700 }}>${format(equity)}</div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 12 }}>Realized P&L</label>
                            <div style={{ fontWeight: 700 }}>${format(realizedPnl)}</div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 12 }}>Unrealized P&L</label>
                            <div style={{ fontWeight: 700 }}>${format(unrealizedPnl)}</div>
                        </div>
                    </div>

                    {/* Long/Short buttons removed per request */}

                    {/* Starting balance setter removed from UI per request */}

                    <hr />

                    <h4 style={{ margin: '8px 0' }}>Open Positions</h4>
                    {positions.length === 0 && <div style={{ color: '#6b7280' }}>No open positions</div>}
                    {positions.map((p) => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 8, borderRadius: 6, background: '#fff', marginBottom: 6, border: '1px solid #e5e7eb' }}>
                            <div>
                                <div style={{ fontWeight: 700 }}>{p.side.toUpperCase()} {p.size}</div>
                                <div style={{ fontSize: 12, color: '#6b7280' }}>Entry: {format(p.entryPrice)}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 700 }}>{typeof currentPrice === 'number' ? format(computePnl(p, currentPrice)) : '—'}</div>
                                <button onClick={() => handleClose(p.id)} style={{ marginTop: 6, padding: '6px 8px' }}>Close</button>
                            </div>
                        </div>
                    ))}

                    <h4 style={{ margin: '8px 0' }}>History</h4>
                    {history.length === 0 && <div style={{ color: '#6b7280' }}>No closed trades</div>}
                    <div style={{ maxHeight: 180, overflow: 'auto' }}>
                        {history.map((h) => (
                            <div key={h.id} style={{ padding: 8, borderRadius: 6, background: '#fff', marginBottom: 6, border: '1px solid #e5e7eb' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <div style={{ fontWeight: 700 }}>{h.side.toUpperCase()} {h.size}</div>
                                    <div style={{ fontWeight: 700 }}>${format(h.realizedPnl)}</div>
                                </div>
                                <div style={{ fontSize: 12, color: '#6b7280' }}>Entry {format(h.entryPrice)} → Exit {format(h.exitPrice)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

function computePnl(p: any, price: number) {
    const delta = price - p.entryPrice;
    const signed = p.side === 'long' ? delta : -delta;
    return signed * p.size;
}

export default TradingPanel;
