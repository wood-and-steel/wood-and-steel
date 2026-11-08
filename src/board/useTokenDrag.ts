/**
 * Drag engines and Railyards between the map and the player trays with pointer events
 * (HTML drag-and-drop doesn't work on SVG elements). While dragging, the drop target is:
 * - a city: the nearest city within SNAP_SCREEN_PX of the pointer, or
 * - the tray: the tray strip, or anywhere off the map (returns the token to its tray), or
 * - none: on the map but away from every city (the drop is cancelled).
 */
import React from 'react';
import { BOARD_WIDTH } from './geometry/cityPoints';
import { nearestCity, type TokenRef } from './tokens';

/** How close (screen pixels from a city circle's edge) a drop must be to snap to it. */
export const SNAP_SCREEN_PX = 28;

export type DropTarget = { kind: 'city'; city: string } | { kind: 'tray' } | { kind: 'none' };

export interface TokenDragState {
  token: TokenRef;
  clientX: number;
  clientY: number;
  target: DropTarget;
}

export interface TokenDrag {
  drag: TokenDragState | null;
  startDrag: (token: TokenRef, event: React.PointerEvent<Element>) => void;
}

const TRAY_SELECTOR = '[data-token-drop="tray"]';

export function useTokenDrag(
  viewportRef: React.RefObject<HTMLElement>,
  onDrop: (token: TokenRef, city: string | null) => void
): TokenDrag {
  const [drag, setDrag] = React.useState<TokenDragState | null>(null);
  const dragRef = React.useRef<TokenDragState | null>(null);
  dragRef.current = drag;
  const onDropRef = React.useRef(onDrop);
  onDropRef.current = onDrop;

  const locate = React.useCallback(
    (clientX: number, clientY: number): DropTarget => {
      const under = typeof document.elementFromPoint === 'function' ? document.elementFromPoint(clientX, clientY) : null;
      if (under?.closest(TRAY_SELECTOR)) return { kind: 'tray' };
      const viewport = viewportRef.current;
      const svg = viewport?.querySelector('svg');
      if (!viewport || !svg) return { kind: 'tray' };
      const view = viewport.getBoundingClientRect();
      const map = svg.getBoundingClientRect();
      const inside = (r: DOMRect) => clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
      if (!inside(view) || !inside(map) || map.width <= 0) return { kind: 'tray' };
      const scale = BOARD_WIDTH / map.width;
      const point = { x: (clientX - map.left) * scale, y: (clientY - map.top) * scale };
      const city = nearestCity(point, SNAP_SCREEN_PX * scale);
      return city ? { kind: 'city', city } : { kind: 'none' };
    },
    [viewportRef]
  );

  const startDrag = React.useCallback(
    (token: TokenRef, event: React.PointerEvent<Element>) => {
      if (event.button !== 0) return;
      // Keep the map from panning and the browser from selecting text.
      event.stopPropagation();
      event.preventDefault();
      setDrag({ token, clientX: event.clientX, clientY: event.clientY, target: locate(event.clientX, event.clientY) });
    },
    [locate]
  );

  const dragging = drag !== null;
  React.useEffect(() => {
    if (!dragging) return;
    const onMove = (event: PointerEvent) => {
      const target = locate(event.clientX, event.clientY);
      setDrag((d: TokenDragState | null) => d && { ...d, clientX: event.clientX, clientY: event.clientY, target });
    };
    const onUp = (event: PointerEvent) => {
      const current = dragRef.current;
      setDrag(null);
      if (!current) return;
      const target = locate(event.clientX, event.clientY);
      if (target.kind === 'city') onDropRef.current(current.token, target.city);
      else if (target.kind === 'tray') onDropRef.current(current.token, null);
    };
    const cancel = () => setDrag(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', onKey);
    };
  }, [dragging, locate]);

  return { drag, startDrag };
}
