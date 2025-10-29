import { useMemo, useState } from 'react';
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
      { id: 'volumeProfile' as ToolType, label: 'Volume Profile', shortcut: 'P' },
      { id: 'long' as ToolType, label: 'Long Position', shortcut: 'L' },
      { id: 'short' as ToolType, label: 'Short Position', shortcut: 'S' },
    ],
    []
  );

  // Small icons for tools (kept inline to avoid introducing extra files)
  const getToolIcon = (id: ToolType, size = 16) => {
    const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' } as any;
    switch (id) {
      case 'select':
        return (
          <svg {...common} aria-hidden>
            <path d="M3 3l18 9-11 3-2 7-5-19z" fill="currentColor" opacity="0.9" />
          </svg>
        );
      case 'rectangle':
        return (
          <svg {...common} aria-hidden>
            <rect x="3" y="4" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.4" fill="none" />
          </svg>
        );
      case 'trendline':
        return (
          <span
            className="material-symbols-outlined"
            style={{ fontSize: size, lineHeight: 1, display: 'inline-block' }}
            aria-hidden
          >
            diagonal_line
          </span>
        );
      case 'volumeProfile':
        return (
          <svg {...common} aria-hidden>
            <rect x="3" y="12" width="3" height="6" fill="currentColor" />
            <rect x="8" y="9" width="3" height="9" fill="currentColor" />
            <rect x="13" y="6" width="3" height="12" fill="currentColor" />
            <rect x="18" y="3" width="3" height="15" fill="currentColor" />
          </svg>
        );
      case 'long':
        return (
          <span
            className="material-symbols-outlined"
            style={{ fontSize: size, lineHeight: 1, display: 'inline-block' }}
            aria-hidden
          >
            trending_up
          </span>
        );
      case 'short':
        return (
          <span
            className="material-symbols-outlined"
            style={{ fontSize: size, lineHeight: 1, display: 'inline-block' }}
            aria-hidden
          >
            trending_down
          </span>
        );
      default:
        return (
          <svg {...common} aria-hidden>
            <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.2" fill="none" />
          </svg>
        );
    }
  };

  const [collapsed, setCollapsed] = useState(false);

  const sidebarStyle: React.CSSProperties | undefined = collapsed ? { width: 56, overflow: 'visible' } : undefined;

  return (
    <aside className="tool-sidebar" style={sidebarStyle} data-collapsed={collapsed}>
      {collapsed ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8, alignItems: 'center' }}>
          <button
            title="Expand sidebar"
            onClick={() => setCollapsed(false)}
            style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: 'var(--color-button-bg)', cursor: 'pointer' }}
          >
            ▶
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {tools.map((tool) => (
              <button
                key={tool.id}
                title={tool.label}
                type="button"
                className={activeTool === tool.id ? 'active' : ''}
                onClick={() => setActiveTool(tool.id)}
                style={{ width: 36, height: 36, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20 }}>{getToolIcon(tool.id, 16)}</span>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            <button title="Undo" onClick={undo} style={{ width: 36, height: 36, borderRadius: 6 }}>↺</button>
            <button title="Redo" onClick={redo} style={{ width: 36, height: 36, borderRadius: 6 }}>↻</button>
            <button title="Delete selection" onClick={deleteSelection} disabled={!selectionId} style={{ width: 36, height: 36, borderRadius: 6 }}>🗑</button>
            <button title="Clear drawings" onClick={clearAll} style={{ width: 36, height: 36, borderRadius: 6 }}>🧹</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setCollapsed(true)}
              title="Collapse sidebar"
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16, marginBottom: 8 }}
            >
              ◀
            </button>
          </div>
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
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <span style={{ display: 'inline-flex', width: 20 }}>{getToolIcon(tool.id, 18)}</span>
                  <span style={{ flex: 1, textAlign: 'left' }}>{tool.label}</span>
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
              <button type="button" onClick={deleteSelection} disabled={!selectionId}>
                Delete <kbd>Del</kbd>
              </button>
              <button type="button" className="danger" onClick={clearAll}>
                Clear drawings
              </button>
            </div>
          </div>
        </>
      )}
    </aside>
  );
};

export default ToolSidebar;