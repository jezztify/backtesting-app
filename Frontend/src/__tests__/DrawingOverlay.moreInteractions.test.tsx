import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DrawingOverlay from '../components/DrawingOverlay';

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

// converters: time -> x = time*10, price -> y = price*2
const converters = {
  toCanvas: ({ time, price }: any) => ({ x: (time ?? 0) * 10, y: (price ?? 0) * 2 }),
  toChart: ({ x, y }: any) => ({ time: x / 10, price: y / 2 }),
};

beforeEach(() => {
  vi.clearAllMocks();
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

test('moving a rectangle drawing calls updateDrawingPoints on pointer move', () => {
  // Add a rectangle drawing that maps to a visible rect
  storeState.drawings = [
    {
      id: 'r1',
      type: 'rectangle',
      start: { time: 0, price: 200 },
      end: { time: 10, price: 190 },
      style: { strokeColor: '#000', lineWidth: 1 },
    },
  ];

  const { container } = render(
    <DrawingOverlay width={800} height={600} converters={converters as any} renderTick={1} pricePrecision={2} />
  );

  const svg = container.querySelector('svg') as SVGSVGElement;
  Object.defineProperty(svg, 'getBoundingClientRect', { value: () => ({ left: 0, top: 0, width: 800, height: 600 }) });

  // Click inside the rectangle to start moving
  fireEvent.pointerDown(svg, { clientX: 50, clientY: 390, button: 0, pointerId: 11 });

  // Move pointer to new position
  fireEvent.pointerMove(svg, { clientX: 60, clientY: 400, pointerId: 11 });

  // updateDrawingPoints should have been called at least once
  expect(updateDrawingPoints).toHaveBeenCalled();

  // Release pointer
  fireEvent.pointerUp(svg, { clientX: 60, clientY: 400, pointerId: 11 });
});

test('resizing via handle updates drawing points', () => {
  // Rectangle where start 2->x20 price20->y40, end 4->x40 price10->y20
  storeState.drawings = [
    {
      id: 'r2',
      type: 'rectangle',
      start: { time: 2, price: 20 },
      end: { time: 4, price: 10 },
      style: { strokeColor: '#000', lineWidth: 1 },
    },
  ];

  const { container } = render(
    <DrawingOverlay width={800} height={600} converters={converters as any} renderTick={1} pricePrecision={2} />
  );

  const svg = container.querySelector('svg') as SVGSVGElement;
  Object.defineProperty(svg, 'getBoundingClientRect', { value: () => ({ left: 0, top: 0, width: 800, height: 600 }) });

  // Click near top-left handle (x ~20, y~40)
  fireEvent.pointerDown(svg, { clientX: 22, clientY: 39, button: 0, pointerId: 21 });

  // Drag to resize
  fireEvent.pointerMove(svg, { clientX: 10, clientY: 60, pointerId: 21 });

  // Expect updateDrawingPoints called to update normalized points
  expect(updateDrawingPoints).toHaveBeenCalled();

  fireEvent.pointerUp(svg, { clientX: 10, clientY: 60, pointerId: 21 });
});
