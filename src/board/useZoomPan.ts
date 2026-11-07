/**
 * Zoom and pan for the board map. The map lives in a scrolling viewport; zoom 1 fits the
 * viewport width. Zoom sets the SVG's size (keeping the point under the cursor fixed),
 * and dragging the map scrolls the viewport.
 */
import React from 'react';
import { BOARD_HEIGHT, BOARD_WIDTH } from './geometry/cityPoints';

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 4;
const BUTTON_STEP = 1.25;
const WHEEL_SENSITIVITY = 0.0015;
/** Pointer travel (px) before a press becomes a pan rather than a click. */
const PAN_THRESHOLD = 4;

interface PanStart {
  pointerId: number;
  clientX: number;
  clientY: number;
  scrollLeft: number;
  scrollTop: number;
  moved: boolean;
}

export interface ZoomPan {
  zoom: number;
  width: number;
  height: number;
  isPanning: boolean;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  panHandlers: {
    onPointerDown: (event: React.PointerEvent<Element>) => void;
    onPointerMove: (event: React.PointerEvent<Element>) => void;
    onPointerUp: (event: React.PointerEvent<Element>) => void;
    onPointerCancel: (event: React.PointerEvent<Element>) => void;
  };
}

const clampZoom = (z: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export function useZoomPan(viewportRef: React.RefObject<HTMLElement>): ZoomPan {
  const [viewportWidth, setViewportWidth] = React.useState(0);
  const [zoom, setZoom] = React.useState(1);
  const [isPanning, setIsPanning] = React.useState(false);
  const zoomRef = React.useRef(1);
  const pendingScroll = React.useRef<{ left: number; top: number } | null>(null);
  const panStart = React.useRef<PanStart | null>(null);

  // Track the viewport width (excluding scrollbars) for fit-to-width.
  React.useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setViewportWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [viewportRef]);

  // Apply the scroll position computed by zoomBy once the SVG has its new size.
  React.useLayoutEffect(() => {
    const el = viewportRef.current;
    const target = pendingScroll.current;
    if (!el || !target) return;
    pendingScroll.current = null;
    el.scrollLeft = target.left;
    el.scrollTop = target.top;
  }, [zoom, viewportRef]);

  /** Multiply zoom by factor, keeping the point under (clientX, clientY) (default: viewport center) fixed. */
  const zoomBy = React.useCallback(
    (factor: number, clientX?: number, clientY?: number) => {
      const el = viewportRef.current;
      const current = zoomRef.current;
      const next = clampZoom(current * factor);
      if (!el || next === current) return;
      const rect = el.getBoundingClientRect();
      const ax = clientX !== undefined ? clientX - rect.left : el.clientWidth / 2;
      const ay = clientY !== undefined ? clientY - rect.top : el.clientHeight / 2;
      const k = next / current;
      pendingScroll.current = {
        left: (el.scrollLeft + ax) * k - ax,
        top: (el.scrollTop + ay) * k - ay,
      };
      zoomRef.current = next;
      setZoom(next);
    },
    [viewportRef]
  );

  // Ctrl/Cmd + wheel (and trackpad pinch) zooms; plain wheel scrolls. Needs a non-passive listener.
  React.useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoomBy(Math.exp(-event.deltaY * WHEEL_SENSITIVITY), event.clientX, event.clientY);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [viewportRef, zoomBy]);

  const reset = React.useCallback(() => {
    const el = viewportRef.current;
    if (zoomRef.current === 1) {
      // No re-render will happen, so scroll now.
      el?.scrollTo(0, 0);
      return;
    }
    pendingScroll.current = { left: 0, top: 0 };
    zoomRef.current = 1;
    setZoom(1);
  }, [viewportRef]);

  const endPan = (event: React.PointerEvent<Element>) => {
    if (panStart.current?.pointerId !== event.pointerId) return;
    panStart.current = null;
    setIsPanning(false);
  };

  const panHandlers: ZoomPan['panHandlers'] = {
    onPointerDown: (event) => {
      const el = viewportRef.current;
      if (!el || event.button !== 0) return;
      panStart.current = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        scrollLeft: el.scrollLeft,
        scrollTop: el.scrollTop,
        moved: false,
      };
    },
    onPointerMove: (event) => {
      const el = viewportRef.current;
      const start = panStart.current;
      if (!el || !start || start.pointerId !== event.pointerId) return;
      const dx = event.clientX - start.clientX;
      const dy = event.clientY - start.clientY;
      if (!start.moved) {
        if (Math.hypot(dx, dy) < PAN_THRESHOLD) return;
        start.moved = true;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setIsPanning(true);
      }
      el.scrollLeft = start.scrollLeft - dx;
      el.scrollTop = start.scrollTop - dy;
    },
    onPointerUp: endPan,
    onPointerCancel: endPan,
  };

  const width = viewportWidth * zoom;
  const height = (width * BOARD_HEIGHT) / BOARD_WIDTH;

  return {
    zoom,
    width,
    height,
    isPanning,
    zoomIn: () => zoomBy(BUTTON_STEP),
    zoomOut: () => zoomBy(1 / BUTTON_STEP),
    reset,
    panHandlers,
  };
}
