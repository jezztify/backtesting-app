import { PointerEvent, useCallback, useMemo, useRef, useState } from 'react';
import PropertiesPanelModal from './PropertiesPanelModal';
import { useDrawingStore } from '../state/drawingStore';
import { ChartPoint, Drawing, RectangleDrawing, TrendlineDrawing, PositionDrawing } from '../types/drawings';
import { distanceToSegment, extendLineToBounds, isPointInRect, clipLineToBounds } from '../utils/geometry';

interface ChartConverters {
  toCanvas: (point: ChartPoint) => { x: number; y: number } | null;
  toChart: (point: { x: number; y: number }) => ChartPoint | null;
}

interface PanSession {
  initialRange: { from: number; to: number };
  startLogical: number;
  initialPriceRange: { from: number; to: number } | null;
  startY: number;
}

interface PanHandlers {
  start: (startX: number, startY: number) => PanSession | null;
  move: (session: PanSession, currentX: number, currentY: number) => void;
  end: () => void;
}

interface DrawingOverlayProps {
  width: number;
  height: number;
  converters: ChartConverters;
  renderTick: number;
  panHandlers?: PanHandlers;
}

type RectangleHandle = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'middle-left' | 'middle-right';
type HandleType = 'start' | 'end' | 'point' | 'takeProfit' | 'stopLoss' | RectangleHandle;
type HandleSide = 'left' | 'right';
type PositionHandleType = 'takeProfit' | 'stopLoss' | 'point';

interface HandleHitResult {
  drawingId: string;
  handle: HandleType;
  side?: HandleSide;
}

type InteractionState =
  | { type: 'idle' }
  | { type: 'drawing' }
  | {
    type: 'moving';
    drawingId: string;
    pointerStart: { x: number; y: number };
    chartStart: ChartPoint;
    originalStart: ChartPoint;
    originalEnd: ChartPoint;
    originalEntry?: number;
    originalTakeProfit?: number;
    originalStopLoss?: number;
  }
  | {
    type: 'resizing';
    drawingId: string;
    handle: HandleType;
    pointerStart: { x: number; y: number };
    chartStart: ChartPoint;
    originalStart: ChartPoint;
    originalEnd: ChartPoint;
    oppositeCorner?: ChartPoint;
    side?: HandleSide;
  }
  | {
    type: 'panning';
    session: PanSession;
  };

const HANDLE_RADIUS = 6;
const TRENDLINE_HIT_THRESHOLD = 8;
const RECTANGLE_HANDLES: RectangleHandle[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right'];
const POSITION_HANDLE_MARGIN = 14;
const MIN_POSITION_PIXEL_WIDTH = 12;
const MIN_POSITION_PIXEL_HEIGHT = 12;

const RECTANGLE_OPPOSITE_HANDLE: Record<RectangleHandle, RectangleHandle> = {
  'top-left': 'bottom-right',
  'top-right': 'bottom-left',
  'bottom-left': 'top-right',
  'bottom-right': 'top-left',
  'middle-left': 'middle-right',
  'middle-right': 'middle-left',
};

const isRectangleHandle = (handle: HandleType): handle is RectangleHandle => RECTANGLE_HANDLES.includes(handle as RectangleHandle);

const getRectangleHandlePositions = (rect: { x: number; y: number; width: number; height: number }) => ({
  'top-left': { x: rect.x, y: rect.y },
  'top-right': { x: rect.x + rect.width, y: rect.y },
  'bottom-left': { x: rect.x, y: rect.y + rect.height },
  'bottom-right': { x: rect.x + rect.width, y: rect.y + rect.height },
  'middle-left': { x: rect.x, y: rect.y + rect.height / 2 },
  'middle-right': { x: rect.x + rect.width, y: rect.y + rect.height / 2 },
} as const);

const getRectangleChartCorners = (start: ChartPoint, end: ChartPoint) => {
  const minTime = Math.min(start.time, end.time);
  const maxTime = Math.max(start.time, end.time);
  const minPrice = Math.min(start.price, end.price);
  const maxPrice = Math.max(start.price, end.price);
  const midPrice = (minPrice + maxPrice) / 2;

  return {
    'top-left': { time: minTime, price: maxPrice },
    'top-right': { time: maxTime, price: maxPrice },
    'bottom-left': { time: minTime, price: minPrice },
    'bottom-right': { time: maxTime, price: minPrice },
    'middle-left': { time: minTime, price: midPrice },
    'middle-right': { time: maxTime, price: midPrice },
  } as const;
};

const getRectangleOppositeCorner = (handle: RectangleHandle, start: ChartPoint, end: ChartPoint): ChartPoint => {
  const corners = getRectangleChartCorners(start, end);
  return corners[RECTANGLE_OPPOSITE_HANDLE[handle]];
};

const getPositionHandleXs = (rect: { x: number; width: number }): { left: number; right: number } => {
  const left = rect.x;
  const right = rect.x + rect.width;

  if (right <= left) {
    const center = rect.x + rect.width / 2;
    return { left: center, right: center };
  }

  return { left, right };
};

const clampPositionPrice = (drawing: PositionDrawing, handle: PositionHandleType, price: number): number => {
  const entry = drawing.point.price;
  const takeProfit = drawing.takeProfit;
  const stopLoss = drawing.stopLoss;

  if (drawing.type === 'long') {
    if (handle === 'takeProfit') {
      const floor = Math.max(entry, stopLoss ?? -Infinity);
      return Math.max(price, floor);
    }
    if (handle === 'stopLoss') {
      const ceiling = Math.min(entry, takeProfit ?? Infinity);
      return Math.min(price, ceiling);
    }
    const minBound = stopLoss ?? -Infinity;
    const maxBound = takeProfit ?? Infinity;
    return Math.min(Math.max(price, minBound), maxBound);
  }

  if (handle === 'takeProfit') {
    const ceiling = Math.min(entry, stopLoss ?? entry);
    return Math.min(price, ceiling);
  }
  if (handle === 'stopLoss') {
    const floor = Math.max(entry, takeProfit ?? entry);
    return Math.max(price, floor);
  }
  const minBound = takeProfit ?? -Infinity;
  const maxBound = stopLoss ?? Infinity;
  return Math.min(Math.max(price, minBound), maxBound);
};

const hasMinimumVerticalSpacing = (
  drawing: PositionDrawing,
  handle: PositionHandleType,
  candidatePrice: number,
  converters: ChartConverters
): boolean => {
  const entryPrice = handle === 'point' ? candidatePrice : drawing.point.price;
  const tpPrice = handle === 'takeProfit' ? candidatePrice : drawing.takeProfit;
  const slPrice = handle === 'stopLoss' ? candidatePrice : drawing.stopLoss;

  const time = drawing.point.time;
  const entryPoint = converters.toCanvas({ time, price: entryPrice });
  const tpPoint = tpPrice !== undefined ? converters.toCanvas({ time, price: tpPrice }) : null;
  const slPoint = slPrice !== undefined ? converters.toCanvas({ time, price: slPrice }) : null;

  const comparisons: Array<[typeof entryPoint, typeof entryPoint]> = [];
  if (tpPoint) {
    comparisons.push([entryPoint, tpPoint]);
  }
  if (slPoint) {
    comparisons.push([entryPoint, slPoint]);
  }
  if (tpPoint && slPoint) {
    comparisons.push([tpPoint, slPoint]);
  }

  for (const [a, b] of comparisons) {
    if (!a || !b) {
      continue;
    }
    if (Math.abs(a.y - b.y) < MIN_POSITION_PIXEL_HEIGHT) {
      return false;
    }
  }

  return true;
};

const normalizeRectanglePoints = (a: ChartPoint, b: ChartPoint): { start: ChartPoint; end: ChartPoint } => {
  const minTime = Math.min(a.time, b.time);
  const maxTime = Math.max(a.time, b.time);
  const minPrice = Math.min(a.price, b.price);
  const maxPrice = Math.max(a.price, b.price);

  return {
    start: { time: minTime, price: minPrice },
    end: { time: maxTime, price: maxPrice },
  };
};

interface CanvasDrawingBase {
  drawing: Drawing;
}

interface CanvasRectangle extends CanvasDrawingBase {
  start: { x: number; y: number };
  end: { x: number; y: number };
  rect: { x: number; y: number; width: number; height: number };
}

interface CanvasTrendline extends CanvasDrawingBase {
  start: { x: number; y: number };
  end: { x: number; y: number };
  line: { x1: number; y1: number; x2: number; y2: number };
}

interface CanvasPosition extends CanvasDrawingBase {
  point: { x: number; y: number };
  start: { x: number; y: number };
  end: { x: number; y: number };
  rect: { x: number; y: number; width: number; height: number };
  takeProfit?: { x: number; y: number };
  stopLoss?: { x: number; y: number };
}

type CanvasDrawing = CanvasRectangle | CanvasTrendline | CanvasPosition;

const isCanvasRectangle = (value: CanvasDrawing): value is CanvasRectangle => value.drawing.type === 'rectangle';
const isCanvasPosition = (value: CanvasDrawing): value is CanvasPosition => value.drawing.type === 'long' || value.drawing.type === 'short';

const getPointerPosition = (event: PointerEvent<SVGSVGElement>): { x: number; y: number } | null => {
  const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
  if (!rect) {
    return null;
  }
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
};

const DrawingOverlay = ({ width, height, converters, renderTick, panHandlers }: DrawingOverlayProps) => {
  const overlayRef = useRef<SVGSVGElement | null>(null);
  const [interaction, setInteraction] = useState<InteractionState>({ type: 'idle' });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; drawingId: string } | null>(null);
  const [showPropertiesModal, setShowPropertiesModal] = useState<{ drawingId: string; x: number; y: number } | null>(null);
  const [modalDragging, setModalDragging] = useState<{ offsetX: number; offsetY: number } | null>(null);

  const {
    activeTool,
    drawings,
    draft,
    selectionId,
    beginDraft,
    updateDraft,
    commitDraft,
    cancelDraft,
    selectDrawing,
    createHistoryCheckpoint,
    updateDrawingPoints,
    updatePositionStyle,
  } = useDrawingStore((state) => ({
    activeTool: state.activeTool,
    drawings: state.drawings,
    draft: state.draft,
    selectionId: state.selectionId,
    beginDraft: state.beginDraft,
    updateDraft: state.updateDraft,
    commitDraft: state.commitDraft,
    cancelDraft: state.cancelDraft,
    selectDrawing: state.selectDrawing,
    createHistoryCheckpoint: state.createHistoryCheckpoint,
    updateDrawingPoints: state.updateDrawingPoints,
    updatePositionStyle: state.updatePositionStyle,
  }));

  const canvasDrawings = useMemo(() => {
    return drawings
      .map<CanvasDrawing | null>((drawing) => {
        // Handle position types
        if (drawing.type === 'long' || drawing.type === 'short') {
          const timeCandidates = Array.from(
            new Set(
              [drawing.point.time, drawing.start.time, drawing.end.time].filter(
                (value): value is number => Number.isFinite(value)
              )
            )
          );

          const convertWithFallback = (price: number, preferredTime?: number) => {
            const orderedTimes = preferredTime === undefined
              ? timeCandidates
              : [preferredTime, ...timeCandidates.filter((time) => time !== preferredTime)];

            for (const time of orderedTimes) {
              const coords = converters.toCanvas({ time, price });
              if (coords) {
                return coords;
              }
            }
            return null;
          };

          const start = convertWithFallback(drawing.start.price, drawing.start.time);
          const end = convertWithFallback(drawing.end.price, drawing.end.time);
          const pointCandidate = convertWithFallback(drawing.point.price, drawing.point.time);

          const anchor = pointCandidate ?? start ?? end;
          if (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) {
            return null;
          }

          const MIN_W = MIN_POSITION_PIXEL_WIDTH;
          const MIN_H = MIN_POSITION_PIXEL_HEIGHT;

          if (!start || !end) {
            const rectW = MIN_W;
            const rectH = MIN_H;
            const rectX = Math.max(0, Math.min(width - rectW, anchor.x - rectW / 2));
            const rectY = Math.max(0, Math.min(height - rectH, anchor.y - rectH / 2));

            const centerX = rectX + rectW / 2;
            const centerY = rectY + rectH / 2;

            const takeProfitPoint = drawing.takeProfit !== undefined
              ? {
                x: centerX,
                y: drawing.type === 'long' ? rectY : rectY + rectH,
              }
              : undefined;

            const stopLossPoint = drawing.stopLoss !== undefined
              ? {
                x: centerX,
                y: drawing.type === 'long' ? rectY + rectH : rectY,
              }
              : undefined;

            return {
              drawing,
              point: pointCandidate ?? { x: centerX, y: centerY },
              start: { x: rectX, y: rectY },
              end: { x: rectX + rectW, y: rectY + rectH },
              rect: { x: rectX, y: rectY, width: rectW, height: rectH },
              takeProfit: takeProfitPoint,
              stopLoss: stopLossPoint,
            } satisfies CanvasPosition;
          }

          const clippedX = Math.max(0, Math.min(start.x, end.x, width));
          const clippedY = Math.max(0, Math.min(start.y, end.y, height));
          const clippedX2 = Math.min(width, Math.max(start.x, end.x, 0));
          const clippedY2 = Math.min(height, Math.max(start.y, end.y, 0));

          let rectX = clippedX;
          let rectY = clippedY;
          let rectW = clippedX2 - clippedX;
          let rectH = clippedY2 - clippedY;

          if (rectW <= 0) {
            rectW = MIN_W;
            rectX = Math.max(0, Math.min(width - rectW, anchor.x - rectW / 2));
          }

          if (rectH <= 0) {
            rectH = MIN_H;
            rectY = Math.max(0, Math.min(height - rectH, anchor.y - rectH / 2));
          }

          const rect = { x: rectX, y: rectY, width: rectW, height: rectH };
          const point = pointCandidate ?? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };

          const clampY = (value: number) => Math.max(0, Math.min(height, value));
          const centerX = rect.x + rect.width / 2;

          let takeProfitPoint = drawing.takeProfit !== undefined
            ? convertWithFallback(drawing.takeProfit)
            : null;
          if (!takeProfitPoint && drawing.takeProfit !== undefined) {
            const fallbackY = drawing.type === 'long' ? rect.y : rect.y + rect.height;
            takeProfitPoint = { x: centerX, y: clampY(fallbackY) };
          }

          let stopLossPoint = drawing.stopLoss !== undefined
            ? convertWithFallback(drawing.stopLoss)
            : null;
          if (!stopLossPoint && drawing.stopLoss !== undefined) {
            const baseY = drawing.type === 'long' ? rect.y + rect.height : rect.y;
            const direction = drawing.type === 'long' ? 1 : -1;
            const fallbackY = clampY(baseY + direction * Math.max(MIN_H, rect.height / 2));
            stopLossPoint = { x: centerX, y: fallbackY };
          }

          return {
            drawing,
            point,
            start,
            end,
            rect,
            takeProfit: takeProfitPoint ?? undefined,
            stopLoss: stopLossPoint ?? undefined,
          } satisfies CanvasPosition;
        }

        // Handle rectangle and trendline types (both have start and end)
        const drawingWithPoints = drawing as RectangleDrawing | TrendlineDrawing;
        const start = converters.toCanvas(drawingWithPoints.start);
        const end = converters.toCanvas(drawingWithPoints.end);
        if (!start || !end) {
          return null;
        }

        if (drawing.type === 'rectangle') {
          // Clip rectangle to canvas bounds
          const clippedX = Math.max(0, Math.min(start.x, end.x, width));
          const clippedY = Math.max(0, Math.min(start.y, end.y, height));
          const clippedX2 = Math.min(width, Math.max(start.x, end.x, 0));
          const clippedY2 = Math.min(height, Math.max(start.y, end.y, 0));

          const rect = {
            x: clippedX,
            y: clippedY,
            width: clippedX2 - clippedX,
            height: clippedY2 - clippedY,
          };

          // If rectangle is completely outside bounds, don't render it
          if (rect.width <= 0 || rect.height <= 0) {
            return null;
          }

          return { drawing, start, end, rect } satisfies CanvasRectangle;
        }

        // For trendlines, clip to canvas bounds instead of extending
        const clipped = clipLineToBounds(start, end, width, height);
        if (!clipped) {
          // Line is completely outside canvas bounds
          return null;
        }

        return {
          drawing,
          start: clipped.clippedStart,
          end: clipped.clippedEnd,
          line: {
            x1: clipped.clippedStart.x,
            y1: clipped.clippedStart.y,
            x2: clipped.clippedEnd.x,
            y2: clipped.clippedEnd.y
          },
        } satisfies CanvasTrendline;
      })
      .filter((value): value is CanvasDrawing => value !== null);
  }, [drawings, converters, width, height, renderTick]);

  const handleDraftUpdate = useCallback(
    (point: ChartPoint, shiftKey: boolean) => {
      if (draft) {
        // If shift is held and we're drawing a trendline, make it perfectly horizontal
        if (shiftKey && draft.type === 'trendline') {
          // Keep the price the same as the start point (horizontal line)
          updateDraft({ time: point.time, price: draft.start.price });
        } else {
          updateDraft(point);
        }
      }
    },
    [draft, updateDraft]
  );

  const hitTestHandles = useCallback(
    (canvasPoint: { x: number; y: number }): HandleHitResult | null => {
      for (const item of canvasDrawings) {
        if (isCanvasRectangle(item)) {
          const handlePositions = getRectangleHandlePositions(item.rect);
          for (const handle of RECTANGLE_HANDLES) {
            const point = handlePositions[handle];
            const distance = Math.hypot(canvasPoint.x - point.x, canvasPoint.y - point.y);
            if (distance <= HANDLE_RADIUS + 2) {
              return { drawingId: item.drawing.id, handle };
            }
          }
        } else if (isCanvasPosition(item)) {
          const drawing = item.drawing as PositionDrawing;
          const { left: leftX, right: rightX } = getPositionHandleXs(item.rect);

          if (drawing.takeProfit !== undefined && item.takeProfit) {
            const leftDistance = Math.hypot(canvasPoint.x - leftX, canvasPoint.y - item.takeProfit.y);
            const rightDistance = Math.hypot(canvasPoint.x - rightX, canvasPoint.y - item.takeProfit.y);
            if (leftDistance <= HANDLE_RADIUS + 2) {
              return { drawingId: item.drawing.id, handle: 'takeProfit', side: 'left' };
            }
            if (rightDistance <= HANDLE_RADIUS + 2) {
              return { drawingId: item.drawing.id, handle: 'takeProfit', side: 'right' };
            }
          }

          if (drawing.stopLoss !== undefined && item.stopLoss) {
            const leftDistance = Math.hypot(canvasPoint.x - leftX, canvasPoint.y - item.stopLoss.y);
            const rightDistance = Math.hypot(canvasPoint.x - rightX, canvasPoint.y - item.stopLoss.y);
            if (leftDistance <= HANDLE_RADIUS + 2) {
              return { drawingId: item.drawing.id, handle: 'stopLoss', side: 'left' };
            }
            if (rightDistance <= HANDLE_RADIUS + 2) {
              return { drawingId: item.drawing.id, handle: 'stopLoss', side: 'right' };
            }
          }

          const entryLeftDistance = Math.hypot(canvasPoint.x - leftX, canvasPoint.y - item.point.y);
          const entryRightDistance = Math.hypot(canvasPoint.x - rightX, canvasPoint.y - item.point.y);
          if (entryLeftDistance <= HANDLE_RADIUS + 2) {
            return { drawingId: item.drawing.id, handle: 'point', side: 'left' };
          }
          if (entryRightDistance <= HANDLE_RADIUS + 2) {
            return { drawingId: item.drawing.id, handle: 'point', side: 'right' };
          }
        } else {
          const trendlineItem = item as CanvasTrendline;
          const handles = [
            { id: 'start', point: trendlineItem.start },
            { id: 'end', point: trendlineItem.end },
          ] as const;
          for (const handle of handles) {
            const distance = Math.hypot(canvasPoint.x - handle.point.x, canvasPoint.y - handle.point.y);
            if (distance <= HANDLE_RADIUS + 2) {
              return { drawingId: item.drawing.id, handle: handle.id };
            }
          }
        }
      }
      return null;
    },
    [canvasDrawings]
  );

  const hitTestDrawings = useCallback(
    (canvasPoint: { x: number; y: number }) => {
      for (let i = canvasDrawings.length - 1; i >= 0; i -= 1) {
        const item = canvasDrawings[i];
        if (isCanvasRectangle(item)) {
          if (isPointInRect(canvasPoint, item.rect)) {
            return item.drawing;
          }
        } else if (isCanvasPosition(item)) {
          // Hit test for position rectangle
          if (isPointInRect(canvasPoint, item.rect)) {
            return item.drawing;
          }
        } else {
          // Trendline hit test
          const trendlineItem = item as CanvasTrendline;
          const distance = distanceToSegment(canvasPoint, trendlineItem.start, trendlineItem.end);
          if (distance <= TRENDLINE_HIT_THRESHOLD) {
            return item.drawing;
          }
        }
      }
      return null;
    },
    [canvasDrawings]
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      if (event.button === 2) {
        // Right-click: show context menu if over a drawing
        const canvasPoint = getPointerPosition(event);
        if (!canvasPoint) return;
        const drawingHit = hitTestDrawings(canvasPoint);
        if (drawingHit) {
          setContextMenu({ x: canvasPoint.x, y: canvasPoint.y, drawingId: drawingHit.id });
          event.preventDefault();
          return;
        }
      }

      // Left-click: normal logic
      if (event.button !== 0) return;
      const canvasPoint = getPointerPosition(event);
      if (!canvasPoint) {
        return;
      }

      const chartPoint = converters.toChart(canvasPoint);

      const svg = event.currentTarget;
      svg.setPointerCapture(event.pointerId);

      if (activeTool === 'rectangle' || activeTool === 'trendline' || activeTool === 'long' || activeTool === 'short') {
        if (!chartPoint) {
          return;
        }
        beginDraft(activeTool, chartPoint);
        setInteraction({ type: 'drawing' });
        return;
      }

      if (activeTool === 'select') {
        const handleHit = hitTestHandles(canvasPoint);
        if (handleHit) {
          const drawing = drawings.find((item) => item.id === handleHit.drawingId);
          if (!drawing) {
            return;
          }
          if (!chartPoint) {
            return;
          }
          selectDrawing(drawing.id);
          createHistoryCheckpoint();

          // Build interaction state based on drawing type
          let originalStart: ChartPoint;
          let originalEnd: ChartPoint;

          if (drawing.type !== 'long' && drawing.type !== 'short') {
            const drawingWithPoints = drawing as RectangleDrawing | TrendlineDrawing;
            originalStart = drawingWithPoints.start;
            originalEnd = drawingWithPoints.end;
          } else {
            const positionDrawing = drawing as PositionDrawing;
            originalStart = positionDrawing.start;
            originalEnd = positionDrawing.end;
          }

          const nextInteraction: InteractionState = {
            type: 'resizing',
            drawingId: drawing.id,
            handle: handleHit.handle,
            pointerStart: canvasPoint,
            chartStart: chartPoint,
            originalStart,
            originalEnd,
            side: handleHit.side,
          };

          if ((drawing.type === 'rectangle' || drawing.type === 'long' || drawing.type === 'short') && isRectangleHandle(handleHit.handle)) {
            const drawingWithRect = drawing as RectangleDrawing | PositionDrawing;
            nextInteraction.oppositeCorner = getRectangleOppositeCorner(handleHit.handle, drawingWithRect.start, drawingWithRect.end);
          }

          setInteraction(nextInteraction);
          return;
        }

        const drawingHit = hitTestDrawings(canvasPoint);
        if (drawingHit) {
          if (!chartPoint) {
            return;
          }
          selectDrawing(drawingHit.id);
          createHistoryCheckpoint();

          // Build move interaction based on drawing type
          let originalStart: ChartPoint;
          let originalEnd: ChartPoint;
          let originalEntry: number | undefined;
          let originalTakeProfit: number | undefined;
          let originalStopLoss: number | undefined;

          if (drawingHit.type !== 'long' && drawingHit.type !== 'short') {
            const drawingWithPoints = drawingHit as RectangleDrawing | TrendlineDrawing;
            originalStart = drawingWithPoints.start;
            originalEnd = drawingWithPoints.end;
          } else {
            const positionDrawing = drawingHit as PositionDrawing;
            originalStart = positionDrawing.start;
            originalEnd = positionDrawing.end;
            originalEntry = positionDrawing.point.price;
            originalTakeProfit = positionDrawing.takeProfit;
            originalStopLoss = positionDrawing.stopLoss;
          }

          setInteraction({
            type: 'moving',
            drawingId: drawingHit.id,
            pointerStart: canvasPoint,
            chartStart: chartPoint,
            originalStart,
            originalEnd,
            originalEntry,
            originalTakeProfit,
            originalStopLoss,
          });
          return;
        }

        selectDrawing(null);
        if (panHandlers) {
          const session = panHandlers.start(canvasPoint.x, canvasPoint.y);
          if (session) {
            setInteraction({ type: 'panning', session });
            return;
          }
        }
        setInteraction({ type: 'idle' });
      }
    },
    [activeTool, beginDraft, converters, createHistoryCheckpoint, drawings, hitTestDrawings, hitTestHandles, panHandlers, selectDrawing]
  );
  // Hide context menu on click elsewhere
  const handleCanvasClick = useCallback(() => {
    if (contextMenu) setContextMenu(null);
  }, [contextMenu]);

  // Handle context menu action
  const handleContextMenuAction = useCallback((action: string) => {
    if (action === 'properties' && contextMenu) {
      // Position modal near context menu, clamped to canvas bounds
      const modalWidth = 300;
      const modalHeight = 400;
      const x = Math.max(0, Math.min(width - modalWidth, contextMenu.x + 10));
      const y = Math.max(0, Math.min(height - modalHeight, contextMenu.y - 50));

      setShowPropertiesModal({ drawingId: contextMenu.drawingId, x, y });
      setContextMenu(null);
    } else {
      setContextMenu(null);
    }
  }, [contextMenu, width, height]);

  // Hide modal
  const handleCloseModal = useCallback(() => {
    setShowPropertiesModal(null);
  }, []);

  // Modal drag handlers
  const handleModalDragStart = useCallback((offsetX: number, offsetY: number) => {
    setModalDragging({ offsetX, offsetY });
  }, []);

  const handleModalDrag = useCallback((clientX: number, clientY: number) => {
    if (!modalDragging || !showPropertiesModal || !overlayRef.current) {
      return;
    }

    const rect = overlayRef.current.getBoundingClientRect();
    const newX = clientX - rect.left - modalDragging.offsetX;
    const newY = clientY - rect.top - modalDragging.offsetY;

    // Clamp to canvas bounds
    const clampedX = Math.max(0, Math.min(width - 300, newX));
    const clampedY = Math.max(0, Math.min(height - 400, newY));

    setShowPropertiesModal({
      ...showPropertiesModal,
      x: clampedX,
      y: clampedY
    });
  }, [modalDragging, showPropertiesModal, width, height]);

  const handleModalDragEnd = useCallback(() => {
    setModalDragging(null);
  }, []);

  const handlePointerMove = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      // Handle modal dragging
      if (modalDragging) {
        handleModalDrag(event.clientX, event.clientY);
        return;
      }

      const canvasPoint = getPointerPosition(event);
      if (!canvasPoint) {
        return;
      }

      if (interaction.type === 'panning') {
        panHandlers?.move(interaction.session, canvasPoint.x, canvasPoint.y);
        return;
      }

      const chartPoint = converters.toChart(canvasPoint);
      if (!chartPoint) {
        return;
      }

      if (interaction.type === 'drawing') {
        handleDraftUpdate(chartPoint, event.shiftKey);
        return;
      }

      if (interaction.type === 'moving') {
        const deltaTime = chartPoint.time - interaction.chartStart.time;
        const deltaPrice = chartPoint.price - interaction.chartStart.price;

        // Update the drawing points (start/end for all types)
        updateDrawingPoints(
          interaction.drawingId,
          {
            start: {
              time: interaction.originalStart.time + deltaTime,
              price: interaction.originalStart.price + deltaPrice,
            },
            end: {
              time: interaction.originalEnd.time + deltaTime,
              price: interaction.originalEnd.price + deltaPrice,
            },
          },
          { skipHistory: true }
        );

        // If moving a position, also move entry point and TP/SL levels
        if (interaction.originalEntry !== undefined) {
          // Update entry point using the original entry price
          updatePositionStyle(interaction.drawingId, {
            entry: interaction.originalEntry + deltaPrice,
          });

          // Update TP/SL if they exist
          const updates: { takeProfit?: number; stopLoss?: number } = {};
          if (interaction.originalTakeProfit !== undefined) {
            updates.takeProfit = interaction.originalTakeProfit + deltaPrice;
          }
          if (interaction.originalStopLoss !== undefined) {
            updates.stopLoss = interaction.originalStopLoss + deltaPrice;
          }
          if (Object.keys(updates).length > 0) {
            updatePositionStyle(interaction.drawingId, updates);
          }
        }
        return;
      }

      if (interaction.type === 'resizing') {
        const drawing = drawings.find(d => d.id === interaction.drawingId);

        if (interaction.handle === 'start') {
          updateDrawingPoints(interaction.drawingId, { start: chartPoint }, { skipHistory: true });
          return;
        }

        if (interaction.handle === 'end') {
          updateDrawingPoints(interaction.drawingId, { end: chartPoint }, { skipHistory: true });
          return;
        }

        const positionHandles: PositionHandleType[] = ['takeProfit', 'stopLoss', 'point'];
        if (positionHandles.includes(interaction.handle as PositionHandleType) && drawing && (drawing.type === 'long' || drawing.type === 'short')) {
          const posDrawing = drawing as PositionDrawing;
          // Special logic: right entry handle only resizes horizontally
          if (interaction.handle === 'point' && interaction.side === 'right') {
            // Only update time, keep price fixed
            const newTime = Math.max(chartPoint.time, posDrawing.start.time);
            updateDrawingPoints(interaction.drawingId, {
              end: { ...posDrawing.end, time: newTime }
            }, { skipHistory: true });
          } else {
            const clampedPrice = clampPositionPrice(posDrawing, interaction.handle as PositionHandleType, chartPoint.price);
            if (!hasMinimumVerticalSpacing(posDrawing, interaction.handle as PositionHandleType, clampedPrice, converters)) {
              return;
            }
            if (interaction.handle === 'takeProfit') {
              updatePositionStyle(interaction.drawingId, { takeProfit: clampedPrice });
            } else if (interaction.handle === 'stopLoss') {
              updatePositionStyle(interaction.drawingId, { stopLoss: clampedPrice });
            } else {
              updatePositionStyle(interaction.drawingId, { entry: clampedPrice });
            }
          }
        } else if (interaction.handle === 'takeProfit') {
          updatePositionStyle(interaction.drawingId, { takeProfit: chartPoint.price });
        } else if (interaction.handle === 'stopLoss') {
          updatePositionStyle(interaction.drawingId, { stopLoss: chartPoint.price });
        } else if (interaction.handle === 'point') {
          updatePositionStyle(interaction.drawingId, { entry: chartPoint.price });
        }

        if ((interaction.handle === 'takeProfit' || interaction.handle === 'stopLoss' || interaction.handle === 'point') && interaction.side && drawing && (drawing.type === 'long' || drawing.type === 'short')) {
          const positionDrawing = drawing as PositionDrawing;
          const startPoint = positionDrawing.start;
          const endPoint = positionDrawing.end;
          const endCanvas = converters.toCanvas(endPoint);
          const startCanvas = converters.toCanvas(startPoint);
          const updates: Partial<{ start: ChartPoint; end: ChartPoint }> = {};
          if (interaction.side === 'left') {
            const candidateTime = Math.min(chartPoint.time, positionDrawing.end.time);
            const candidateStart = { ...positionDrawing.start, time: candidateTime };
            const candidateStartCanvas = converters.toCanvas(candidateStart);
            if (candidateStartCanvas && endCanvas && Math.abs(endCanvas.x - candidateStartCanvas.x) < MIN_POSITION_PIXEL_WIDTH) {
              return;
            }
            updates.start = candidateStart;
          } else if (interaction.side === 'right') {
            const candidateTime = Math.max(chartPoint.time, positionDrawing.start.time);
            const candidateEnd = { ...positionDrawing.end, time: candidateTime };
            const candidateEndCanvas = converters.toCanvas(candidateEnd);
            if (candidateEndCanvas && startCanvas && Math.abs(candidateEndCanvas.x - startCanvas.x) < MIN_POSITION_PIXEL_WIDTH) {
              return;
            }
            updates.end = candidateEnd;
          }
          if (Object.keys(updates).length > 0) {
            updateDrawingPoints(interaction.drawingId, updates, { skipHistory: true });
          }
          return;
        }

        if (isRectangleHandle(interaction.handle) && interaction.oppositeCorner && drawing && (drawing.type === 'long' || drawing.type === 'short')) {
          const normalized = normalizeRectanglePoints(chartPoint, interaction.oppositeCorner);
          updateDrawingPoints(interaction.drawingId, normalized, { skipHistory: true });
          return;
        }

        if (isRectangleHandle(interaction.handle) && interaction.oppositeCorner) {
          // Handle middle-left and middle-right specially: horizontal resize only
          if (interaction.handle === 'middle-left' || interaction.handle === 'middle-right') {
            const originalStart = interaction.originalStart;
            const originalEnd = interaction.originalEnd;
            const minPrice = Math.min(originalStart.price, originalEnd.price);
            const maxPrice = Math.max(originalStart.price, originalEnd.price);

            if (interaction.handle === 'middle-left') {
              // Resize left side horizontally only
              const newTime = Math.min(chartPoint.time, interaction.originalEnd.time);
              updateDrawingPoints(interaction.drawingId, {
                start: { time: newTime, price: minPrice },
                end: { time: interaction.originalEnd.time, price: maxPrice }
              }, { skipHistory: true });
            } else {
              // Resize right side horizontally only
              const newTime = Math.max(chartPoint.time, interaction.originalStart.time);
              updateDrawingPoints(interaction.drawingId, {
                start: { time: interaction.originalStart.time, price: minPrice },
                end: { time: newTime, price: maxPrice }
              }, { skipHistory: true });
            }
          } else {
            // Corner handles: normal resize behavior
            const normalized = normalizeRectanglePoints(chartPoint, interaction.oppositeCorner);
            updateDrawingPoints(interaction.drawingId, normalized, { skipHistory: true });
          }
        }
      }
    },
    [converters, handleDraftUpdate, interaction, panHandlers, updateDrawingPoints, updatePositionStyle, modalDragging, handleModalDrag, drawings]
  );

  const handlePointerUp = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      // Handle modal drag end
      if (modalDragging) {
        handleModalDragEnd();
        return;
      }

      if (interaction.type === 'drawing') {
        commitDraft();
      }
      if (interaction.type === 'moving' || interaction.type === 'resizing') {
        updateDrawingPoints(interaction.drawingId, {}, { skipHistory: true });
      }
      if (interaction.type === 'panning') {
        panHandlers?.end();
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setInteraction({ type: 'idle' });
    },
    [commitDraft, interaction, panHandlers, updateDrawingPoints, modalDragging, handleModalDragEnd]
  );

  const handlePointerLeave = useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      if (interaction.type === 'drawing') {
        cancelDraft();
      }
      if (interaction.type === 'panning') {
        panHandlers?.end();
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setInteraction({ type: 'idle' });
    },
    [cancelDraft, interaction, panHandlers]
  );

  return (
    <svg
      ref={overlayRef}
      className="drawing-overlay"
      width={width}
      height={height}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onClick={handleCanvasClick}
      onContextMenu={e => e.preventDefault()}
      style={{ position: 'absolute', left: 0, top: 0, userSelect: 'none' }}
    >
      <defs>
        <filter id="selection-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="rgba(0,0,0,0.35)" />
        </filter>
      </defs>

      {/* Transparent rect to capture pointer events in the main pane area only (excluding axes) */}
      <rect
        x="0"
        y="0"
        width={Math.max(0, width - 60)}
        height={Math.max(0, height - 50)}
        fill="transparent"
        style={{ pointerEvents: 'auto' }}
      />

      {canvasDrawings.map((item) => {
        if (isCanvasRectangle(item)) {
          const drawing = item.drawing as RectangleDrawing;
          const midlineY = item.rect.y + item.rect.height / 2;
          return (
            <g key={drawing.id} filter={selectionId === drawing.id ? 'url(#selection-shadow)' : undefined}>
              <rect
                x={item.rect.x}
                y={item.rect.y}
                width={item.rect.width}
                height={item.rect.height}
                fill={drawing.style.fillColor}
                fillOpacity={drawing.style.opacity}
                stroke={drawing.style.strokeColor}
                strokeOpacity={drawing.style.strokeOpacity ?? 1}
                strokeWidth={drawing.style.lineWidth ?? 1.5}
              />
              {/* Midline rendering */}
              {drawing.midline && (
                <line
                  x1={item.rect.x}
                  y1={midlineY}
                  x2={item.rect.x + item.rect.width}
                  y2={midlineY}
                  stroke={drawing.style.strokeColor}
                  strokeWidth={drawing.style.lineWidth ?? 1.2}
                  strokeDasharray="4 2"
                />
              )}
              {selectionId === drawing.id && (
                (() => {
                  const handlePositions = getRectangleHandlePositions(item.rect);
                  return (
                    <>
                      {RECTANGLE_HANDLES.map((handleKey) => (
                        <circle
                          key={handleKey}
                          cx={handlePositions[handleKey].x}
                          cy={handlePositions[handleKey].y}
                          r={HANDLE_RADIUS}
                          className="handle"
                        />
                      ))}
                    </>
                  );
                })()
              )}
            </g>
          );
        }

        // Handle position rendering
        if (isCanvasPosition(item)) {
          const drawing = item.drawing as PositionDrawing;
          const isLong = drawing.type === 'long';
          const color = isLong ? '#26a69a' : '#ef5350';
          const takeProfitFillColor = drawing.style.takeProfitFillColor ?? '#4caf50';
          const takeProfitFillOpacity = drawing.style.takeProfitFillOpacity ?? 0.15;
          const stopLossFillColor = drawing.style.stopLossFillColor ?? '#f44336';
          const stopLossFillOpacity = drawing.style.stopLossFillOpacity ?? 0.15;

          // Calculate take profit and stop loss coordinates
          const entryY = item.point.y;
          const takeProfitY: number | null = item.takeProfit?.y ?? null;
          const stopLossY: number | null = item.stopLoss?.y ?? null;
          const lineStartX = item.rect.x;
          const lineEndX = item.rect.x + item.rect.width;

          return (
            <g key={drawing.id} filter={selectionId === drawing.id ? 'url(#selection-shadow)' : undefined}>
              {/* Take Profit Rectangle (Reward Zone) */}
              {takeProfitY !== null && (
                <rect
                  x={item.rect.x}
                  y={isLong ? takeProfitY : entryY}
                  width={item.rect.width}
                  height={Math.abs(takeProfitY - entryY)}
                  fill={takeProfitFillColor}
                  fillOpacity={takeProfitFillOpacity}
                  stroke={takeProfitFillColor}
                  strokeWidth={1.5}
                />
              )}

              {/* Stop Loss Rectangle (Risk Zone) */}
              {stopLossY !== null && (
                <rect
                  x={item.rect.x}
                  y={isLong ? entryY : stopLossY}
                  width={item.rect.width}
                  height={Math.abs(stopLossY - entryY)}
                  fill={stopLossFillColor}
                  fillOpacity={stopLossFillOpacity}
                  stroke={stopLossFillColor}
                  strokeWidth={1.5}
                />
              )}

              {/* Entry level line (where TP and SL rectangles meet) */}
              <line
                x1={lineStartX}
                y1={entryY}
                x2={lineEndX}
                y2={entryY}
                stroke={color}
                strokeWidth={2.5}
              />

              {/* Take Profit level line */}
              {takeProfitY !== null && (
                <>
                  <line
                    x1={lineStartX}
                    y1={takeProfitY}
                    x2={lineEndX}
                    y2={takeProfitY}
                    stroke={takeProfitFillColor}
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                  />
                  <text
                    x={item.rect.x + 5}
                    y={takeProfitY - 5}
                    fill={takeProfitFillColor}
                    fontSize="11"
                    fontWeight="bold"
                  >
                    TP: {drawing.takeProfit?.toFixed(5)}
                  </text>
                </>
              )}

              {/* Stop Loss level line */}
              {stopLossY !== null && (
                <>
                  <line
                    x1={lineStartX}
                    y1={stopLossY}
                    x2={lineEndX}
                    y2={stopLossY}
                    stroke={stopLossFillColor}
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                  />
                  <text
                    x={item.rect.x + 5}
                    y={stopLossY + 15}
                    fill={stopLossFillColor}
                    fontSize="11"
                    fontWeight="bold"
                  >
                    SL: {drawing.stopLoss?.toFixed(5)}
                  </text>
                </>
              )}

              {/* Entry label */}
              <text
                x={item.rect.x + 5}
                y={entryY + (isLong ? -5 : 15)}
                fill={color}
                fontSize="12"
                fontWeight="bold"
              >
                {isLong ? 'LONG' : 'SHORT'} Entry: {drawing.point.price.toFixed(5)}
              </text>

              {/* Risk/Reward label on-chart (if enabled) */}
              {drawing.style.showRiskReward && drawing.takeProfit !== undefined && drawing.stopLoss !== undefined && drawing.point.price !== undefined && (
                (() => {
                  const rr = Math.abs((drawing.takeProfit - drawing.point.price)) / Math.abs((drawing.point.price - drawing.stopLoss));
                  if (!Number.isFinite(rr) || rr <= 0) return null;
                  const rrText = `${rr.toFixed(2)}:1`;
                  // Place the R/R label at the right side of the rectangle, near the entry line
                  return (
                    <text
                      x={lineEndX - 6}
                      y={entryY + (isLong ? -5 : 15)}
                      fill={color}
                      fontSize="12"
                      fontWeight="600"
                      textAnchor="end"
                    >
                      R/R {rrText}
                    </text>
                  );
                })()
              )}

              {/* Selection handles - corners like rectangle */}
              {selectionId === drawing.id && (
                (() => {
                  const { left: leftX, right: rightX } = getPositionHandleXs(item.rect);
                  return (
                    <>
                      {/* Take Profit handles (left and right within the TP line) */}
                      {takeProfitY !== null && (
                        <>
                          <circle cx={leftX} cy={takeProfitY} r={HANDLE_RADIUS} className="handle" style={{ fill: takeProfitFillColor }} />
                          <circle cx={rightX} cy={takeProfitY} r={HANDLE_RADIUS} className="handle" style={{ fill: takeProfitFillColor }} />
                        </>
                      )}
                      {/* Stop Loss handles (left and right within the SL line) */}
                      {stopLossY !== null && (
                        <>
                          <circle cx={leftX} cy={stopLossY} r={HANDLE_RADIUS} className="handle" style={{ fill: stopLossFillColor }} />
                          <circle cx={rightX} cy={stopLossY} r={HANDLE_RADIUS} className="handle" style={{ fill: stopLossFillColor }} />
                        </>
                      )}
                      {/* Entry handles (left and right within the entry line) */}
                      <circle cx={leftX} cy={entryY} r={HANDLE_RADIUS} className="handle" style={{ fill: color }} />
                      <circle cx={rightX} cy={entryY} r={HANDLE_RADIUS} className="handle" style={{ fill: color }} />
                    </>
                  );
                })()
              )}
            </g>
          );
        }

        // Handle trendline rendering
        const drawing = item.drawing as TrendlineDrawing;
        const trendlineItem = item as CanvasTrendline;
        return (
          <g key={drawing.id} filter={selectionId === drawing.id ? 'url(#selection-shadow)' : undefined}>
            <line
              x1={trendlineItem.line.x1}
              y1={trendlineItem.line.y1}
              x2={trendlineItem.line.x2}
              y2={trendlineItem.line.y2}
              stroke={drawing.style.strokeColor}
              strokeWidth={drawing.style.lineWidth}
            />
            {selectionId === drawing.id && (
              <>
                <circle cx={trendlineItem.start.x} cy={trendlineItem.start.y} r={HANDLE_RADIUS} className="handle" />
                <circle cx={trendlineItem.end.x} cy={trendlineItem.end.y} r={HANDLE_RADIUS} className="handle" />
              </>
            )}
          </g>
        );
      })}

      {draft && (() => {
        const start = converters.toCanvas(draft.start);
        const end = converters.toCanvas(draft.end);
        if (!start || !end) {
          return null;
        }

        if (draft.type === 'rectangle') {
          const rect = {
            x: Math.min(start.x, end.x),
            y: Math.min(start.y, end.y),
            width: Math.abs(end.x - start.x),
            height: Math.abs(end.y - start.y),
          };
          return (
            <rect
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              fill="rgba(41, 98, 255, 0.18)"
              stroke="#2962ff"
              strokeWidth={1.5}
              strokeDasharray="6 3"
            />
          );
        }

        if (draft.type === 'long' || draft.type === 'short') {
          const isLong = draft.type === 'long';
          const color = isLong ? '#26a69a' : '#ef5350';

          const rect = {
            x: Math.min(start.x, end.x),
            y: Math.min(start.y, end.y),
            width: Math.abs(end.x - start.x),
            height: Math.abs(end.y - start.y),
          };

          // Calculate preview entry, TP, and SL levels
          const topPrice = Math.max(draft.start.price, draft.end.price);
          const bottomPrice = Math.min(draft.start.price, draft.end.price);
          const entryPrice = isLong ? bottomPrice : topPrice;
          const takeProfitPrice = isLong ? topPrice : bottomPrice;
          const reward = Math.abs(takeProfitPrice - entryPrice);
          const stopLossPrice = isLong ? entryPrice - (reward / 2) : entryPrice + (reward / 2);

          // Convert to canvas coordinates
          const entryCanvas = converters.toCanvas({ time: draft.start.time, price: entryPrice });
          const tpCanvas = converters.toCanvas({ time: draft.start.time, price: takeProfitPrice });
          const slCanvas = converters.toCanvas({ time: draft.start.time, price: stopLossPrice });

          return (
            <g>
              {/* Take Profit Rectangle Preview (Reward Zone) */}
              {tpCanvas && entryCanvas && (
                <rect
                  x={rect.x}
                  y={isLong ? tpCanvas.y : entryCanvas.y}
                  width={rect.width}
                  height={Math.abs(tpCanvas.y - entryCanvas.y)}
                  fill="#4caf50"
                  fillOpacity={0.15}
                  stroke="#4caf50"
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                />
              )}

              {/* Stop Loss Rectangle Preview (Risk Zone) */}
              {slCanvas && entryCanvas && (
                <rect
                  x={rect.x}
                  y={isLong ? entryCanvas.y : slCanvas.y}
                  width={rect.width}
                  height={Math.abs(slCanvas.y - entryCanvas.y)}
                  fill="#f44336"
                  fillOpacity={0.15}
                  stroke="#f44336"
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                />
              )}

              {/* Entry level line (where TP and SL rectangles meet) */}
              {entryCanvas && (
                <line
                  x1={rect.x}
                  y1={entryCanvas.y}
                  x2={rect.x + rect.width}
                  y2={entryCanvas.y}
                  stroke={color}
                  strokeWidth={2.5}
                  strokeDasharray="6 3"
                />
              )}

              {/* Take Profit line */}
              {tpCanvas && (
                <line
                  x1={rect.x}
                  y1={tpCanvas.y}
                  x2={rect.x + rect.width}
                  y2={tpCanvas.y}
                  stroke="#4caf50"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  opacity={0.7}
                />
              )}

              {/* Stop Loss line */}
              {slCanvas && (
                <line
                  x1={rect.x}
                  y1={slCanvas.y}
                  x2={rect.x + rect.width}
                  y2={slCanvas.y}
                  stroke="#f44336"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  opacity={0.7}
                />
              )}
            </g>
          );
        }

        return (
          <line
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke="#26a69a"
            strokeWidth={2}
            strokeDasharray="6 3"
          />
        );
      })()}

      {/* Context Menu */}
      {contextMenu && (
        <g style={{ pointerEvents: 'auto' }}>
          <foreignObject
            x={Math.max(0, Math.min(width - 130, contextMenu.x))}
            y={Math.max(0, Math.min(height - 60, contextMenu.y))}
            width={130}
            height={60}
            style={{ overflow: 'visible' }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                background: 'var(--color-panel)',
                color: 'var(--color-text)',
                borderRadius: '4px',
                boxShadow: '0 2px 8px rgba(15, 23, 42, 0.25)',
                padding: '4px',
                width: '120px',
                border: '1px solid var(--color-border-strong)',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                pointerEvents: 'auto'
              }}
            >
              <div
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleContextMenuAction('properties');
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-button-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--color-panel)';
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--color-panel)',
                  color: 'var(--color-text)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  userSelect: 'none'
                }}
              >
                Properties
              </div>
            </div>
          </foreignObject>
        </g>
      )}

      {/* Properties Modal */}
      {showPropertiesModal && (
        <foreignObject
          x={showPropertiesModal.x}
          y={showPropertiesModal.y}
          width={300}
          height={400}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{
            background: 'var(--color-panel)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-accent)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(15, 23, 42, 0.35)',
            padding: 16,
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            pointerEvents: 'auto'
          }}>
            <PropertiesPanelModal
              drawingId={showPropertiesModal.drawingId}
              onClose={handleCloseModal}
              onDragStart={handleModalDragStart}
            />
          </div>
        </foreignObject>
      )}
    </svg>
  );
};

export default DrawingOverlay;