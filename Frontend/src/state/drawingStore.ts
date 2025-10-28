import { create } from 'zustand';
import {
  ChartPoint,
  DraftDrawing,
  Drawing,
  RectangleDrawing,
  ToolType,
  TrendlineDrawing,
  PositionDrawing,
} from '../types/drawings';
import { cloneDrawingList } from '../utils/geometry';
import { saveWorkspaceState, loadWorkspaceState } from '../services/persistence';

export const defaultRectangleStyle = {
  strokeColor: '#2962ff',
  strokeOpacity: 1,
  fillColor: '#2962ff',
  opacity: 0.25,
  lineWidth: 1.5,
};

export const defaultTrendlineStyle = {
  strokeColor: '#26a69a',
  lineWidth: 2,
};

export const defaultLongStyle = {
  strokeColor: '#26a69a',
  lineWidth: 2,
  takeProfitFillColor: '#4caf50',
  takeProfitFillOpacity: 0.15,
  stopLossFillColor: '#f44336',
  stopLossFillOpacity: 0.15,
  showRiskReward: false,
};

export const defaultShortStyle = {
  strokeColor: '#ef5350',
  lineWidth: 2,
  takeProfitFillColor: '#4caf50',
  takeProfitFillOpacity: 0.15,
  stopLossFillColor: '#f44336',
  stopLossFillOpacity: 0.15,
  showRiskReward: false,
};

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `drawing-${Math.random().toString(36).slice(2)}-${Date.now()}`;
};

const clampOpacity = (value: number | undefined): number | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (Number.isNaN(value)) {
    return undefined;
  }
  return Math.min(Math.max(value, 0), 1);
};

interface DrawingState {
  datasetId: string;
  activeTool: ToolType;
  drawings: Drawing[];
  draft: DraftDrawing | null;
  selectionId: string | null;
  undoStack: Drawing[][];
  redoStack: Drawing[][];
  revision: number;
  midlineEnabled: boolean;
  lastRectangleStyle: RectangleDrawing['style'];
  lastTrendlineStyle: TrendlineDrawing['style'];
  lastLongStyle: PositionDrawing['style'];
  lastShortStyle: PositionDrawing['style'];
  setMidlineEnabled: (enabled: boolean) => void;
  setDatasetId: (datasetId: string) => void;
  setActiveTool: (tool: ToolType) => void;
  beginDraft: (type: Drawing['type'], start: ChartPoint) => void;
  updateDraft: (point: ChartPoint) => void;
  commitDraft: () => void;
  cancelDraft: () => void;
  loadSnapshot: (drawings: Drawing[]) => void;
  selectDrawing: (id: string | null) => void;
  createHistoryCheckpoint: () => void;
  updateDrawingPoints: (
    id: string,
    updates: Partial<{ start: ChartPoint; end: ChartPoint; point: ChartPoint }>,
    options?: { skipHistory?: boolean }
  ) => void;
  updateRectangleStyle: (id: string, style: Partial<RectangleDrawing['style']>) => void;
  updateTrendlineStyle: (
    id: string,
    style: Partial<TrendlineDrawing['style']> & { extendLeft?: boolean; extendRight?: boolean }
  ) => void;
  updatePositionStyle: (id: string, style: Partial<PositionDrawing['style']> & { stopLoss?: number; takeProfit?: number; entry?: number }) => void;
  deleteSelection: () => void;
  duplicateSelection: () => void;
  undo: () => void;
  redo: () => void;
  clearAll: () => void;
  resetToolStyles: () => void;
}

const ensureMinimumMovement = (draft: DraftDrawing): boolean => {
  const deltaTime = Math.abs(draft.end.time - draft.start.time);
  const deltaPrice = Math.abs(draft.end.price - draft.start.price);
  return deltaTime > 0 || deltaPrice > 0;
};

export const useDrawingStore = create<DrawingState>((set, get) => ({
  datasetId: 'default',
  activeTool: 'select',
  drawings: [],
  draft: null,
  selectionId: null,
  undoStack: [],
  redoStack: [],
  revision: 0,
  midlineEnabled: false,
  lastRectangleStyle: { ...defaultRectangleStyle },
  lastTrendlineStyle: { ...defaultTrendlineStyle },
  lastLongStyle: { ...defaultLongStyle },
  lastShortStyle: { ...defaultShortStyle },
  setMidlineEnabled: (enabled) => set({ midlineEnabled: enabled }),
  setDatasetId: (datasetId) => set({ datasetId }),
  setActiveTool: (tool) => set({ activeTool: tool, draft: null }),
  beginDraft: (type, start) =>
    set({
      draft: {
        type,
        start,
        end: { ...start },
      },
      selectionId: null,
    }),
  updateDraft: (point) => {
    const { draft } = get();
    if (!draft) {
      return;
    }
    set({ draft: { ...draft, end: point } });
  },
  commitDraft: () => {
    const state = get();
    const { draft } = state;

    if (!draft) {
      set({ draft: null });
      return;
    }

    // Ensure minimum movement for all tools
    if (!ensureMinimumMovement(draft)) {
      set({ draft: null });
      return;
    }

    let drawing: Drawing;

    if (draft.type === 'rectangle') {
      drawing = {
        id: generateId(),
        type: 'rectangle',
        start: { ...draft.start },
        end: { ...draft.end },
        style: { ...state.lastRectangleStyle },
        midline: state.midlineEnabled,
      };
    } else if (draft.type === 'trendline') {
      drawing = {
        id: generateId(),
        type: 'trendline',
        start: { ...draft.start },
        end: { ...draft.end },
        extendLeft: false,
        extendRight: false,
        style: { ...state.lastTrendlineStyle },
      };
    } else if (draft.type === 'long') {
      // For long positions, use the rectangle to define levels
      // Entry is at the bottom, TP at top, SL calculated below entry
      const topPrice = Math.max(draft.start.price, draft.end.price);
      const bottomPrice = Math.min(draft.start.price, draft.end.price);
      const entryPrice = bottomPrice;
      const takeProfit = topPrice;
      // Calculate stop loss as same distance below entry as TP is above
      const reward = takeProfit - entryPrice;
      const stopLoss = entryPrice - (reward / 2); // 2:1 risk/reward

      // Ensure a minimum horizontal span so the position rectangle is visible
      const startTime = Math.min(draft.start.time, draft.end.time);
      const endTime = Math.max(draft.start.time, draft.end.time);
      const MIN_TIME_DELTA = 1; // seconds - small non-zero span
      const normalizedStart = { ...draft.start };
      const normalizedEnd = { ...draft.end };
      if (startTime === endTime) {
        normalizedStart.time = startTime - MIN_TIME_DELTA;
        normalizedEnd.time = endTime + MIN_TIME_DELTA;
      }

      drawing = {
        id: generateId(),
        type: 'long',
        point: {
          time: (normalizedStart.time + normalizedEnd.time) / 2, // Center horizontally
          price: entryPrice
        },
        start: { ...normalizedStart },
        end: { ...normalizedEnd },
        stopLoss,
        takeProfit,
        style: { ...state.lastLongStyle },
      };
    } else {
      // short - Entry is at the top, TP at bottom, SL calculated above entry
      const topPrice = Math.max(draft.start.price, draft.end.price);
      const bottomPrice = Math.min(draft.start.price, draft.end.price);
      const entryPrice = topPrice;
      const takeProfit = bottomPrice;
      // Calculate stop loss as same distance above entry as TP is below
      const reward = entryPrice - takeProfit;
      const stopLoss = entryPrice + (reward / 2); // 2:1 risk/reward

      // Ensure a minimum horizontal span so the position rectangle is visible
      const startTimeS = Math.min(draft.start.time, draft.end.time);
      const endTimeS = Math.max(draft.start.time, draft.end.time);
      const MIN_TIME_DELTA_S = 1; // seconds
      const normalizedStartS = { ...draft.start };
      const normalizedEndS = { ...draft.end };
      if (startTimeS === endTimeS) {
        normalizedStartS.time = startTimeS - MIN_TIME_DELTA_S;
        normalizedEndS.time = endTimeS + MIN_TIME_DELTA_S;
      }

      drawing = {
        id: generateId(),
        type: 'short',
        point: {
          time: (normalizedStartS.time + normalizedEndS.time) / 2, // Center horizontally
          price: entryPrice
        },
        start: { ...normalizedStartS },
        end: { ...normalizedEndS },
        stopLoss,
        takeProfit,
        style: { ...state.lastShortStyle },
      };
    }

    set((state) => ({
      drawings: [...state.drawings, drawing],
      draft: null,
      selectionId: drawing.id,
      undoStack: [...state.undoStack, cloneDrawingList(state.drawings)],
      redoStack: [],
      revision: state.revision + 1,
      activeTool: 'select',
    }));

    // Persist workspace immediately so new drawings survive reloads and
    // are not lost if the user navigates away. Preserve the existing
    // playbackIndex from storage when available, otherwise default to 0.
    try {
      const dsId = get().datasetId || 'default';
      const persisted = loadWorkspaceState(dsId);
      const playbackIndex = persisted?.playbackIndex ?? 0;
      saveWorkspaceState(dsId, { drawings: get().drawings, playbackIndex });
    } catch (err) {
      // Non-fatal: persistence failure shouldn't stop normal operation
      // eslint-disable-next-line no-console
      console.warn('Failed to persist workspace after commitDraft', err);
    }
  },
  cancelDraft: () => set({ draft: null }),
  loadSnapshot: (drawings) =>
    set({
      drawings: cloneDrawingList(drawings),
      undoStack: [],
      redoStack: [],
      selectionId: null,
      revision: Date.now(),
    }),
  selectDrawing: (id) => set({ selectionId: id, activeTool: 'select' }),
  createHistoryCheckpoint: () =>
    set((state) => ({
      undoStack: [...state.undoStack, cloneDrawingList(state.drawings)],
      redoStack: [],
    })),
  updateDrawingPoints: (id, updates, options) =>
    set((state) => {
      const index = state.drawings.findIndex((drawing) => drawing.id === id);
      if (index === -1) {
        return state;
      }
      const drawings = cloneDrawingList(state.drawings);
      const target = drawings[index];

      // Handle different drawing types
      if (target.type === 'long' || target.type === 'short') {
        if (updates.point) {
          target.point = { ...target.point, ...updates.point };
        }
        // Positions now also have start and end for the rectangle bounds
        if (updates.start) {
          target.start = { ...target.start, ...updates.start };
        }
        if (updates.end) {
          target.end = { ...target.end, ...updates.end };
        }
      } else {
        // Rectangle or trendline
        if (updates.start && 'start' in target) {
          target.start = { ...target.start, ...updates.start };
        }
        if (updates.end && 'end' in target) {
          target.end = { ...target.end, ...updates.end };
        }
      }

      const baseUpdate = {
        drawings,
        revision: state.revision + 1,
      } as Partial<DrawingState>;

      if (options?.skipHistory) {
        return baseUpdate;
      }

      return {
        ...baseUpdate,
        undoStack: [...state.undoStack, cloneDrawingList(state.drawings)],
        redoStack: [],
      };
    }),
  updateRectangleStyle: (id, style) =>
    set((state) => {
      const index = state.drawings.findIndex((drawing) => drawing.id === id && drawing.type === 'rectangle');
      if (index === -1) {
        return state;
      }
      const drawings = cloneDrawingList(state.drawings) as RectangleDrawing[];
      const target = drawings[index] as RectangleDrawing;
      const { midline, ...styleUpdates } = style as Partial<RectangleDrawing['style']> & { midline?: boolean };
      const normalizedUpdates: Partial<RectangleDrawing['style']> = { ...styleUpdates };

      if (Object.prototype.hasOwnProperty.call(styleUpdates, 'opacity')) {
        const clampedOpacity = clampOpacity(styleUpdates.opacity);
        normalizedUpdates.opacity = clampedOpacity ?? target.style.opacity;
      }

      if (Object.prototype.hasOwnProperty.call(styleUpdates, 'strokeOpacity')) {
        const clampedStrokeOpacity = clampOpacity(styleUpdates.strokeOpacity);
        normalizedUpdates.strokeOpacity = clampedStrokeOpacity ?? target.style.strokeOpacity;
      }

      const newStyle = { ...target.style, ...normalizedUpdates };
      target.style = newStyle;

      if (midline !== undefined) {
        target.midline = !!midline;
      }
      // Remember the last used style for future rectangles
      return {
        drawings,
        lastRectangleStyle: newStyle,
        undoStack: [...state.undoStack, cloneDrawingList(state.drawings)],
        redoStack: [],
        revision: state.revision + 1,
      };
    }),
  updateTrendlineStyle: (id, style) =>
    set((state) => {
      const index = state.drawings.findIndex((drawing) => drawing.id === id && drawing.type === 'trendline');
      if (index === -1) {
        return state;
      }
      const drawings = cloneDrawingList(state.drawings) as TrendlineDrawing[];
      const target = drawings[index] as TrendlineDrawing;
      const { extendLeft, extendRight, ...styleUpdates } = style;
      const newStyle = { ...target.style, ...styleUpdates };
      target.style = newStyle;
      if (extendLeft !== undefined) {
        target.extendLeft = extendLeft;
      }
      if (extendRight !== undefined) {
        target.extendRight = extendRight;
      }
      // Remember the last used style for future trendlines
      return {
        drawings,
        lastTrendlineStyle: newStyle,
        undoStack: [...state.undoStack, cloneDrawingList(state.drawings)],
        redoStack: [],
        revision: state.revision + 1,
      };
    }),
  updatePositionStyle: (id, style) =>
    set((state) => {
      const index = state.drawings.findIndex((drawing) => drawing.id === id && (drawing.type === 'long' || drawing.type === 'short'));
      if (index === -1) {
        return state;
      }
      const drawings = cloneDrawingList(state.drawings) as PositionDrawing[];
      const target = drawings[index] as PositionDrawing;
      const { stopLoss, takeProfit, entry, ...styleUpdates } = style;
      const normalizedStyleUpdates: Partial<PositionDrawing['style']> = { ...styleUpdates };

      if ('takeProfitFillOpacity' in normalizedStyleUpdates) {
        normalizedStyleUpdates.takeProfitFillOpacity = clampOpacity(
          normalizedStyleUpdates.takeProfitFillOpacity
        ) ?? target.style.takeProfitFillOpacity;
      }

      if ('stopLossFillOpacity' in normalizedStyleUpdates) {
        normalizedStyleUpdates.stopLossFillOpacity = clampOpacity(
          normalizedStyleUpdates.stopLossFillOpacity
        ) ?? target.style.stopLossFillOpacity;
      }

      const newStyle = { ...target.style, ...normalizedStyleUpdates };
      target.style = newStyle;
      if (stopLoss !== undefined) {
        target.stopLoss = stopLoss;
      }
      if (takeProfit !== undefined) {
        target.takeProfit = takeProfit;
      }
      if (entry !== undefined) {
        target.point = { ...target.point, price: entry };
      }

      // Recalculate rectangle bounds based on new TP and SL values
      const isLong = target.type === 'long';
      const entryPrice = target.point.price;
      const tpPrice = target.takeProfit;
      const slPrice = target.stopLoss;

      if (tpPrice !== undefined && slPrice !== undefined) {
        // Calculate the new rectangle bounds to encompass Entry, TP, and SL
        const topPrice = Math.max(entryPrice, tpPrice, slPrice);
        const bottomPrice = Math.min(entryPrice, tpPrice, slPrice);

        // Keep the same time bounds, just update the price bounds
        target.start = {
          time: target.start.time,
          price: bottomPrice,
        };
        target.end = {
          time: target.end.time,
          price: topPrice,
        };
      }

      // Remember the last used style for future positions
      const styleKey = target.type === 'long' ? 'lastLongStyle' : 'lastShortStyle';
      return {
        drawings,
        [styleKey]: newStyle,
        undoStack: [...state.undoStack, cloneDrawingList(state.drawings)],
        redoStack: [],
        revision: state.revision + 1,
      };
    }),
  deleteSelection: () =>
    set((state) => {
      if (!state.selectionId) {
        return state;
      }
      const target = state.drawings.find((d) => d.id === state.selectionId);
      // If the drawing is linked to an order and that order still exists, prevent deletion
      try {
        // Import trading store lazily to avoid circular import issues at module initialization
        // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
        const { useTradingStore } = require('./tradingStore');
        if (target && (target as any).linkedOrderId) {
          const orderId = (target as any).linkedOrderId as string;
          const orders = useTradingStore.getState().positions;
          const stillExists = orders.some((p: any) => p.id === orderId);
          if (stillExists) {
            // Do not delete the drawing while its order exists
            // eslint-disable-next-line no-console
            console.warn('Cannot delete drawing linked to active order', orderId);
            return state;
          }
        }
      } catch (err) {
        // If trading store cannot be inspected for some reason, fall back to allowing deletion
      }

      return {
        drawings: state.drawings.filter((drawing) => drawing.id !== state.selectionId),
        selectionId: null,
        undoStack: [...state.undoStack, cloneDrawingList(state.drawings)],
        redoStack: [],
        revision: state.revision + 1,
      };
    }),
  duplicateSelection: () =>
    set((state) => {
      if (!state.selectionId) {
        return state;
      }
      const source = state.drawings.find((drawing) => drawing.id === state.selectionId);
      if (!source) {
        return state;
      }
      const duplicated = cloneDrawingList([source])[0];
      duplicated.id = generateId();

      // Handle different drawing types
      if (duplicated.type === 'long' || duplicated.type === 'short') {
        duplicated.point = { ...duplicated.point, price: duplicated.point.price * 1.0005 };
        duplicated.start = { ...duplicated.start, price: duplicated.start.price * 1.0005 };
        duplicated.end = { ...duplicated.end, price: duplicated.end.price * 1.0005 };
        if (duplicated.stopLoss !== undefined) {
          duplicated.stopLoss = duplicated.stopLoss * 1.0005;
        }
        if (duplicated.takeProfit !== undefined) {
          duplicated.takeProfit = duplicated.takeProfit * 1.0005;
        }
      } else if ('start' in duplicated && 'end' in duplicated) {
        duplicated.start = { ...duplicated.start, price: duplicated.start.price * 1.0005 };
        duplicated.end = { ...duplicated.end, price: duplicated.end.price * 1.0005 };
      }

      return {
        drawings: [...state.drawings, duplicated],
        selectionId: duplicated.id,
        undoStack: [...state.undoStack, cloneDrawingList(state.drawings)],
        redoStack: [],
        revision: state.revision + 1,
      };
    }),
  undo: () =>
    set((state) => {
      if (state.undoStack.length === 0) {
        return state;
      }
      const previous = state.undoStack[state.undoStack.length - 1];
      const undoStack = state.undoStack.slice(0, -1);
      return {
        drawings: previous,
        undoStack,
        redoStack: [...state.redoStack, cloneDrawingList(state.drawings)],
        selectionId: null,
        revision: state.revision + 1,
      };
    }),
  redo: () =>
    set((state) => {
      if (state.redoStack.length === 0) {
        return state;
      }
      const next = state.redoStack[state.redoStack.length - 1];
      const redoStack = state.redoStack.slice(0, -1);
      return {
        drawings: next,
        redoStack,
        undoStack: [...state.undoStack, cloneDrawingList(state.drawings)],
        selectionId: null,
        revision: state.revision + 1,
      };
    }),
  clearAll: () => set({ drawings: [], undoStack: [], redoStack: [], selectionId: null, revision: Date.now() }),
  resetToolStyles: () => set({
    lastRectangleStyle: { ...defaultRectangleStyle },
    lastTrendlineStyle: { ...defaultTrendlineStyle },
    lastLongStyle: { ...defaultLongStyle },
    lastShortStyle: { ...defaultShortStyle },
  }),
}));