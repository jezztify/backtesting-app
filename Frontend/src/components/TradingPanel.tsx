import React, { useEffect, useMemo, useState } from 'react';
import { useTradingStore } from '../state/tradingStore';
import { formatPrice } from '../utils/format';
// Recharts for interactive charts
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    BarChart,
    Bar,
    AreaChart,
    Area,
    CartesianGrid,
    PieChart as RePieChart,
    Pie,
    Cell,
} from 'recharts';

interface Props {
    currentPrice?: number;
    pricePrecision?: number;
}

const format = (n: number, precision: number = 2) => formatPrice(n, precision);

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

const TradingPanel: React.FC<Props> = ({ currentPrice, pricePrecision = 2 }) => {
    const startingBalance = useTradingStore((s) => s.startingBalance);
    const balance = useTradingStore((s) => s.balance);
    const equity = useTradingStore((s) => s.equity);
    const realizedPnl = useTradingStore((s) => s.realizedPnl);
    const unrealizedPnl = useTradingStore((s) => s.unrealizedPnl);
    const positions = useTradingStore((s) => s.positions);
    const history = useTradingStore((s) => s.history);
    const openMarketPosition = useTradingStore((s) => s.openMarketPosition);
    const closePosition = useTradingStore((s) => s.closePosition);
    const placeLimitOrder = useTradingStore((s) => (s as any).placeLimitOrder as ((side: any, size: number, price: number, opts?: any) => string));
    const cancelOrder = useTradingStore((s) => (s as any).cancelOrder as ((id: string) => void));
    const updateMarketPrice = useTradingStore((s) => s.updateMarketPrice);
    const resetAccountStore = useTradingStore((s) => s.reset);
    const leverage = useTradingStore((s) => (s as any).leverage as number);
    const setLeverage = useTradingStore((s) => (s as any).setLeverage as (n: number) => void);
    const setStartingBalance = useTradingStore((s) => s.setStartingBalance);
    const lotSize = useTradingStore((s) => (s as any).lotSize as number);
    const setLotSize = useTradingStore((s) => (s as any).setLotSize as (n: number) => void);

    const [collapsed, setCollapsed] = useState<boolean>(false);
    const [showAccountOptions, setShowAccountOptions] = useState<boolean>(false);
    const [tempStartingBalance, setTempStartingBalance] = useState<number>(startingBalance);
    const [tempLeverage, setTempLeverage] = useState<number>(leverage || 1);
    const [tempLotSize, setTempLotSize] = useState<number>(lotSize || 100000);

    useEffect(() => {
        setTempStartingBalance(startingBalance);
        setTempLeverage(leverage || 1);
        setTempLotSize(lotSize || 100000);
    }, [startingBalance, leverage, lotSize]);
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
    const [activeTab, setActiveTab] = useState<'summary' | 'positions' | 'history' | 'orders'>('summary');

    const handleResetAccount = () => {
        // reset store state
        resetAccountStore();
        // reset UI state
        setActiveTab('summary');
        setChartType('equity');
        setCollapsed(false);
        setHeight(defaultHeight);
        try {
            if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            // ignore
        }
    };

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

    // Orders / contingent lists
    const entryOrders = positions.filter((p) => p.status === 'pending');
    const tpOrders = positions.filter((p) => p.status === 'open' && p.takeProfit !== undefined);
    const slOrders = positions.filter((p) => p.status === 'open' && p.stopLoss !== undefined);

    // Compute summary stats (equity curve, win/loss, Sharpe, profitability)
    const summary = useMemo(() => {
        const sorted = [...history].sort((a, b) => a.exitTime - b.exitTime);
        const equityPoints: { t: number; equity: number }[] = [];

        let bal = startingBalance;
        equityPoints.push({ t: Date.now(), equity: bal }); // starting point

        let wins = 0;
        let losses = 0;
        const returns: number[] = [];

        for (const h of sorted) {
            // return computed against balance before this trade
            const r = h.realizedPnl / Math.max(1, bal);
            returns.push(r);
            if (h.realizedPnl > 0) wins += 1;
            if (h.realizedPnl < 0) losses += 1;
            bal += h.realizedPnl;
            equityPoints.push({ t: h.exitTime, equity: bal });
        }

        // Per-trade PnL series (chronological)
        const perTradePnls = sorted.map((h) => h.realizedPnl);

        // Drawdown series computed from equityPoints
        const drawdowns: number[] = [];
        let peak = -Infinity;
        for (const p of equityPoints) {
            if (p.equity > peak) peak = p.equity;
            drawdowns.push(((peak - p.equity) / Math.max(1, peak)) * 100);
        }

        const total = wins + losses;
        const profitability = total > 0 ? (wins / total) * 100 : NaN;
        const winLossRatio = losses > 0 ? (wins / losses) : (wins > 0 ? Infinity : NaN);

        // Sharpe-like metric on per-trade returns (risk-free = 0). Use sqrt(N) scaling.
        let sharpe = NaN;
        if (returns.length > 0) {
            const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
            const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
            const std = Math.sqrt(variance);
            if (std > 0) {
                sharpe = (mean / std) * Math.sqrt(returns.length);
            } else {
                sharpe = mean > 0 ? Infinity : 0;
            }
        }

        const totalPnL = bal - startingBalance;

        return { equityPoints, perTradePnls, drawdowns, wins, losses, profitability, winLossRatio, sharpe, totalPnL, totalTrades: total };
    }, [history, startingBalance]);



    // chart selector state
    const [chartType, setChartType] = useState<'equity' | 'pnl' | 'drawdown' | 'winloss'>('equity');

    return (
        <div className="trading-panel" style={{ borderRadius: 8, background: '#fafafa', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 10, cursor: 'pointer' }} onClick={() => setCollapsed((c) => !c)}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <strong className="trading-panel-title">Trading Panel</strong>
                </div>

                {/* center compact summary when collapsed */}
                {collapsed && (
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                        <div style={{ textAlign: 'center' }}>
                            <div className="tp-label" style={{ fontSize: 11, color: '#6b7280' }}>Start</div>
                            <div className="tp-value" style={{ fontWeight: 700, fontSize: 12 }}>${format(startingBalance)}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div className="tp-label" style={{ fontSize: 11, color: '#6b7280' }}>Equity</div>
                            <div className="tp-value" style={{ fontWeight: 700, fontSize: 12 }}>${format(equity)}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div className="tp-label" style={{ fontSize: 11, color: '#6b7280' }}>Realized</div>
                            <div className="tp-value" style={{ fontWeight: 700, fontSize: 12 }}>${format(realizedPnl)}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div className="tp-label" style={{ fontSize: 11, color: '#6b7280' }}>Unrealized</div>
                            <div className="tp-value" style={{ fontWeight: 700, fontSize: 12 }}>${format(unrealizedPnl)}</div>
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowAccountOptions((s) => !s);
                        }}
                        title="Account options"
                        style={{ padding: '6px 8px', borderRadius: 6, background: '#fff', border: '1px solid #d1d5db', color: '#111827', cursor: 'pointer' }}
                    >
                        Account Options
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            try {
                                const ok = typeof window !== 'undefined' ? window.confirm('Reset account? This will clear positions, orders, history and reset balances to starting values.') : false;
                                if (ok) handleResetAccount();
                            } catch (err) {
                                // fallback to direct reset if confirm fails
                                handleResetAccount();
                            }
                        }}
                        title="Reset account (clears positions, history and account state)"
                        style={{ padding: '6px 8px', borderRadius: 6, background: '#fff', border: '1px solid #ef4444', color: '#ef4444', cursor: 'pointer' }}
                    >
                        Reset Account
                    </button>
                    <div style={{ fontSize: 12, color: '#374151' }}>{collapsed ? '▲' : '▼'}</div>
                </div>
            </div>

            {!collapsed && (
                <div style={{ padding: 12, height, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                            <label className="tp-label" style={{ fontSize: 12 }}>Starting</label>
                            <div className="tp-value" style={{ fontWeight: 700 }}>${format(startingBalance, pricePrecision)}</div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label className="tp-label" style={{ fontSize: 12 }}>Equity</label>
                            <div className="tp-value" style={{ fontWeight: 700 }}>${format(equity, pricePrecision)}</div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label className="tp-label" style={{ fontSize: 12 }}>Realized P&L</label>
                            <div className="tp-value" style={{ fontWeight: 700 }}>${format(realizedPnl, pricePrecision)}</div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label className="tp-label" style={{ fontSize: 12 }}>Unrealized P&L</label>
                            <div className="tp-value" style={{ fontWeight: 700 }}>${format(unrealizedPnl, pricePrecision)}</div>
                        </div>
                    </div>

                    {/* Long/Short buttons removed per request */}

                    {showAccountOptions && (
                        <div style={{ marginBottom: 12, background: '#fff', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: 12, color: '#6b7280' }}>Starting Balance</label>
                                    <input
                                        type="number"
                                        value={tempStartingBalance}
                                        onChange={(e) => setTempStartingBalance(Number(e.target.value))}
                                        style={{ width: '100%', padding: '6px 8px', marginTop: 6, borderRadius: 6, border: '1px solid #e5e7eb' }}
                                    />
                                </div>
                                <div style={{ width: 140 }}>
                                    <label style={{ fontSize: 12, color: '#6b7280' }}>Leverage</label>
                                    <input
                                        type="number"
                                        min={1}
                                        step={0.1}
                                        value={tempLeverage}
                                        onChange={(e) => setTempLeverage(Number(e.target.value))}
                                        style={{ width: '100%', padding: '6px 8px', marginTop: 6, borderRadius: 6, border: '1px solid #e5e7eb' }}
                                    />
                                </div>
                                <div style={{ width: 160 }}>
                                    <label style={{ fontSize: 12, color: '#6b7280' }}>Standard Lot Size (units)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        step={1}
                                        value={tempLotSize}
                                        onChange={(e) => setTempLotSize(Number(e.target.value))}
                                        style={{ width: '100%', padding: '6px 8px', marginTop: 6, borderRadius: 6, border: '1px solid #e5e7eb' }}
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        // apply changes to store
                                        if (!Number.isFinite(tempStartingBalance) || tempStartingBalance <= 0) return;
                                        // validate leverage input to avoid saving NaN/Infinity or values < 1
                                        if (!Number.isFinite(tempLeverage) || tempLeverage < 1) return;
                                        if (!Number.isFinite(tempLotSize) || tempLotSize < 1) return;
                                        setStartingBalance(tempStartingBalance);
                                        setLeverage(Math.max(1, tempLeverage));
                                        setLotSize(Math.max(1, Math.round(tempLotSize)));
                                        setShowAccountOptions(false);
                                    }}
                                    style={{ padding: '6px 10px', borderRadius: 6, background: '#111827', color: '#fff', border: 'none', cursor: 'pointer' }}
                                >
                                    Save
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        // reset temp to current values and close
                                        setTempStartingBalance(startingBalance);
                                        setTempLeverage(leverage || 1);
                                        setTempLotSize(lotSize || 100000);
                                        setShowAccountOptions(false);
                                    }}
                                    style={{ padding: '6px 10px', borderRadius: 6, background: 'transparent', color: '#111827', border: '1px solid #e5e7eb', cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
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
                            label="Orders"
                            active={activeTab === 'orders'}
                            onClick={() => setActiveTab('orders')}
                        />
                        <Tab
                            label="History"
                            active={activeTab === 'history'}
                            onClick={() => setActiveTab('history')}
                        />
                    </div>

                    <div style={{ flex: 1 }}>
                        {activeTab === 'summary' && (
                            <div>
                                <div style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'center' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                                            <label style={{ fontSize: 12, marginRight: 8 }}>Chart</label>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button onClick={() => setChartType('equity')} style={{ padding: '4px 8px', borderRadius: 6, background: chartType === 'equity' ? '#111827' : 'transparent', color: chartType === 'equity' ? '#fff' : undefined }}>Equity</button>
                                                <button onClick={() => setChartType('pnl')} style={{ padding: '4px 8px', borderRadius: 6, background: chartType === 'pnl' ? '#111827' : 'transparent', color: chartType === 'pnl' ? '#fff' : undefined }}>P&amp;L</button>
                                                <button onClick={() => setChartType('drawdown')} style={{ padding: '4px 8px', borderRadius: 6, background: chartType === 'drawdown' ? '#111827' : 'transparent', color: chartType === 'drawdown' ? '#fff' : undefined }}>Drawdown</button>
                                                <button onClick={() => setChartType('winloss')} style={{ padding: '4px 8px', borderRadius: 6, background: chartType === 'winloss' ? '#111827' : 'transparent', color: chartType === 'winloss' ? '#fff' : undefined }}>Win/Loss</button>
                                            </div>
                                        </div>

                                        <label style={{ fontSize: 12 }}>{chartType === 'equity' ? 'Equity Curve' : chartType === 'pnl' ? 'Cumulative P&L' : chartType === 'drawdown' ? 'Drawdown (%)' : 'Win / Loss'}</label>
                                        <div style={{ marginTop: 6, background: '#fff', padding: 8, borderRadius: 6, border: '1px solid #e5e7eb' }}>
                                            {/* Chart rendering */}
                                            {chartType === 'equity' && <Sparkline points={summary.equityPoints.map((p) => p.equity)} />}
                                            {chartType === 'pnl' && (
                                                // Show cumulative realized P&L as a line chart (relative to starting balance)
                                                <Sparkline points={summary.equityPoints.map((p) => p.equity - startingBalance)} color="#10b981" />
                                            )}
                                            {chartType === 'drawdown' && <AreaSparkline points={summary.drawdowns || []} color="#ef4444" />}
                                            {chartType === 'winloss' && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120 }}><PieChart wins={summary.wins} losses={summary.losses} size={120} /></div>}
                                        </div>
                                    </div>

                                    <div style={{ width: 220, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <div style={{ color: '#6b7280', fontSize: 12 }}>Trades</div>
                                            <div style={{ fontWeight: 700 }}>{summary.totalTrades}</div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <div style={{ color: '#6b7280', fontSize: 12 }}>Win / Loss</div>
                                            <div style={{ fontWeight: 700 }}>{summary.wins} / {summary.losses}</div>

                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <div style={{ color: '#6b7280', fontSize: 12 }}>Profitability</div>
                                            <div style={{ fontWeight: 700 }}>{Number.isFinite(summary.profitability) ? `${summary.profitability.toFixed(1)}%` : '—'}</div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <div style={{ color: '#6b7280', fontSize: 12 }}>Sharpe (per-trade)</div>
                                            <div style={{ fontWeight: 700 }}>{Number.isFinite(summary.sharpe) ? summary.sharpe === Infinity ? '∞' : summary.sharpe.toFixed(2) : '—'}</div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <div style={{ color: '#6b7280', fontSize: 12 }}>Total P&L</div>
                                            <div style={{ fontWeight: 700 }}>${format(summary.totalPnL, pricePrecision)}</div>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ color: '#6b7280', fontSize: 12 }}>Summary metrics above are calculated from closed trades in History.</div>
                            </div>
                        )}

                        {activeTab === 'positions' && (
                            <div>
                                <h4 style={{ margin: '8px 0' }}>Open Positions</h4>
                                {positions.length === 0 && <div style={{ color: '#6b7280' }}>No open positions</div>}
                                {positions.map((p) => (
                                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 8, borderRadius: 6, background: '#fff', marginBottom: 6, border: '1px solid #e5e7eb' }}>
                                        <div>
                                            <div style={{ fontWeight: 700 }}>{p.side.toUpperCase()} {formatLot(p.size, lotSize)} {p.status === 'pending' ? <span style={{ fontSize: 12, color: '#f59e0b', marginLeft: 8 }}>PENDING</span> : null}</div>
                                            <div style={{ fontSize: 12, color: '#6b7280' }}>
                                                <div>Entry: {format(p.entryPrice, pricePrecision)}</div>
                                                {p.takeProfit !== undefined && (
                                                    <div>TP: {format(p.takeProfit, pricePrecision)}</div>
                                                )}
                                                {p.stopLoss !== undefined && (
                                                    <div>SL: {format(p.stopLoss, pricePrecision)}</div>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: 700 }}>{p.status === 'pending' ? '—' : typeof currentPrice === 'number' ? format(computePnl(p, currentPrice), pricePrecision) : '—'}</div>
                                            {p.status === 'pending' ? (
                                                <button onClick={() => cancelOrder(p.id)} style={{ marginTop: 6, padding: '6px 8px' }}>Cancel</button>
                                            ) : (
                                                <button onClick={() => handleClose(p.id)} style={{ marginTop: 6, padding: '6px 8px' }}>Close</button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeTab === 'orders' && (
                            <div>
                                <h4 style={{ margin: '8px 0' }}>Orders</h4>

                                {/* ENTRY orders (pending limit entries) */}
                                <div style={{ marginBottom: 10 }}>
                                    <h5 style={{ margin: '6px 0' }}>ENTRY</h5>
                                    {entryOrders.length === 0 ? (
                                        <div style={{ color: '#6b7280' }}>No pending entry orders</div>
                                    ) : (
                                        entryOrders.map((o) => (
                                            <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 8, borderRadius: 6, background: '#fff', marginBottom: 6, border: '1px solid #e5e7eb' }}>
                                                <div>
                                                    <div style={{ fontWeight: 700 }}>{o.side.toUpperCase()} {formatLot(o.size, lotSize)}</div>
                                                    <div style={{ fontSize: 12, color: '#6b7280' }}>Entry: {format(o.entryPrice, pricePrecision)}</div>
                                                    {o.takeProfit !== undefined && <div style={{ fontSize: 12, color: '#6b7280' }}>TP: {format(o.takeProfit, pricePrecision)}</div>}
                                                    {o.stopLoss !== undefined && <div style={{ fontSize: 12, color: '#6b7280' }}>SL: {format(o.stopLoss, pricePrecision)}</div>}
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontWeight: 700, color: '#f59e0b' }}>PENDING</div>
                                                    <div style={{ marginTop: 6 }}>
                                                        <button onClick={() => cancelOrder(o.id)} style={{ padding: '6px 8px' }}>Cancel</button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* TAKE-PROFIT contingent orders for open positions */}
                                <div style={{ marginBottom: 10 }}>
                                    <h5 style={{ margin: '6px 0' }}>TP</h5>
                                    {tpOrders.length === 0 ? (
                                        <div style={{ color: '#6b7280' }}>No active take-profit orders</div>
                                    ) : (
                                        tpOrders.map((p) => (
                                            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 8, borderRadius: 6, background: '#fff', marginBottom: 6, border: '1px solid #e5e7eb' }}>
                                                <div>
                                                    <div style={{ fontWeight: 700 }}>{p.side.toUpperCase()} {formatLot(p.size, lotSize)}</div>
                                                    <div style={{ fontSize: 12, color: '#6b7280' }}>TP: {format(p.takeProfit!, pricePrecision)}</div>
                                                    <div style={{ fontSize: 12, color: '#6b7280' }}>Entry: {format(p.entryPrice, pricePrecision)}</div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontWeight: 700, color: '#10b981' }}>ACTIVE</div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* STOP-LOSS contingent orders for open positions */}
                                <div>
                                    <h5 style={{ margin: '6px 0' }}>SL</h5>
                                    {slOrders.length === 0 ? (
                                        <div style={{ color: '#6b7280' }}>No active stop-loss orders</div>
                                    ) : (
                                        slOrders.map((p) => (
                                            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 8, borderRadius: 6, background: '#fff', marginBottom: 6, border: '1px solid #e5e7eb' }}>
                                                <div>
                                                    <div style={{ fontWeight: 700 }}>{p.side.toUpperCase()} {formatLot(p.size, lotSize)}</div>
                                                    <div style={{ fontSize: 12, color: '#6b7280' }}>SL: {format(p.stopLoss!, pricePrecision)}</div>
                                                    <div style={{ fontSize: 12, color: '#6b7280' }}>Entry: {format(p.entryPrice, pricePrecision)}</div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontWeight: 700, color: '#ef4444' }}>ACTIVE</div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
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
                                                <div style={{ fontWeight: 700 }}>{h.side.toUpperCase()} {formatLot(h.size, lotSize)}</div>
                                                <div style={{ fontWeight: 700 }}>${format(h.realizedPnl, pricePrecision)}</div>
                                            </div>
                                            <div style={{ fontSize: 12, color: '#6b7280' }}>Entry {format(h.entryPrice, pricePrecision)} → Exit {format(h.exitPrice, pricePrecision)}</div>
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

// Small sparkline renderer for equity curve (very lightweight)
const Sparkline: React.FC<{ points: number[]; labels?: string[]; width?: number; height?: number; color?: string; showAxes?: boolean }> = ({ points, labels, width = 400, height = 180, color = '#2563eb', showAxes = true }) => {
    if (!points || points.length === 0) {
        return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>No data</div>;
    }
    // reserve margins for axes when requested
    const marginLeft = showAxes ? 36 : 4;
    const marginBottom = showAxes ? 18 : 4;
    const marginTop = 6;
    const marginRight = 6;

    const innerW = Math.max(10, width - marginLeft - marginRight);
    const innerH = Math.max(10, height - marginTop - marginBottom);

    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;

    const step = innerW / (points.length - 1 || 1);
    const coords = points.map((v, i) => {
        const x = marginLeft + i * step;
        const y = marginTop + (innerH - ((v - min) / range) * innerH);
        return { x, y };
    });

    const path = `M${coords.map((c) => `${c.x},${c.y}`).join(' L ')}`;

    // axis labels
    const yTop = (max).toFixed(2);
    const yBottom = (min).toFixed(2);
    const xLeft = labels && labels.length > 0 ? labels[0] : '1';
    const xRight = labels && labels.length > 0 ? labels[labels.length - 1] : String(points.length - 1);

    // Convert to Recharts data format
    const data = points.map((v, i) => ({
        label: labels && labels.length > i ? labels[i] : String(i),
        value: v,
    }));

    const tickFormatter = (val: string) => {
        // short label for tight space
        return val.length > 12 ? val.slice(0, 12) + '…' : val;
    };

    return (
        <div style={{ width, height }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="label" tickFormatter={tickFormatter} interval={'preserveStartEnd'} />
                    <YAxis />
                    <Tooltip formatter={(v: any) => [Number(v).toFixed(2), 'Value']} labelFormatter={(l) => l} />
                    <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

// Bars for per-trade P&L
const BarSparkline: React.FC<{ points: number[]; labels?: string[]; width?: number; height?: number; showAxes?: boolean }> = ({ points, labels, width = 400, height = 180, showAxes = true }) => {
    if (!points || points.length === 0) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>No data</div>;
    // margins
    const marginLeft = showAxes ? 36 : 4;
    const marginBottom = showAxes ? 18 : 4;
    const marginTop = 6;
    const marginRight = 6;

    const innerW = Math.max(10, width - marginLeft - marginRight);
    const innerH = Math.max(10, height - marginTop - marginBottom);

    const max = Math.max(...points.map(Math.abs)) || 1;
    const barW = innerW / points.length;
    const data = points.map((v, i) => ({ label: labels && labels.length > i ? labels[i] : String(i), value: v }));

    const tickFormatter = (val: string) => (val.length > 12 ? val.slice(0, 12) + '…' : val);

    return (
        <div style={{ width, height }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="label" tickFormatter={tickFormatter} interval={'preserveStartEnd'} />
                    <YAxis />
                    <Tooltip formatter={(v: any) => [Number(v).toFixed(2), 'P&L']} labelFormatter={(l) => l} />
                    <Bar dataKey="value">
                        {data.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.value >= 0 ? '#10b981' : '#ef4444'} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

// Area sparkline for drawdown (percentage)
const AreaSparkline: React.FC<{ points: number[]; labels?: string[]; width?: number; height?: number; color?: string; showAxes?: boolean }> = ({ points, labels, width = 400, height = 180, color = '#ef4444', showAxes = true }) => {
    if (!points || points.length === 0) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>No data</div>;
    const marginLeft = showAxes ? 36 : 4;
    const marginBottom = showAxes ? 18 : 4;
    const marginTop = 6;
    const marginRight = 6;

    const innerW = Math.max(10, width - marginLeft - marginRight);
    const innerH = Math.max(10, height - marginTop - marginBottom);

    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const step = innerW / (points.length - 1 || 1);
    const coords = points.map((v, i) => {
        const x = marginLeft + i * step;
        const y = marginTop + (innerH - ((v - min) / range) * innerH);
        return { x, y };
    });
    const data = points.map((v, i) => ({ label: labels && labels.length > i ? labels[i] : String(i), value: v }));

    const tickFormatter = (val: string) => (val.length > 12 ? val.slice(0, 12) + '…' : val);

    return (
        <div style={{ width, height }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="label" tickFormatter={tickFormatter} interval={'preserveStartEnd'} />
                    <YAxis />
                    <Tooltip formatter={(v: any) => [Number(v).toFixed(2), 'Value']} labelFormatter={(l) => l} />
                    <Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.12} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

// Use Recharts Pie for win/loss
const PieChart: React.FC<{ wins: number; losses: number; size?: number }> = ({ wins, losses, size = 140 }) => {
    const total = wins + losses;
    if (total === 0) return <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 12 }}>—</div>;
    const data = [
        { name: 'Win', value: wins },
        { name: 'Loss', value: losses },
    ];
    const COLORS = ['#10b981', '#ef4444'];
    return (
        <div style={{ width: size, height: size }}>
            <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                    <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={size * 0.2} outerRadius={size * 0.45} paddingAngle={2} labelLine={false}>
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                </RePieChart>
            </ResponsiveContainer>
        </div>
    );
};

function computePnl(p: any, price: number) {
    const delta = price - p.entryPrice;
    const signed = p.side === 'long' ? delta : -delta;
    return signed * p.size;
}

// Format a raw size (units) to lots for display. Default: 1 lot = 100,000 units.
function formatLot(size: number, lotSize: number = 100000, decimals: number = 2) {
    if (!Number.isFinite(size)) return String(size);
    const lots = size / lotSize;
    // show reasonable precision and trim trailing zeros
    const s = lots.toFixed(decimals).replace(/\.0+$|(?<!\.)0+$/g, '');
    const abs = Math.abs(lots);
    const label = abs === 1 ? 'lot' : 'lots';
    return `${s} ${label}`;
}

export default TradingPanel;

