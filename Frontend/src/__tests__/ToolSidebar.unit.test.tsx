import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ToolSidebar from '../components/ToolSidebar';

// Mock the drawing and canvas stores used by the component
vi.mock('../state/drawingStore', () => {
  const fn = () => ({
    activeTool: 'select',
    selectionId: null,
    setActiveTool: vi.fn(),
    deleteSelection: vi.fn(),
    duplicateSelection: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    clearAll: vi.fn(),
  });
  return { useDrawingStore: fn };
});

vi.mock('../state/canvasStore', () => {
  const useCanvasStore = (selector: any) => ({ settings: { background: '#fff' } });
  (useCanvasStore as any).getState = () => ({ setSettings: vi.fn() });
  return { useCanvasStore };
});

describe('ToolSidebar component', () => {
  test('renders dataset label and timeframe, toggles collapse', () => {
  render(<ToolSidebar datasetLabel="Sample" timeframe={'M1'} onResetSample={() => {}} onOpenCanvasSettings={() => {}} />);
    expect(screen.getByText('Sample')).toBeInTheDocument();
    expect(screen.getByText(/Timeframe:/)).toBeInTheDocument();
    // click collapse
    const collapse = screen.getByTitle('Collapse sidebar');
    fireEvent.click(collapse);
    // expanded view button should exist after collapse
    const expand = screen.getByTitle('Expand sidebar');
    expect(expand).toBeInTheDocument();
    fireEvent.click(expand);
  });
});
