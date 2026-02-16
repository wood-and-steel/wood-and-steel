import React from "react";
import ReactDOM from "react-dom";

const GAP = 4;

function getAnchorRect(
  anchorRef: React.RefObject<HTMLElement | null> | React.RefObject<HTMLElement | null>[]
): DOMRect | null {
  const refs = Array.isArray(anchorRef) ? anchorRef : [anchorRef];
  for (const r of refs) {
    const el = r?.current;
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return rect;
  }
  return null;
}

export interface PopupMenuPlacement {
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
}

function useMenuPosition(
  anchorRef: React.RefObject<HTMLElement | null> | React.RefObject<HTMLElement | null>[],
  placement: PopupMenuPlacement | undefined,
  menuRef: React.RefObject<HTMLDivElement | null>,
  isOpen: boolean
): { top: number; left: number } | null {
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);

  const side = placement?.side ?? "bottom";
  const align = placement?.align ?? "center";

  React.useLayoutEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }
    if (!menuRef.current) return;
    const anchorRect = getAnchorRect(anchorRef);
    if (!anchorRect) return;

    const menuRect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top: number;
    let left: number;

    if (side === "bottom") {
      top = anchorRect.bottom + GAP;
      left =
        align === "start"
          ? anchorRect.left
          : align === "end"
            ? anchorRect.right - menuRect.width
            : anchorRect.left + (anchorRect.width - menuRect.width) / 2;
    } else {
      top = anchorRect.top - menuRect.height - GAP;
      left =
        align === "start"
          ? anchorRect.left
          : align === "end"
            ? anchorRect.right - menuRect.width
            : anchorRect.left + (anchorRect.width - menuRect.width) / 2;
    }

    if (left + menuRect.width > vw) left = vw - menuRect.width;
    if (left < 0) left = 0;
    if (top + menuRect.height > vh) top = vh - menuRect.height;
    if (top < 0) top = 0;

    setPosition({ top, left });
  }, [isOpen, anchorRef, side, align, menuRef]);

  return position;
}

export interface PopupMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onCloseOutside?: () => void;
  anchorRef: React.RefObject<HTMLElement | null> | React.RefObject<HTMLElement | null>[];
  placement?: PopupMenuPlacement;
  children: React.ReactNode;
}

/**
 * Popup menu component that positions itself relative to an anchor element.
 * Supports keyboard navigation (Escape to close) and click-outside-to-close behavior.
 */
export function PopupMenu({
  isOpen,
  onClose,
  onCloseOutside,
  anchorRef,
  placement = { side: "bottom", align: "center" },
  children,
}: PopupMenuProps): React.ReactElement | null {
  const menuRef = React.useRef<HTMLDivElement>(null);
  const position = useMenuPosition(anchorRef, placement, menuRef, isOpen);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const inMenu = menuRef.current?.contains(target);
      const refs = Array.isArray(anchorRef) ? anchorRef : [anchorRef];
      const inAnchor = refs.some((r) => r?.current?.contains(target));
      if (!inMenu && !inAnchor) {
        onCloseOutside?.();
        onClose();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isOpen, onClose, onCloseOutside, anchorRef]);

  if (!isOpen) return null;

  const menu = (
    <div
      ref={menuRef}
      className="popupMenu"
      role="menu"
      style={
        position
          ? { position: "fixed", top: position.top, left: position.left, visibility: "visible" }
          : { position: "fixed", top: 0, left: 0, visibility: "hidden" }
      }
    >
      {children}
    </div>
  );

  return ReactDOM.createPortal(menu, document.body);
}

export interface PopupMenuItemProps {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
  [key: string]: unknown;
}

/**
 * Individual menu item within a PopupMenu.
 */
export function PopupMenuItem({ onClick, children, ...rest }: PopupMenuItemProps): React.ReactElement {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onClick?.(e);
  };
  return (
    <button
      type="button"
      className="popupMenu__item"
      role="menuitem"
      onClick={handleClick}
      {...rest}
    >
      {children}
    </button>
  );
}
