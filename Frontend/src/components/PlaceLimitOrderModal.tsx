import React, { useEffect, useState } from 'react';
import { PositionDrawing } from '../types/drawings';
import { useTradingStore } from '../state/tradingStore';

interface Props {
    drawing?: PositionDrawing | null;
    equity: number;
    pricePrecision: number;
    initialSize?: number;
    initialRiskPercent?: number;
    onPlace: (size: number, riskPercent?: number) => void;
    onCancel: () => void;
    onClose: () => void;
}

const PlaceLimitOrderModal: React.FC<Props> = ({ drawing, equity, pricePrecision, initialSize = 1, initialRiskPercent = 0.5, onPlace, onCancel, onClose }) => {
    // Present sizes in lots in the UI. Internal store expects units.
    const lotSize = useTradingStore((s) => s.lotSize || 100000);
    const [riskPercent, setRiskPercent] = useState<number>(initialRiskPercent ?? 0);
    // `size` in this modal is in lots (not raw units). initialSize passed from callers is assumed to be in lots.
    const [size, setSize] = useState<number>(initialSize ?? 1);

    useEffect(() => {
        setRiskPercent(initialRiskPercent ?? 0);
        setSize(initialSize ?? 1);
    }, [initialSize, initialRiskPercent, drawing?.id]);

    if (!drawing) {
        return <div style={{ color: 'var(--color-text-muted)' }}>Drawing not found or not a position.</div>;
    }

    const entry = drawing.point.price;
    const sl = drawing.stopLoss;
    const tp = drawing.takeProfit;
    const unitRisk = sl !== undefined ? Math.abs(entry - sl) : 0;

    // If risk % is specified, compute a suggested size (in units) from equity and unit risk,
    // then convert to lots for display.
    let suggestedSizeFromRiskLots = size;
    if (unitRisk > 0 && riskPercent > 0) {
        const suggestedUnits = Math.max(0, (equity * (riskPercent / 100)) / unitRisk);
        // account for leverage when suggesting lots: units = lots * lotSize * leverage => lots = units / (lotSize * leverage)
        const leverage = useTradingStore.getState().leverage || 1;
        suggestedSizeFromRiskLots = suggestedUnits / (lotSize * leverage);
    }

    const leverage = useTradingStore((s) => s.leverage || 1);

    // `size` is in lots in this modal. Convert to units for dollar risk/reward calculations.
    // Units are affected by leverage: effective units = lots * lotSize * leverage
    // `size` is in lots in this modal. Convert to units for calculations that expect
    // base units (the store stores sizes in units). Units = lots * lotSize.
    const computedSizeLots = size;
    const computedSizeUnits = computedSizeLots * lotSize;

    const rrr = unitRisk > 0 && tp !== undefined ? (Math.abs(tp - entry) / unitRisk).toFixed(2) : 'n/a';
    // Dollar risk is price move per unit * number of units
    const dollarRisk = unitRisk > 0 ? unitRisk * computedSizeUnits : 0;
    const dollarReward = tp !== undefined ? dollarRisk * (rrr !== 'n/a' ? Number(rrr) : 0) : 0;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong style={{ fontSize: 14 }}>Place Limit Order</strong>
                <button onClick={() => onClose()} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    <div>Entry</div>
                    <div style={{ fontWeight: 700 }}>{entry.toFixed(pricePrecision)}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    <div>Stop Loss</div>
                    <div style={{ fontWeight: 700 }}>{sl !== undefined ? sl.toFixed(pricePrecision) : 'n/a'}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    <div>Take Profit</div>
                    <div style={{ fontWeight: 700 }}>{tp !== undefined ? tp.toFixed(pricePrecision) : 'n/a'}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    <div>Equity</div>
                    <div style={{ fontWeight: 700 }}>${equity.toFixed(2)}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    <div>Reward/Risk Ratio</div>
                    <div style={{ fontWeight: 700 }}>{rrr}</div>
                </div>
            </div>

            <div style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)' }}>Risk % of Equity</label>
                <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={riskPercent}
                    onChange={(e) => {
                        const val = Number(e.target.value);
                        setRiskPercent(isNaN(val) ? 0 : val);
                        if (unitRisk > 0 && !isNaN(val) && val > 0) {
                            const computedUnits = Math.max(0, (equity * (val / 100)) / unitRisk);
                            // set size in lots
                            setSize(computedUnits / lotSize);
                        }
                    }}
                    style={{ width: '100%', padding: 8, boxSizing: 'border-box', marginTop: 6 }}
                />
            </div>

            <div style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)' }}>Size (lots)</label>
                <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={computedSizeLots}
                    onChange={(e) => {
                        const val = Number(e.target.value);
                        setSize(isNaN(val) ? 0 : val);
                    }}
                    style={{ width: '100%', padding: 8, boxSizing: 'border-box', marginTop: 6 }}
                />
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 6 }}>Units: {computedSizeUnits.toLocaleString()}</div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    <div>Risk ($)</div>
                    <div style={{ fontWeight: 700 }}>${dollarRisk.toFixed(2)}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    <div>Reward ($)</div>
                    <div style={{ fontWeight: 700 }}>${dollarReward.toFixed(2)}</div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={onCancel} style={{ padding: '8px 12px', background: 'var(--color-button-bg)', border: '1px solid var(--color-border)', borderRadius: 6 }}>Cancel</button>
                {/* Convert lots to units when calling onPlace so store receives expected units */}
                <button onClick={() => onPlace(Math.max(0, computedSizeUnits), riskPercent)} style={{ padding: '8px 12px', background: 'var(--color-accent)', color: 'var(--color-text-inverse)', border: 'none', borderRadius: 6 }}>Place</button>
            </div>
        </div>
    );
};

export default PlaceLimitOrderModal;
