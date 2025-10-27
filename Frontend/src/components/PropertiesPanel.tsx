import { ChangeEvent } from 'react';
import { useDrawingStore } from '../state/drawingStore';
import { Drawing, RectangleDrawing, TrendlineDrawing } from '../types/drawings';

const clampLineWidth = (value: number): number => Math.min(Math.max(value, 1), 8);

const PropertiesPanel = () => {
  // Canvas settings
  const canvasSettings = require('../state/canvasStore').useCanvasStore(state => state.settings);
  const setCanvasSettings = require('../state/canvasStore').useCanvasStore.getState().setSettings;
  const drawings = useDrawingStore((state) => state.drawings);
  const selectionId = useDrawingStore((state) => state.selectionId);
  const updateRectangleStyle: (id: string, style: Partial<RectangleDrawing['style']> & { midline?: boolean }) => void = useDrawingStore((state) => state.updateRectangleStyle);
  const updateTrendlineStyle = useDrawingStore((state) => state.updateTrendlineStyle);
  const midlineEnabled = useDrawingStore((state) => state.midlineEnabled);
  const setMidlineEnabled = useDrawingStore((state) => state.setMidlineEnabled);

  const selectedDrawing: Drawing | undefined = drawings.find((drawing) => drawing.id === selectionId);

  if (!selectedDrawing) {
    return (
      <aside className="properties-panel">
        <h3>Properties</h3>
        <p>Select a drawing to edit its properties.</p>
        <hr />
        <h3>Canvas Settings</h3>
        <label>
          Background Color
          <input type="color" value={canvasSettings.background} onChange={e => setCanvasSettings({ background: e.target.value })} />
        </label>
        <label>
          Candle/Bar Border
          <input type="color" value={canvasSettings.candleBorder} onChange={e => setCanvasSettings({ candleBorder: e.target.value })} />
        </label>
        <label>
          Candle/Bar Fill
          <input type="color" value={canvasSettings.candleFill} onChange={e => setCanvasSettings({ candleFill: e.target.value })} />
        </label>
        <label>
          Wick Color
          <input type="color" value={canvasSettings.wick} onChange={e => setCanvasSettings({ wick: e.target.value })} />
        </label>
      </aside>
    );
  }

  if (selectedDrawing.type === 'rectangle') {
    const rectangle = selectedDrawing as RectangleDrawing;
    const handleColorChange = (event: ChangeEvent<HTMLInputElement>) => {
      updateRectangleStyle(rectangle.id, { strokeColor: event.target.value });
    };

    const handleFillChange = (event: ChangeEvent<HTMLInputElement>) => {
      updateRectangleStyle(rectangle.id, { fillColor: event.target.value });
    };

    const handleOpacityChange = (event: ChangeEvent<HTMLInputElement>) => {
      updateRectangleStyle(rectangle.id, { opacity: Number(event.target.value) / 100 });
    };

    const handleStrokeOpacityChange = (event: ChangeEvent<HTMLInputElement>) => {
      updateRectangleStyle(rectangle.id, { strokeOpacity: Number(event.target.value) / 100 });
    };

    const handleMidlineChange = (event: ChangeEvent<HTMLInputElement>) => {
      updateRectangleStyle(rectangle.id, { midline: event.target.checked });
      setMidlineEnabled(event.target.checked);
    };

    return (
      <aside className="properties-panel">
        <h3>Rectangle</h3>
        <label>
          Stroke color
          <input type="color" value={rectangle.style.strokeColor} onChange={handleColorChange} />
        </label>
        <label>
          Fill color
          <input type="color" value={rectangle.style.fillColor ?? '#2962ff'} onChange={handleFillChange} />
        </label>
        <label>
          Opacity
          <input
            type="range"
            min={5}
            max={90}
            step={5}
            value={Math.round((rectangle.style.opacity ?? 0.25) * 100)}
            onChange={handleOpacityChange}
          />
        </label>
        <label>
          Stroke opacity
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={Math.round((rectangle.style.strokeOpacity ?? 1) * 100)}
            onChange={handleStrokeOpacityChange}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={midlineEnabled}
            onChange={handleMidlineChange}
          />
          Show midline
        </label>
      </aside>
    );
  }

  const trendline = selectedDrawing as TrendlineDrawing;
  const handleStrokeChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateTrendlineStyle(trendline.id, { strokeColor: event.target.value });
  };

  const handleWidthChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateTrendlineStyle(trendline.id, { lineWidth: clampLineWidth(Number(event.target.value)) });
  };

  return (
    <aside className="properties-panel">
      <h3>Trendline</h3>
      <label>
        Stroke color
        <input type="color" value={trendline.style.strokeColor} onChange={handleStrokeChange} />
      </label>
      <label>
        Width
        <input
          type="range"
          min={1}
          max={8}
          value={trendline.style.lineWidth}
          onChange={handleWidthChange}
        />
      </label>
    </aside>
  );
};

export default PropertiesPanel;