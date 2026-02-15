import React from "react";
import { createPortal } from "react-dom";

const GAP = 4;

function getAnchorRect(anchorRef) {
  const refs = Array.isArray(anchorRef) ? anchorRef : [anchorRef];
  for (const r of refs) {
    const el = r?.current;
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return rect;
  }
  return null;
}

function useMenuPosition(anchorRef, placement, menuRef, isOpen) {
  const [position, setPosition] = React.useState(null);

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

    let top;
    let left;

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
  }, [isOpen, anchorRef, side, align]);

  return position;
}

/**
 * Popup menu component that positions itself relative to an anchor element.
 * Supports keyboard navigation (Escape to close) and click-outside-to-close behavior.
 * 
 * @component
 * @param {object} props
 * @param {boolean} props.isOpen - Whether the menu is currently open.
 * @param {function} props.onClose - Called when the menu should be closed.
 * @param {function} [props.onCloseOutside] - Optional callback called when clicking outside the menu (before onClose).
 * @param {React.RefObject|Array<React.RefObject>} props.anchorRef - Reference(s) to the anchor element(s) that the menu positions relative to.
 * @param {object} [props.placement] - Placement configuration object.
 * @param {'top'|'bottom'} [props.placement.side='bottom'] - Which side of the anchor to place the menu.
 * @param {'start'|'center'|'end'} [props.placement.align='center'] - How to align the menu relative to the anchor.
 * @param {React.ReactNode} props.children - Menu items to render (typically PopupMenuItem components).
 * 
 * @example
 * <PopupMenu
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onCloseOutside={handleCloseOutside}
 *   anchorRef={buttonRef}
 *   placement={{ side: "bottom", align: "start" }}
 * >
 *   <PopupMenuItem onClick={handleAction1}>Action 1</PopupMenuItem>
 *   <PopupMenuItem onClick={handleAction2}>Action 2</PopupMenuItem>
 * </PopupMenu>
 */
export function PopupMenu({
  isOpen,
  onClose,
  onCloseOutside,
  anchorRef,
  placement = { side: "bottom", align: "center" },
  children,
}) {
  const menuRef = React.useRef(null);
  const position = useMenuPosition(anchorRef, placement, menuRef, isOpen);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e) => {
      const target = e.target;
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

  return createPortal(menu, document.body);
}

/**
 * Individual menu item within a PopupMenu.
 * 
 * @component
 * @param {object} props
 * @param {function} [props.onClick] - Called when the menu item is clicked.
 * @param {React.ReactNode} props.children - The content to display in the menu item.
 * @param {any} [props.rest] - Additional props are spread to the underlying button element.
 * 
 * @example
 * <PopupMenuItem onClick={() => handleAction()}>
 *   Delete Item
 * </PopupMenuItem>
 */
export function PopupMenuItem({ onClick, children, ...rest }) {
  const handleClick = (e) => {
    e.preventDefault();
    onClick?.(e);
  };
  return (
    <button type="button" className="popupMenu__item" role="menuitem" onClick={handleClick} {...rest}>
      {children}
    </button>
  );
}
