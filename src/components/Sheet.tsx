import React from "react";

export interface SheetProps {
  title: string;
  onClose: () => void;
  /** Shown left of the title, e.g. a Back button inside a multi-step sheet. */
  onBack?: () => void;
  children: React.ReactNode;
}

/**
 * A dialog over the game for one task (loans, actions, a delivery). Closes on the Close
 * button, a backdrop click, or Escape.
 */
export function Sheet({ title, onClose, onBack, children }: SheetProps): React.ReactElement {
  const titleId = React.useId();

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal__content sheet">
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
    </div>
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
