import React from "react";
import ReactDOM from "react-dom";
import { formatMoney } from "../utils/money";

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
 * Regions outside any sheet that stay live while one is open: the money strip, so keyboard and
 * screen reader users can read their money and reach Loans without closing the sheet.
 */
const SHEET_REACHABLE = "[data-sheet-reachable]";

/** An open sheet: its dialog, its content, and the element last focused inside it. */
interface OpenSheet {
  dialog: HTMLDivElement | null;
  content: HTMLDivElement | null;
  lastFocus: HTMLElement | null;
}

/** Open sheets, bottom to top. Loans can open over another sheet; only the top one is live. */
const openSheets: OpenSheet[] = [];

/** Elements this module made inert, so it un-inerts only those. */
const inerted = new Set<Element>();

/**
 * Makes everything but the top sheet and the reachable regions (the money strip) inert, so
 * neither keyboard nor screen reader can reach the game behind or a sheet underneath. This
 * stands in for aria-modal, which would hide the money strip from screen readers too.
 */
function updateBackground(): void {
  inerted.forEach((el) => el.removeAttribute("inert"));
  inerted.clear();
  const top = openSheets[openSheets.length - 1];
  if (!top?.dialog) return;
  const keep = [
    top.dialog,
    ...Array.from(document.querySelectorAll(SHEET_REACHABLE)).filter((el) => !el.closest(".modal")),
  ];
  const hideOthers = (parent: Element) => {
    for (const child of Array.from(parent.children)) {
      if (keep.includes(child)) continue;
      if (keep.some((el) => child.contains(el))) {
        hideOthers(child);
      } else if (!child.hasAttribute("inert")) {
        child.setAttribute("inert", "");
        inerted.add(child);
      }
    }
  };
  hideOthers(document.body);
}

/**
 * The element outside any sheet that opened the bottom sheet (or chain of sheets, as Actions
 * steps into its sub-sheets), so focus can go back to it when the last sheet closes.
 */
let opener: HTMLElement | null = null;

/**
 * A dialog over the game for one task (loans, actions, a delivery). Closes on the Close
 * button, a backdrop click, or Escape. Rendered into document.body: the game page is one big
 * form, and pressing Enter in a field inside it would submit the form with its first submit
 * button (+M or End Turn). Focus moves into the sheet when it opens, Tab stays inside it (plus
 * the money strip's Loans button), everything else behind it is inert, and focus returns to
 * whatever opened it when it closes, so the game behind can't be changed while it's open.
 *
 * Sheets stack: one opened over another (Loans, from the money strip) covers it, Escape closes
 * only the top one, and closing it puts focus back where it was in the sheet underneath.
 */
export function Sheet({ title, onClose, onBack, children }: SheetProps): React.ReactElement {
  const titleId = React.useId();
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const self = React.useRef<OpenSheet>({ dialog: null, content: null, lastFocus: null });
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    // On the document, so Tab works from the money strip's Loans button too. Capture phase, and
    // stop there, so Escape closes only the top sheet and not a dialog underneath.
    const onKeyDown = (event: KeyboardEvent) => {
      if (openSheets[openSheets.length - 1] !== self.current) return;
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
      } else if (event.key === "Tab") {
        cycleFocus(event, self.current.content);
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);

  React.useEffect(() => {
    const sheet = self.current;
    sheet.dialog = dialogRef.current;
    sheet.content = contentRef.current;
    const active = document.activeElement;
    // A sheet that replaces another (the next step of a task) mounts with focus on the body and
    // keeps the chain's opener; one opened over another sheet leaves it alone too.
    if (openSheets.length === 0 && active instanceof HTMLElement && active !== document.body && !active.closest(".sheet")) {
      opener = active;
    }
    openSheets.push(sheet);
    updateBackground();
    // A field the sheet is for (Pay for track's amount) takes focus; otherwise the sheet itself.
    (contentRef.current?.querySelector<HTMLElement>("[data-autofocus]") ?? contentRef.current)?.focus();
    return () => {
      openSheets.splice(openSheets.indexOf(sheet), 1);
      updateBackground();
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

  return ReactDOM.createPortal(
    <div
      className="modal modal--sheet"
      ref={dialogRef}
      role="dialog"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal__content sheet"
        ref={contentRef}
        tabIndex={-1}
        onFocus={(event) => {
          if (event.target instanceof HTMLElement) self.current.lastFocus = event.target;
        }}
      >
        <div className="sheet__header">
          {onBack && (
            <button type="button" className="sheet__iconButton" aria-label="Back" onClick={onBack}>
              <svg className="sheet__icon" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M10.5 2.5 5 8l5.5 5.5" />
              </svg>
            </button>
          )}
          <h2 className="sheet__title" id={titleId}>
            {title}
          </h2>
          <button type="button" className="sheet__iconButton" aria-label="Close" onClick={onClose}>
            <svg className="sheet__icon" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 3l10 10M13 3 3 13" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

/**
 * Tab and Shift+Tab cycle through the sheet's own controls, then the controls in the regions
 * outside it that stay reachable (the money strip's Loans button), then back to the sheet's
 * first control. A radio group is one stop, as natively: its focused, checked or first option;
 * arrow keys move within it.
 */
function cycleFocus(event: KeyboardEvent, content: HTMLDivElement | null): void {
  if (!content) return;
  event.preventDefault();
  const reachable = Array.from(document.querySelectorAll(SHEET_REACHABLE)).filter((el) => !el.closest(".modal"));
  const candidates = [content, ...reachable]
    .flatMap((root) => Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)))
    .filter((el) => !el.closest("[inert]"));
  const stops = candidates.filter((el) => {
    if (!(el instanceof HTMLInputElement) || el.type !== "radio" || !el.name) return true;
    const group = candidates.filter(
      (other): other is HTMLInputElement =>
        other instanceof HTMLInputElement && other.type === "radio" && other.name === el.name
    );
    const stop = group.find((r) => r === document.activeElement) ?? group.find((r) => r.checked) ?? group[0];
    return el === stop;
  });
  if (stops.length === 0) return;
  const index = stops.indexOf(document.activeElement as HTMLElement);
  const next =
    index === -1
      ? event.shiftKey
        ? stops.length - 1
        : 0
      : (index + (event.shiftKey ? -1 : 1) + stops.length) % stops.length;
  stops[next].focus();
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

export interface BeforeAfterProps {
  label: string;
  before: string;
  after: string;
  /** Show the label as a warning, e.g. "Not enough cash". */
  warning?: boolean;
}

/** "Cash $14K → $4K": a value before and after the sheet's action. */
export function BeforeAfter({ label, before, after, warning }: BeforeAfterProps): React.ReactElement {
  return (
    <div className="sheet__row">
      <span className={warning ? "sheet__warning" : "sheet__label"}>{label}</span>
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

export interface ListRowProps {
  title: React.ReactNode;
  /** Right of the title: the price, or why it can't be had. */
  aside?: React.ReactNode;
  /** What pressing the row does; omit to make it plain text. */
  onSelect?: () => void;
  /** Lines under the title. */
  children?: React.ReactNode;
}

/** One row in a sheet's list (Actions, engines, upgrades, railroads): the whole row is what you press. */
export function ListRow({ title, aside, onSelect, children }: ListRowProps): React.ReactElement {
  const content = (
    <>
      <span className="sheet__row">
        <span>{title}</span>
        {aside}
      </span>
      {children}
    </>
  );
  return onSelect ? (
    <button type="button" className="sheet__listItem sheet__listItem--button" onClick={onSelect}>
      {content}
    </button>
  ) : (
    <div className="sheet__listItem">{content}</div>
  );
}

/** A row's price, or the price and how far short the player is. */
export function Price({ price, cash }: { price: number; cash: number }): React.ReactElement {
  return price > cash ? (
    <ShortOfCash>
      {formatMoney(price)} · {formatMoney(price - cash)} short
    </ShortOfCash>
  ) : (
    <span>{formatMoney(price)}</span>
  );
}

export interface ShortOfCashProps {
  /** What's short, e.g. "$4K short". */
  children: React.ReactNode;
  /** Announce the message when it appears (a refused action), rather than as part of a list. */
  alert?: boolean;
}

/** A "not enough cash" message. Loans is in the money strip, which stays in view above sheets. */
export function ShortOfCash({ children, alert }: ShortOfCashProps): React.ReactElement {
  return (
    <span className="sheet__warning" role={alert ? "alert" : undefined}>
      {children}
    </span>
  );
}
