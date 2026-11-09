/**
 * Shared popover behavior: place it next to an anchor point, kept inside the window (through
 * --board-popover-left/top, set from a ref), and close it on Escape or a press outside.
 * A press on an element with `data-popover-trigger` doesn't close it, so that element's own
 * click can toggle the popover or switch it to another target.
 */
import React from 'react';

const EDGE_MARGIN = 8;
const ANCHOR_GAP = 12;

/** Returns true once placed; keep the popover hidden until then. */
export function useBoardPopover(
  ref: React.RefObject<HTMLElement>,
  clientX: number,
  clientY: number,
  onClose: () => void
): boolean {
  const [placed, setPlaced] = React.useState(false);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let left = clientX + ANCHOR_GAP;
    let top = clientY + ANCHOR_GAP;
    if (left + rect.width > window.innerWidth - EDGE_MARGIN) left = clientX - ANCHOR_GAP - rect.width;
    if (top + rect.height > window.innerHeight - EDGE_MARGIN) top = clientY - ANCHOR_GAP - rect.height;
    el.style.setProperty('--board-popover-left', `${Math.max(EDGE_MARGIN, left)}px`);
    el.style.setProperty('--board-popover-top', `${Math.max(EDGE_MARGIN, top)}px`);
    setPlaced(true);
  }, [ref, clientX, clientY]);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element;
      if (!ref.current?.contains(target) && !target.closest?.('[data-popover-trigger]')) onClose();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [ref, onClose]);

  return placed;
}
