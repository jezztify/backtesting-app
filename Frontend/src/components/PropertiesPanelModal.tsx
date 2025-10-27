
import { ChangeEvent, useState, useEffect, useRef } from 'react';
import { useDrawingStore, defaultRectangleStyle, defaultTrendlineStyle, defaultLongStyle, defaultShortStyle } from '../state/drawingStore';
import { Drawing, RectangleDrawing, TrendlineDrawing, PositionDrawing } from '../types/drawings';

interface PropertiesPanelModalProps {
    drawingId: string;
    onClose: () => void;
    onDragStart: (offsetX: number, offsetY: number) => void;
}

const clampLineWidth = (value: number): number => Math.min(Math.max(value, 1), 8);

const PropertiesPanelModal = ({ drawingId, onClose, onDragStart }: PropertiesPanelModalProps) => {
    // Place drawings and selectedDrawing at the very top so hooks can use them
    const drawings = useDrawingStore((state) => state.drawings);
    const selectedDrawing: Drawing | undefined = drawings.find((drawing) => drawing.id === drawingId);

    // --- Position tool hooks: always declare, only use if needed ---
    const [entryValue, setEntryValue] = useState('');
    const [tpValue, setTpValue] = useState('');
    const [slValue, setSlValue] = useState('');
    useEffect(() => {
        if (selectedDrawing && (selectedDrawing.type === 'long' || selectedDrawing.type === 'short')) {
            setEntryValue((selectedDrawing as PositionDrawing).point.price.toFixed(5));
        }
    }, [selectedDrawing && (selectedDrawing.type === 'long' || selectedDrawing.type === 'short') ? (selectedDrawing as PositionDrawing).point.price : null]);
    useEffect(() => {
        if (selectedDrawing && (selectedDrawing.type === 'long' || selectedDrawing.type === 'short')) {
            setTpValue((selectedDrawing as PositionDrawing).takeProfit?.toFixed(5) || '');
        }
    }, [selectedDrawing && (selectedDrawing.type === 'long' || selectedDrawing.type === 'short') ? (selectedDrawing as PositionDrawing).takeProfit : null]);
    useEffect(() => {
        if (selectedDrawing && (selectedDrawing.type === 'long' || selectedDrawing.type === 'short')) {
            setSlValue((selectedDrawing as PositionDrawing).stopLoss?.toFixed(5) || '');
        }
    }, [selectedDrawing && (selectedDrawing.type === 'long' || selectedDrawing.type === 'short') ? (selectedDrawing as PositionDrawing).stopLoss : null]);

    // Other store hooks
    const updateRectangleStyle: (id: string, style: Partial<RectangleDrawing['style']> & { midline?: boolean }) => void = useDrawingStore((state) => state.updateRectangleStyle);
    const updateTrendlineStyle = useDrawingStore((state) => state.updateTrendlineStyle);
    const updatePositionStyle = useDrawingStore((state) => state.updatePositionStyle);
    const midlineEnabled = useDrawingStore((state) => state.midlineEnabled);
    const setMidlineEnabled = useDrawingStore((state) => state.setMidlineEnabled);

    // Draggable logic
    const headerRef = useRef<HTMLDivElement>(null);

    const handleHeaderMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!headerRef.current) return;
        const rect = headerRef.current.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;
        onDragStart(offsetX, offsetY);
        e.preventDefault();
    };

    const containerStyle: React.CSSProperties = {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '13px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
    };

    const headerStyle: React.CSSProperties = {
        margin: 0,
        padding: '12px 16px',
        fontSize: '14px',
        fontWeight: 600,
        borderBottom: '1px solid var(--color-border)',
        cursor: 'grab',
        background: 'var(--color-button-bg)',
        borderRadius: '6px 6px 0 0',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
    };

    const closeButtonStyle: React.CSSProperties = {
        background: 'transparent',
        border: 'none',
        fontSize: '20px',
        fontWeight: 'bold',
        color: 'var(--color-text-muted)',
        cursor: 'pointer',
        padding: '0',
        width: '24px',
        height: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '4px',
        transition: 'background 0.2s, color 0.2s'
    };

    const bodyStyle: React.CSSProperties = {
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        overflowY: 'auto',
        flex: 1
    };

    const labelStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        fontSize: '12px',
        fontWeight: 500,
        color: 'var(--color-text-muted)'
    };

    const inputStyle: React.CSSProperties = {
        padding: '6px 8px',
        border: '1px solid var(--color-border)',
        borderRadius: '4px',
        fontSize: '13px',
        width: '100%',
        boxSizing: 'border-box',
        background: 'var(--color-panel)',
        color: 'var(--color-text)'
    };

    const rangeContainerStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    };

    const rangeStyle: React.CSSProperties = {
        flex: 1,
        height: '4px',
        borderRadius: '2px',
        appearance: 'none',
        background: 'var(--color-button-bg)',
        outline: 'none'
    };

    const valueDisplayStyle: React.CSSProperties = {
        minWidth: '35px',
        textAlign: 'right',
        fontSize: '12px',
        color: 'var(--color-text-muted)',
        fontWeight: 500
    };

    const checkboxLabelStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '13px',
        cursor: 'pointer',
        padding: '8px',
        borderRadius: '4px',
        background: 'var(--color-button-bg)',
        color: 'var(--color-text)'
    };

    const checkboxStyle: React.CSSProperties = {
        width: '16px',
        height: '16px',
        cursor: 'pointer'
    };

    const buttonStyle: React.CSSProperties = {
        marginTop: '8px',
        padding: '8px 16px',
        background: 'var(--color-accent)',
        color: 'var(--color-text-inverse)',
        border: 'none',
        borderRadius: '4px',
        fontSize: '13px',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'background 0.2s'
    };

    if (!selectedDrawing) {
        return (
            <div style={containerStyle}>
                <div ref={headerRef} style={headerStyle} onMouseDown={handleHeaderMouseDown}>
                    <span>Properties</span>
                    <button
                        style={closeButtonStyle}
                        onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--color-button-hover)';
                            e.currentTarget.style.color = 'var(--color-text)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--color-text-muted)';
                        }}
                    >
                        ×
                    </button>
                </div>
                <div style={bodyStyle}>
                    <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>Drawing not found.</p>
                </div>
            </div>
        );
    }

    if (selectedDrawing.type === 'rectangle') {
        const rectangle = selectedDrawing as RectangleDrawing;
        const currentOpacity = Math.round((rectangle.style.opacity ?? 0.25) * 100);
        const currentStrokeOpacity = Math.round((rectangle.style.strokeOpacity ?? 1) * 100);

        const handleColorChange = (event: ChangeEvent<HTMLInputElement>) => {
            updateRectangleStyle(rectangle.id, { strokeColor: event.target.value });
        };

        const handleFillChange = (event: ChangeEvent<HTMLInputElement>) => {
            updateRectangleStyle(rectangle.id, { fillColor: event.target.value });
        };

        const handleOpacityChange = (event: ChangeEvent<HTMLInputElement>) => {
            const newOpacity = Number(event.target.value) / 100;
            updateRectangleStyle(rectangle.id, { opacity: newOpacity });
        };

        const handleStrokeOpacityChange = (event: ChangeEvent<HTMLInputElement>) => {
            const newOpacity = Number(event.target.value) / 100;
            updateRectangleStyle(rectangle.id, { strokeOpacity: newOpacity });
        };

        const handleMidlineChange = (event: ChangeEvent<HTMLInputElement>) => {
            const checked = event.target.checked;
            updateRectangleStyle(rectangle.id, { midline: checked });
            setMidlineEnabled(checked);
        };

        const handleResetRectangleStyle = () => {
            if (window.confirm('Reset rectangle style to default values?')) {
                updateRectangleStyle(rectangle.id, { ...defaultRectangleStyle });
            }
        };
        return (
            <div style={containerStyle}>
                <div ref={headerRef} style={headerStyle} onMouseDown={handleHeaderMouseDown}>
                    <span>Rectangle Properties</span>
                    <button
                        style={closeButtonStyle}
                        onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--color-button-hover)';
                            e.currentTarget.style.color = 'var(--color-text)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--color-text-muted)';
                        }}
                    >
                        ×
                    </button>
                </div>
                <div style={bodyStyle}>
                    <label style={labelStyle}>
                        <span>Stroke Color</span>
                        <input
                            type="color"
                            value={rectangle.style.strokeColor}
                            onChange={handleColorChange}
                            style={{ ...inputStyle, padding: '4px', height: '36px', cursor: 'pointer' }}
                        />
                    </label>
                    <label style={labelStyle}>
                        <span>Fill Color</span>
                        <input
                            type="color"
                            value={rectangle.style.fillColor ?? '#2962ff'}
                            onChange={handleFillChange}
                            style={{ ...inputStyle, padding: '4px', height: '36px', cursor: 'pointer' }}
                        />
                    </label>
                    <label style={labelStyle}>
                        <span>Opacity</span>
                        <div style={rangeContainerStyle}>
                            <input
                                type="range"
                                min={5}
                                max={95}
                                step={5}
                                value={currentOpacity}
                                onChange={handleOpacityChange}
                                style={rangeStyle}
                            />
                            <span style={valueDisplayStyle}>{currentOpacity}%</span>
                        </div>
                    </label>
                    <label style={labelStyle}>
                        <span>Stroke Opacity</span>
                        <div style={rangeContainerStyle}>
                            <input
                                type="range"
                                min={10}
                                max={100}
                                step={5}
                                value={currentStrokeOpacity}
                                onChange={handleStrokeOpacityChange}
                                style={rangeStyle}
                            />
                            <span style={valueDisplayStyle}>{currentStrokeOpacity}%</span>
                        </div>
                    </label>
                    <label style={checkboxLabelStyle}>
                        <input
                            type="checkbox"
                            checked={midlineEnabled}
                            onChange={handleMidlineChange}
                            style={checkboxStyle}
                        />
                        <span>Show midline</span>
                    </label>
                    <button
                        style={{ marginTop: 12, background: 'var(--color-button-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '0.5rem', fontWeight: 500, cursor: 'pointer' }}
                        onClick={handleResetRectangleStyle}
                    >
                        Reset Style
                    </button>
                </div>
            </div>
        );
    }

    if (selectedDrawing.type === 'long' || selectedDrawing.type === 'short') {
        const position = selectedDrawing as PositionDrawing;
        const isLong = position.type === 'long';
        const tpFillColor = position.style.takeProfitFillColor ?? '#4caf50';
        const slFillColor = position.style.stopLossFillColor ?? '#f44336';
        const tpOpacityValue = Math.round((position.style.takeProfitFillOpacity ?? 0.15) * 100);
        const slOpacityValue = Math.round((position.style.stopLossFillOpacity ?? 0.15) * 100);

        const handleTakeProfitFillColorChange = (event: ChangeEvent<HTMLInputElement>) => {
            updatePositionStyle(position.id, { takeProfitFillColor: event.target.value });
        };
        const handleStopLossFillColorChange = (event: ChangeEvent<HTMLInputElement>) => {
            updatePositionStyle(position.id, { stopLossFillColor: event.target.value });
        };
        const handleTakeProfitOpacityChange = (event: ChangeEvent<HTMLInputElement>) => {
            const newOpacity = Number(event.target.value) / 100;
            updatePositionStyle(position.id, { takeProfitFillOpacity: newOpacity });
        };
        const handleResetPositionStyle = () => {
            if (window.confirm('Reset position style to default values?')) {
                const defaults = isLong ? defaultLongStyle : defaultShortStyle;
                updatePositionStyle(position.id, { ...defaults });
            }
        };
        const handleStopLossOpacityChange = (event: ChangeEvent<HTMLInputElement>) => {
            const newOpacity = Number(event.target.value) / 100;
            updatePositionStyle(position.id, { stopLossFillOpacity: newOpacity });
        };
        const handleEntryChange = (event: ChangeEvent<HTMLInputElement>) => {
            const value = event.target.value;
            setEntryValue(value);
        };
        const handleEntryBlur = (event: React.FocusEvent<HTMLInputElement>) => {
            const value = event.target.value.trim();
            if (value === '' || isNaN(parseFloat(value))) {
                // Long: Entry = SL + 5 pips
                // Short: Entry = SL - 5 pips
                const currentSL = position.stopLoss || position.point.price;
                const defaultEntry = isLong ? currentSL + 0.0005 : currentSL - 0.0005;
                updatePositionStyle(position.id, { entry: defaultEntry });
                setEntryValue(defaultEntry.toFixed(5));
            } else {
                const newEntry = parseFloat(value);
                updatePositionStyle(position.id, { entry: newEntry });
            }
        };
        const handleTakeProfitChange = (event: ChangeEvent<HTMLInputElement>) => {
            const value = event.target.value;
            setTpValue(value);
        };
        const handleTakeProfitBlur = (event: React.FocusEvent<HTMLInputElement>) => {
            const value = event.target.value.trim();
            if (value === '' || isNaN(parseFloat(value))) {
                // Long: TP = Entry + 5 pips
                // Short: TP = Entry - 5 pips
                const currentEntry = position.point.price;
                const defaultTP = isLong ? currentEntry + 0.0005 : currentEntry - 0.0005;
                updatePositionStyle(position.id, { takeProfit: defaultTP });
                setTpValue(defaultTP.toFixed(5));
            } else {
                const newTP = parseFloat(value);
                updatePositionStyle(position.id, { takeProfit: newTP });
            }
        };
        const handleStopLossChange = (event: ChangeEvent<HTMLInputElement>) => {
            const value = event.target.value;
            setSlValue(value);
        };
        const handleStopLossBlur = (event: React.FocusEvent<HTMLInputElement>) => {
            const value = event.target.value.trim();
            if (value === '' || isNaN(parseFloat(value))) {
                // Long: SL = Entry - 5 pips
                // Short: SL = Entry + 5 pips
                const currentEntry = position.point.price;
                const defaultSL = isLong ? currentEntry - 0.0005 : currentEntry + 0.0005;
                updatePositionStyle(position.id, { stopLoss: defaultSL });
                setSlValue(defaultSL.toFixed(5));
            } else {
                const newSL = parseFloat(value);
                updatePositionStyle(position.id, { stopLoss: newSL });
            }
        };
        const riskReward = position.takeProfit && position.stopLoss && position.point.price
            ? Math.abs(position.takeProfit - position.point.price) / Math.abs(position.point.price - position.stopLoss)
            : 0;
        return (
            <div style={containerStyle}>
                <div ref={headerRef} style={headerStyle} onMouseDown={handleHeaderMouseDown}>
                    <span>{isLong ? 'Long Position Properties' : 'Short Position Properties'}</span>
                    <button
                        style={closeButtonStyle}
                        onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--color-button-hover)';
                            e.currentTarget.style.color = 'var(--color-text)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--color-text-muted)';
                        }}
                    >
                        ×
                    </button>
                </div>
                <div style={bodyStyle}>
                    <label style={labelStyle}>
                        <span>Entry</span>
                        <input
                            type="text"
                            step="0.00001"
                            value={entryValue}
                            onChange={handleEntryChange}
                            onBlur={handleEntryBlur}
                            style={inputStyle}
                        />
                    </label>
                    <label style={labelStyle}>
                        <span>Take Profit</span>
                        <input
                            type="text"
                            step="0.00001"
                            value={tpValue}
                            onChange={handleTakeProfitChange}
                            onBlur={handleTakeProfitBlur}
                            style={inputStyle}
                        />
                    </label>
                    <label style={labelStyle}>
                        <span>Stop Loss</span>
                        <input
                            type="text"
                            step="0.00001"
                            value={slValue}
                            onChange={handleStopLossChange}
                            onBlur={handleStopLossBlur}
                            style={inputStyle}
                        />
                    </label>
                    {riskReward > 0 && (
                        <div style={{ ...labelStyle, marginTop: '8px' }}>
                            <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                                Risk/Reward Ratio: <strong>{riskReward.toFixed(2)}:1</strong>
                            </span>
                        </div>
                    )}
                    <button
                        style={{ marginTop: 12, background: 'var(--color-button-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '0.5rem', fontWeight: 500, cursor: 'pointer' }}
                        onClick={handleResetPositionStyle}
                    >
                        Reset Style
                    </button>
                </div>
            </div>
        );
    }

    if (selectedDrawing.type === 'trendline') {
        const trendline = selectedDrawing as TrendlineDrawing;
        const handleStrokeChange = (event: ChangeEvent<HTMLInputElement>) => {
            updateTrendlineStyle(trendline.id, { strokeColor: event.target.value });
        };
        const handleWidthChange = (event: ChangeEvent<HTMLInputElement>) => {
            updateTrendlineStyle(trendline.id, { lineWidth: clampLineWidth(Number(event.target.value)) });
        };
        const handleResetTrendlineStyle = () => {
            if (window.confirm('Reset trendline style to default values?')) {
                updateTrendlineStyle(trendline.id, { ...defaultTrendlineStyle });
            }
        };
        return (
            <div style={containerStyle}>
                <div ref={headerRef} style={headerStyle} onMouseDown={handleHeaderMouseDown}>
                    <span>Trendline Properties</span>
                    <button
                        style={closeButtonStyle}
                        onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--color-button-hover)';
                            e.currentTarget.style.color = 'var(--color-text)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--color-text-muted)';
                        }}
                    >
                        ×
                    </button>
                </div>
                <div style={bodyStyle}>
                    <label style={labelStyle}>
                        <span>Stroke Color</span>
                        <input
                            type="color"
                            value={trendline.style.strokeColor}
                            onChange={handleStrokeChange}
                            style={{ ...inputStyle, padding: '4px', height: '36px', cursor: 'pointer' }}
                        />
                    </label>
                    <label style={labelStyle}>
                        <span>Line Width</span>
                        <div style={rangeContainerStyle}>
                            <input
                                type="range"
                                min={1}
                                max={8}
                                value={trendline.style.lineWidth}
                                onChange={handleWidthChange}
                                style={rangeStyle}
                            />
                            <span style={valueDisplayStyle}>{trendline.style.lineWidth}px</span>
                        </div>
                    </label>
                    <button
                        style={{ marginTop: 12, background: 'var(--color-button-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '0.5rem', fontWeight: 500, cursor: 'pointer' }}
                        onClick={handleResetTrendlineStyle}
                    >
                        Reset Style
                    </button>
                </div>
            </div>
        );
    }
};

export default PropertiesPanelModal;