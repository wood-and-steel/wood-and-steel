/**
 * Popover opened from a player tray to choose a value. Picking applies at once; there is no confirm.
 * Any option can be chosen for any token, since the board enforces no rules.
 */
import React from 'react';
import { ENGINE_TYPES, formatSegments, type EngineTypeId } from './playerBoardData';
import { useBoardPopover } from './useBoardPopover';

interface TrayPickerProps {
  label: string;
  clientX: number;
  clientY: number;
  onClose: () => void;
  children: React.ReactNode;
}

export function TrayPicker({ label, clientX, clientY, onClose, children }: TrayPickerProps): React.ReactElement {
  const ref = React.useRef<HTMLDivElement>(null);
  const placed = useBoardPopover(ref, clientX, clientY, onClose);

  // A hidden element can't take focus, so wait until the picker has been placed.
  React.useEffect(() => {
    if (placed) ref.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
  }, [placed]);

  return (
    <div ref={ref} className={`trayPicker${placed ? ' trayPicker--placed' : ''}`} role="dialog" aria-label={label}>
      {children}
    </div>
  );
}

interface PickerOptionProps {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function PickerOption({ selected, onClick, children }: PickerOptionProps): React.ReactElement {
  return (
    <button
      type="button"
      className={`trayPicker__option${selected ? ' trayPicker__option--selected' : ''}`}
      aria-pressed={selected}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

interface EngineOptionsProps {
  value: EngineTypeId | null;
  onPick: (engineType: EngineTypeId | null) => void;
}

export function EngineOptions({ value, onPick }: EngineOptionsProps): React.ReactElement {
  return (
    <>
      <PickerOption selected={value === null} onClick={() => onPick(null)}>
        No engine
      </PickerOption>
      {ENGINE_TYPES.map((engine) => (
        <PickerOption key={engine.id} selected={value === engine.id} onClick={() => onPick(engine.id)}>
          <span>{engine.name}</span>
          <span className="trayPicker__meta">{formatSegments(engine.distance)}</span>
        </PickerOption>
      ))}
    </>
  );
}
