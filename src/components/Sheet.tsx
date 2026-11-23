import React from "react";
import ReactDOM from "react-dom";

export interface SheetProps {
  title: string;
  onClose: () => void;
  /** Shown left of the title, e.g. a Back button inside a multi-step sheet. */
  onBack?: () => void;
  children: React.ReactNode;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The element that opened the current sheet (or chain of sheets, as Actions steps into its
 * sub-sheets), so focus can go back to it when the last sheet closes.
 */
let opener: HTMLElement | null = null;

/**
 * A dialog over the game for one task (loans, actions, a delivery). Closes on the Close
 * button, a backdrop click, or Escape. Rendered into document.body: the game page is one big
 * form, and pressing Enter in a field inside it would submit the form with its first submit
 * button (+M or End Turn). Focus moves into the sheet when it opens, Tab stays inside it, and
 * focus returns to whatever opened it when it closes, so the game behind can't be changed
 * from the keyboard while it's open.
 */
export function Sheet({ title, onClose, onBack, children }: SheetProps): React.ReactElement {
  const titleId = React.useId();
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  React.useEffect(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && !active.closest(".sheet")) opener = active;
    contentRef.current?.focus();
    return () => {
      // Let a following sheet (the next step of the same task) mount before deciding.
      setTimeout(() => {
        if (document.querySelector(".sheet")) return;
        if (opener?.isConnected) opener.focus();
        opener = null;
      }, 0);
    };
  }, []);

  /** Tab and Shift+Tab cycle through the sheet's own controls. */
  const trapTab = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !contentRef.current) return;
    const focusable: HTMLElement[] = Array.from(contentRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === contentRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return ReactDOM.createPortal(
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal__content sheet" ref={contentRef} tabIndex={-1} onKeyDown={trapTab}>
        <div className="sheet__header">
          {onBack && (
            <button type="button" className="sheet__back" onClick={onBack}>
              Back
            </button>
          )}
          <h2 className="sheet__title" id={titleId}>
            {title}
          </h2>
          <button type="button" className="sheet__close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

/** "Cash $14K → $4K": a value before and after the sheet's action. */
export function BeforeAfter({ label, before, after }: { label: string; before: string; after: string }): React.ReactElement {
  return (
    <div className="sheet__row">
      <span className="sheet__label">{label}</span>
      <span>
        {before === after ? (
          before
        ) : (
          <>
            {before} → <strong>{after}</strong>
          </>
        )}
      </span>
    </div>
  );
}
