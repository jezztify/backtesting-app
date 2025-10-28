import React, { useEffect, useMemo, useState } from 'react';
import { useTradingStore } from '../state/tradingStore';

interface Props {
    currentPrice?: number;
}

const format = (n: number) => n.toFixed(2);

const Tab: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
    <button
        onClick={onClick}
        style={{
            padding: '6px 12px',
            borderRadius: 8,
            border: active ? '1px solid #111827' : '1px solid transparent',
            background: active ? '#fff' : 'transparent',
            cursor: 'pointer',
            fontWeight: active ? 700 : 500,
        }}
    >
        {label}
    </button>
);

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
    const STORAGE_KEY = 'tradingPanelHeight';
    const defaultHeight = 360;
    const minHeight = 120;
    const maxHeight = 900;
    const [height, setHeight] = useState<number>(() => {
        try {
            const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
            return raw ? Number(raw) : defaultHeight;
        } catch (e) {
            return defaultHeight;
        }
    });
    const resizingRef = React.useRef<{ startY: number; startHeight: number } | null>(null);

    const startResize = (clientY: number) => {
        resizingRef.current = { startY: clientY, startHeight: height };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        window.addEventListener('touchmove', onTouchMove as any, { passive: false });
        window.addEventListener('touchend', onTouchEnd as any);
    };

    const stopResize = () => {
        resizingRef.current = null;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        window.removeEventListener('touchmove', onTouchMove as any);
        window.removeEventListener('touchend', onTouchEnd as any);
        try {
            window.localStorage.setItem(STORAGE_KEY, String(height));
        } catch (e) {
            // ignore
        }
    };

    const onMouseMove = (e: MouseEvent) => {
        if (!resizingRef.current) return;
        const delta = e.clientY - resizingRef.current.startY;
        const next = Math.max(minHeight, Math.min(maxHeight, resizingRef.current.startHeight + delta));
        setHeight(next);
    };

    const onMouseUp = () => stopResize();

    const onTouchMove = (e: TouchEvent) => {
        if (!resizingRef.current) return;
        if (e.touches && e.touches[0]) {
            const delta = e.touches[0].clientY - resizingRef.current.startY;
            const next = Math.max(minHeight, Math.min(maxHeight, resizingRef.current.startHeight + delta));
            setHeight(next);
            e.preventDefault();
        }
    };

    const onTouchEnd = () => stopResize();
    const [activeTab, setActiveTab] = useState<'summary' | 'positions' | 'history'>('summary');

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
                </div>

                {/* center compact summary when collapsed */}
                {collapsed && (
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: '#6b7280' }}>Start</div>
                            <div style={{ fontWeight: 700, fontSize: 12 }}>${format(startingBalance)}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: '#6b7280' }}>Equity</div>
                            <div style={{ fontWeight: 700, fontSize: 12 }}>${format(equity)}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: '#6b7280' }}>Realized</div>
                            <div style={{ fontWeight: 700, fontSize: 12 }}>${format(realizedPnl)}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: '#6b7280' }}>Unrealized</div>
                            <div style={{ fontWeight: 700, fontSize: 12 }}>${format(unrealizedPnl)}</div>
                        </div>
                    </div>
                )}

                <div style={{ fontSize: 12, color: '#374151' }}>{collapsed ? '▲' : '▼'}</div>
            </div>

            {!collapsed && (
                <div style={{ padding: 12, height, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>

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

                    {/* Styled tabs */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        <Tab
                            label="Summary"
                            active={activeTab === 'summary'}
                            onClick={() => setActiveTab('summary')}
                        />
                        <Tab
                            label="Positions"
                            active={activeTab === 'positions'}
                            onClick={() => setActiveTab('positions')}
                        />
                        <Tab
                            label="History"
                            active={activeTab === 'history'}
                            onClick={() => setActiveTab('history')}
                        />
                    </div>

                    <div style={{ flex: 1 }}>
                        {activeTab === 'summary' && (
                            <div style={{ color: '#6b7280', fontSize: 13 }}>Account summary is shown above. Use Positions or History to view trades.</div>
                        )}

                        {activeTab === 'positions' && (
                            <div>
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
                            </div>
                        )}

                        {activeTab === 'history' && (
                            <div>
                                <h4 style={{ margin: '8px 0' }}>History</h4>
                                {history.length === 0 && <div style={{ color: '#6b7280' }}>No closed trades</div>}
                                <div style={{ maxHeight: 220, overflow: 'auto' }}>
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

                    {/* resizer */}
                    <div
                        onMouseDown={(e) => startResize(e.clientY)}
                        onTouchStart={(e) => startResize(e.touches[0].clientY)}
                        style={{ height: 10, cursor: 'row-resize', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Drag to resize"
                    >
                        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e5e7eb' }} />
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
