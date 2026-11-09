/**
 * Popover opened from a player tray to choose a value. Picking applies at once; there is no confirm.
 * Any option can be chosen for any token, since the board enforces no rules.
 */
import React from 'react';
import { commodityIcons } from '../shared/assets/icons';
import {
  COMMODITY_GROUPS,
  ENGINE_TYPES,
  formatCommodity,
  formatSegments,
  type EngineTypeId,
} from './playerBoardData';
import { useBoardPopover } from './useBoardPopover';

/** Decorative: always shown next to the commodity's name. */
export function CommodityIcon({ commodity }: { commodity: string }): React.ReactElement {
  return <img className="boardCommodityIcon" src={(commodityIcons as Record<string, string>)[commodity]} alt="" />;
}

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
  /** Extra class for this kind of option */
  className?: string;
  onClick: () => void;
  children: React.ReactNode;
}

function PickerOption({ selected, className, onClick, children }: PickerOptionProps): React.ReactElement {
  const classes = ['trayPicker__option'];
  if (className) classes.push(className);
  if (selected) classes.push('trayPicker__option--selected');
  return (
    <button
      type="button"
      className={classes.join(' ')}
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

interface CommodityOptionsProps {
  value: string | null;
  onPick: (commodity: string | null) => void;
}

export function CommodityOptions({ value, onPick }: CommodityOptionsProps): React.ReactElement {
  return (
    <>
      <PickerOption selected={value === null} onClick={() => onPick(null)}>
        No commodity
      </PickerOption>
      {COMMODITY_GROUPS.map((group) => (
        <div key={group.name} className="trayPicker__group" role="group" aria-label={group.name}>
          <span className="trayPicker__groupName">{group.name}</span>
          <div className="trayPicker__groupOptions">
            {group.commodities.map((commodity) => (
              <PickerOption
                key={commodity}
                selected={value === commodity}
                className="trayPicker__option--commodity"
                onClick={() => onPick(commodity)}
              >
                <CommodityIcon commodity={commodity} />
                <span>{formatCommodity(commodity)}</span>
              </PickerOption>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
