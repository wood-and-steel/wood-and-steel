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

/** An open sheet: its content, and the element last focused inside it. */
interface OpenSheet {
  content: HTMLDivElement | null;
  lastFocus: HTMLElement | null;
}

/** Open sheets, bottom to top. Loans can open over another sheet; only the top one is live. */
const openSheets: OpenSheet[] = [];

/**
 * The element outside any sheet that opened the bottom sheet (or chain of sheets, as Actions
 * steps into its sub-sheets), so focus can go back to it when the last sheet closes.
 */
let opener: HTMLElement | null = null;

/**
 * A dialog over the game for one task (loans, actions, a delivery). Closes on the Close
 * button, a backdrop click, or Escape. Rendered into document.body: the game page is one big
 * form, and pressing Enter in a field inside it would submit the form with its first submit
 * button (+M or End Turn). Focus moves into the sheet when it opens, Tab stays inside it, and
 * focus returns to whatever opened it when it closes, so the game behind can't be changed
 * from the keyboard while it's open.
 *
 * Sheets stack: one opened over another (Loans, from the money strip or a "borrow first"
 * message) covers it, Escape closes only the top one, and closing it puts focus back where it
 * was in the sheet underneath.
 */
export function Sheet({ title, onClose, onBack, children }: SheetProps): React.ReactElement {
  const titleId = React.useId();
  const contentRef = React.useRef<HTMLDivElement>(null);
  const self = React.useRef<OpenSheet>({ content: null, lastFocus: null });
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    // Capture phase, and stop there: a dialog under the top sheet (the private contract offers)
    // listens for Escape too, and must not close with it.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || openSheets[openSheets.length - 1] !== self.current) return;
      event.stopPropagation();
      onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);

  React.useEffect(() => {
    const sheet = self.current;
    sheet.content = contentRef.current;
    const active = document.activeElement;
    // A sheet that replaces another (the next step of a task) mounts with focus on the body and
    // keeps the chain's opener; one opened over another sheet leaves it alone too.
    if (openSheets.length === 0 && active instanceof HTMLElement && active !== document.body && !active.closest(".sheet")) {
      opener = active;
    }
    openSheets.push(sheet);
    contentRef.current?.focus();
    return () => {
      openSheets.splice(openSheets.indexOf(sheet), 1);
      // Let a following sheet (the next step of the same task) mount before deciding.
      setTimeout(() => {
        const top = openSheets[openSheets.length - 1];
        if (top) {
          if (!top.content?.contains(document.activeElement)) {
            (top.lastFocus?.isConnected ? top.lastFocus : top.content)?.focus();
          }
          return;
        }
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
      <div
        className="modal__content sheet"
        ref={contentRef}
        tabIndex={-1}
        onKeyDown={trapTab}
        onFocus={(event) => {
          if (event.target instanceof HTMLElement) self.current.lastFocus = event.target;
        }}
      >
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

export interface RadioOptionProps {
  /** Shared by every option in the group, so arrow keys move between them. */
  name: string;
  checked: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}

/** One choice in a sheet's radio group: a native radio (arrow keys, screen readers) styled as a row. */
export function RadioOption({ name, checked, onSelect, children }: RadioOptionProps): React.ReactElement {
  return (
    <label className={`sheet__option sheet__option--radio${checked ? " sheet__option--selected" : ""}`}>
      <input type="radio" className="sheet__radio" name={name} checked={checked} onChange={onSelect} />
      <span className="sheet__optionText">{children}</span>
    </label>
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

export interface ShortOfCashProps {
  /** What's short, e.g. "$4K short". */
  children: React.ReactNode;
  /** Opens Loans over this sheet; the button is left out without it. */
  onOpenLoans?: () => void;
  /** Announce the message when it appears (a refused action), rather than as part of a list. */
  alert?: boolean;
}

/**
 * A "not enough cash" message with a Loans button beside it. Loans opens over this sheet, and
 * closing it comes back here with the new cash. The money strip has a Loans button too, but
 * keyboard and screen reader users can't reach it while a sheet is open.
 */
export function ShortOfCash({ children, onOpenLoans, alert }: ShortOfCashProps): React.ReactElement {
  return (
    <span className="sheet__shortOfCash">
      <span className="sheet__warning" role={alert ? "alert" : undefined}>
        {children}
      </span>
      {onOpenLoans && (
        <button type="button" className="button" onClick={onOpenLoans}>
          Loans
        </button>
      )}
    </span>
  );
}
