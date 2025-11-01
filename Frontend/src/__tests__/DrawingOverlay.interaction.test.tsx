import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DrawingOverlay from '../components/DrawingOverlay';

// We'll create a mutable store state that the mocked hook returns so tests can
// change behavior between cases.
const beginDraft = vi.fn();
const updateDraft = vi.fn();
const commitDraft = vi.fn();
const cancelDraft = vi.fn();
const selectDrawing = vi.fn();
const createHistoryCheckpoint = vi.fn();
const updateDrawingPoints = vi.fn();
const updatePositionStyle = vi.fn();

let storeState: any = {
  activeTool: 'select',
  drawings: [],
  draft: null,
  selectionId: null,
  beginDraft,
  updateDraft,
  commitDraft,
  cancelDraft,
  selectDrawing,
  createHistoryCheckpoint,
  updateDrawingPoints,
  updatePositionStyle,
};

vi.mock('../state/drawingStore', () => ({
  useDrawingStore: () => storeState,
}));

vi.mock('../state/tradingStore', () => ({
  useTradingStore: () => ({ placeLimitOrder: vi.fn(), cancelOrder: vi.fn(), positions: [], equity: 100 }),
}));

// Mock the PropertiesPanelModal and PlaceLimitOrderModal to avoid heavy UI
vi.mock('../components/PropertiesPanelModal', () => ({ __esModule: true, default: () => <div data-testid="properties-modal">props</div> }));
vi.mock('../components/PlaceLimitOrderModal', () => ({ __esModule: true, default: () => <div data-testid="trade-modal">trade</div> }));

// Simple converters: time -> x = time*10, price -> y = price*2
const converters = {
  toCanvas: ({ time, price }: any) => ({ x: (time ?? 0) * 10, y: (price ?? 0) * 2 }),
  toChart: ({ x, y }: any) => ({ time: x / 10, price: y / 2 }),
};

beforeEach(() => {
  vi.clearAllMocks();
  // reset store state
  storeState = {
    activeTool: 'select',
    drawings: [],
    draft: null,
    selectionId: null,
    beginDraft,
    updateDraft,
    commitDraft,
    cancelDraft,
    selectDrawing,
    createHistoryCheckpoint,
    updateDrawingPoints,
    updatePositionStyle,
  };
});

test('begin drawing when activeTool is rectangle on left pointer down', () => {
  storeState.activeTool = 'rectangle';

  const { container } = render(
    <DrawingOverlay width={400} height={300} converters={converters as any} renderTick={1} pricePrecision={2} />
  );

  const svg = container.querySelector('svg') as SVGSVGElement;
  // ensure getBoundingClientRect returns a predictable origin
  Object.defineProperty(svg, 'getBoundingClientRect', { value: () => ({ left: 0, top: 0, width: 400, height: 300 }) });

  // simulate a left-click at canvas coords x=50,y=100
  fireEvent.pointerDown(svg, { clientX: 50, clientY: 100, button: 0, pointerId: 1 });

  // beginDraft should be called with the active tool and a chart point roughly {time:5,price:50}
  expect(beginDraft).toHaveBeenCalled();
  const args = beginDraft.mock.calls[0];
  expect(args[0]).toBe('rectangle');
  expect(args[1]).toHaveProperty('time');
  expect(args[1]).toHaveProperty('price');
});

test('right click over drawing shows context menu (foreignObject rendered)', () => {
  // Add a rectangle drawing that will be inside canvas when converted
  storeState.drawings = [
    {
      id: 'rect1',
      type: 'rectangle',
      start: { time: 1, price: 10 },
      end: { time: 3, price: 5 },
      style: { strokeColor: '#000', lineWidth: 1 },
    },
  ];

  const { container } = render(
    <DrawingOverlay width={400} height={300} converters={converters as any} renderTick={1} pricePrecision={2} />
  );

  const svg = container.querySelector('svg') as SVGSVGElement;
  Object.defineProperty(svg, 'getBoundingClientRect', { value: () => ({ left: 0, top: 0, width: 400, height: 300 }) });

  // Choose a point that lies within the rectangle canvas bounds
  // Rectangle start canvas: time1->x10, price10->y20 ; end: time3->x30, price5->y10
  // pick x=15,y=15
  fireEvent.pointerDown(svg, { clientX: 15, clientY: 15, button: 2, pointerId: 2 });

  // Expect a foreignObject to be rendered for context menu
  const fo = container.querySelector('foreignObject');
  expect(fo).toBeTruthy();
});

test('selects drawing when clicking a handle in select mode', () => {
  storeState.activeTool = 'select';
  // rectangle that will produce a handle near left-top
  storeState.drawings = [
    {
      id: 'rect2',
      type: 'rectangle',
      start: { time: 2, price: 20 },
      end: { time: 4, price: 10 },
      style: { strokeColor: '#000', lineWidth: 1 },
    },
  ];

  const { container } = render(
    <DrawingOverlay width={400} height={300} converters={converters as any} renderTick={1} pricePrecision={2} />
  );

  const svg = container.querySelector('svg') as SVGSVGElement;
  Object.defineProperty(svg, 'getBoundingClientRect', { value: () => ({ left: 0, top: 0, width: 400, height: 300 }) });

  // Compute where the top-left handle would be: start.time=2 -> x=20, start.price=20 -> y=40
  // Click near that handle
  fireEvent.pointerDown(svg, { clientX: 22, clientY: 39, button: 0, pointerId: 3 });

  // selectDrawing should have been called with drawing id
  expect(selectDrawing).toHaveBeenCalled();
});
