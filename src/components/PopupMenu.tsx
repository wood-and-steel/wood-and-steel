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

/** The menu's items that can take focus, in order. */
function menuItems(menu: HTMLElement | null): HTMLElement[] {
  return menu ? Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])')) : [];
}

/**
 * Popup menu component that positions itself relative to an anchor element.
 * Keyboard: focus moves to the first item when it opens; Arrow Up/Down, Home and End move
 * between items; Escape or Tab closes it; focus returns to what opened it when it closes.
 * Closes on a click outside.
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
  const openerRef = React.useRef<HTMLElement | null>(null);
  const placed = position !== null;

  // Place the menu through custom properties set from a ref (no inline styles; see
  // docs/CSS_ARCHITECTURE.md). It stays hidden until it has been measured and placed.
  React.useLayoutEffect(() => {
    if (!position) return;
    menuRef.current?.style.setProperty("--popup-menu-top", `${position.top}px`);
    menuRef.current?.style.setProperty("--popup-menu-left", `${position.left}px`);
  }, [position]);

  // Remember what had focus when the menu opened, and give it back when the menu closes
  // (unless something else, such as a sheet the item opened, has taken focus since).
  React.useEffect(() => {
    if (!isOpen) return;
    const active = document.activeElement;
    openerRef.current = active instanceof HTMLElement ? active : null;
    return () => {
      const opener = openerRef.current;
      const focus = document.activeElement;
      if (opener?.isConnected && (!focus || focus === document.body)) opener.focus();
    };
  }, [isOpen]);

  // Focus the first item on opening, and again once the menu is placed: a browser won't
  // focus it while it's still hidden for measuring.
  React.useEffect(() => {
    if (!isOpen || menuRef.current?.contains(document.activeElement)) return;
    menuItems(menuRef.current)[0]?.focus();
  }, [isOpen, placed]);

  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = menuItems(menuRef.current);
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (e.key === "ArrowDown") next = index < 0 ? 0 : (index + 1) % items.length;
    else if (e.key === "ArrowUp") next = index <= 0 ? items.length - 1 : index - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else if (e.key === "Tab") {
      onClose();
      return;
    }
    if (next !== null) {
      e.preventDefault();
      items[next].focus();
    }
  };

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
      className={`popupMenu${placed ? "" : " popupMenu--unplaced"}`}
      role="menu"
      onKeyDown={handleMenuKeyDown}
    >
      {children}
    </div>
  );

  return ReactDOM.createPortal(menu, document.body);
}

export interface PopupMenuItemProps {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  children: React.ReactNode;
  [key: string]: unknown;
}

/**
 * Individual menu item within a PopupMenu.
 */
export function PopupMenuItem({ onClick, disabled, children, ...rest }: PopupMenuItemProps): React.ReactElement {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (disabled) return;
    onClick?.(e);
  };
  return (
    <button
      type="button"
      className="popupMenu__item"
      role="menuitem"
      disabled={disabled}
      onClick={handleClick}
      {...rest}
    >
      {children}
    </button>
  );
}
