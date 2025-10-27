import { useMemo } from 'react';
import { useDrawingStore } from '../state/drawingStore';
import { ToolType } from '../types/drawings';
import { Timeframe } from '../types/series';
import { getTimeframeLabel } from '../utils/timeframe';
import { useCanvasStore } from '../state/canvasStore';

interface ToolSidebarProps {
  datasetLabel: string;
  timeframe: Timeframe;
  onResetSample: () => void;
  onOpenCanvasSettings: () => void;
}

const ToolSidebar = ({ datasetLabel, timeframe, onResetSample, onOpenCanvasSettings }: ToolSidebarProps) => {
  // Canvas settings
  const canvasSettings = useCanvasStore(state => state.settings);
  const setCanvasSettings = useCanvasStore.getState().setSettings;
  const {
    activeTool,
    selectionId,
    setActiveTool,
    deleteSelection,
    duplicateSelection,
    undo,
    redo,
    clearAll,
  } = useDrawingStore((state) => ({
    activeTool: state.activeTool,
    selectionId: state.selectionId,
    setActiveTool: state.setActiveTool,
    deleteSelection: state.deleteSelection,
    duplicateSelection: state.duplicateSelection,
    undo: state.undo,
    redo: state.redo,
    clearAll: state.clearAll,
  }));

  const tools = useMemo(
    () => [
      { id: 'select' as ToolType, label: 'Select', shortcut: 'V' },
      { id: 'rectangle' as ToolType, label: 'Rectangle', shortcut: 'R' },
      { id: 'trendline' as ToolType, label: 'Trendline', shortcut: 'T' },
      { id: 'long' as ToolType, label: 'Long Position', shortcut: 'L' },
      { id: 'short' as ToolType, label: 'Short Position', shortcut: 'S' },
    ],
    []
  );

  return (
    <aside className="tool-sidebar">
      <div className="toolbar-section">
        <h3>Dataset</h3>
        <p className="dataset-label" title={datasetLabel}>
          {datasetLabel}
        </p>
        <p className="timeframe-label">
          Timeframe: {getTimeframeLabel(timeframe)}
        </p>
        <button type="button" className="ghost" onClick={onResetSample}>
          Load sample data
        </button>
      </div>
      <div className="toolbar-section">
        <button type="button" onClick={onOpenCanvasSettings} style={{ width: '100%', padding: '0.7rem', borderRadius: 8, background: 'var(--color-button-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontWeight: 500, marginBottom: 8, cursor: 'pointer' }}>
          Canvas Settings
        </button>
      </div>

      <div className="toolbar-section">
        <h3>Tools</h3>
        <div className="tool-buttons">
          {tools.map((tool) => (
            <button
              key={tool.id}
              type="button"
              className={activeTool === tool.id ? 'active' : ''}
              onClick={() => setActiveTool(tool.id)}
            >
              <span>{tool.label}</span>
              <kbd>{tool.shortcut}</kbd>
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar-section">
        <h3>Editing</h3>
        <div className="action-buttons">
          <button type="button" onClick={undo}>
            Undo <kbd>Ctrl/Cmd+Z</kbd>
          </button>
          <button type="button" onClick={redo}>
            Redo <kbd>Ctrl/Cmd+Y</kbd>
          </button>
          <button type="button" onClick={duplicateSelection} disabled={!selectionId}>
            Duplicate <kbd>Ctrl/Cmd+D</kbd>
          </button>
          <button type="button" onClick={deleteSelection} disabled={!selectionId}>
            Delete <kbd>Del</kbd>
          </button>
          <button type="button" className="danger" onClick={clearAll}>
            Clear drawings
          </button>
        </div>
      </div>
    </aside>
  );
};

export default ToolSidebar;