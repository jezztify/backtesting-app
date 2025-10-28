import React, { useEffect, useState } from 'react';
import { PositionDrawing } from '../types/drawings';

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
    const [riskPercent, setRiskPercent] = useState<number>(initialRiskPercent ?? 0);
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

    // If risk % is specified, compute a suggested size from equity and unit risk.
    let suggestedSizeFromRisk = size;
    if (unitRisk > 0 && riskPercent > 0) {
        suggestedSizeFromRisk = Math.max(0, (equity * (riskPercent / 100)) / unitRisk);
    }

    // `size` is always a number (initialized from props/state). Use it directly as the computed size.
    const computedSize = size;
    const dollarRisk = unitRisk > 0 ? unitRisk * computedSize : 0;
    const dollarReward = tp !== undefined ? Math.abs(tp - entry) * computedSize : 0;

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
                            const computed = Math.max(0, (equity * (val / 100)) / unitRisk);
                            setSize(computed);
                        }
                    }}
                    style={{ width: '100%', padding: 8, boxSizing: 'border-box', marginTop: 6 }}
                />
            </div>

            <div style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)' }}>Size</label>
                <input
                    type="number"
                    min={0}
                    step={0.0001}
                    value={computedSize}
                    onChange={(e) => {
                        const val = Number(e.target.value);
                        setSize(isNaN(val) ? 0 : val);
                    }}
                    style={{ width: '100%', padding: 8, boxSizing: 'border-box', marginTop: 6 }}
                />
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
                <button onClick={() => onPlace(computedSize, riskPercent)} style={{ padding: '8px 12px', background: 'var(--color-accent)', color: 'var(--color-text-inverse)', border: 'none', borderRadius: 6 }}>Place</button>
            </div>
        </div>
    );
};

export default PlaceLimitOrderModal;
