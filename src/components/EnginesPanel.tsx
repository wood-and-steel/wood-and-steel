import React from "react";
import type { PlayerProps } from "../stores/gameStore";
import { ENGINE_SLOT_NAMES as SLOT_NAMES, EngineSegments, EngineSlotIcon } from "./EngineIcon";
import { engineDistance, formatCommodity, getEngineType, type EngineSlot } from "../rules/playerBoard";
import { commodityIcons } from "../shared/assets/icons";
import { CargoSheet } from "./CargoSheet";

export interface EnginesPanelProps {
  player: PlayerProps;
  /** The player's seat, for their token colors. */
  playerID: string;
  /** Cargo can be recorded only on the player's own turn; otherwise it's shown read-only. */
  canEdit: boolean;
  onSetCargo: (slot: EngineSlot, commodity: string | null) => boolean;
  /** Opens the Buy an engine sheet when the player taps an engine's name; omit to make the names plain text. */
  onBuyEngine?: () => void;
}

/**
 * The player's two engine tokens, each shown as the engine picture in its token color (light
 * or dark version of the player's color): engine type, distance (with the Service Yard), and cargo.
 * Recording cargo is optional; contracts can be fulfilled without it.
 */
export function EnginesPanel({ player, playerID, canEdit, onSetCargo, onBuyEngine }: EnginesPanelProps): React.ReactElement {
  const hasServiceYard = player.upgrades.includes("service-yard");
  /** The engine whose cargo sheet is open, if any. */
  const [pickingSlot, setPickingSlot] = React.useState<EngineSlot | null>(null);
  // A picker from a finished turn must not come back on the player's next turn.
  React.useEffect(() => {
    if (!canEdit) setPickingSlot(null);
  }, [canEdit]);
  const cargoSheet = (slot: EngineSlot): React.ReactElement => (
    <CargoSheet
      title={
        <span className="engineLabel">
          <EngineSlotIcon playerID={playerID} avatarColor={player.avatarColor} slot={slot} />
          {getEngineType(player.engines[slot]!).name} cargo
        </span>
      }
      cargo={player.cargo[slot]}
      onSelect={(commodity) => onSetCargo(slot, commodity)}
      onClose={() => setPickingSlot(null)}
    />
  );
  return (
    <div className="engines" aria-label="Your engines">
      {pickingSlot !== null && canEdit && cargoSheet(pickingSlot)}
      {([0, 1] as EngineSlot[]).map((slot) => {
        const type = player.engines[slot];
        const cargo = player.cargo[slot];
        const distance = type ? engineDistance(type, hasServiceYard) : null;
        const name = type ? getEngineType(type).name : "No engine";
        const nameClass = `engines__name${type ? "" : " engines__name--none"}`;
        return (
          <div key={slot} className="engines__row" role="group" aria-label={`${SLOT_NAMES[slot]} engine`}>
            <span className="engines__slot">
              <EngineSlotIcon playerID={playerID} avatarColor={player.avatarColor} slot={slot} label={`${SLOT_NAMES[slot]} engine`} />
            </span>
            <span className="engines__type">
              {onBuyEngine ? (
                <button type="button" className={`plainButton ${nameClass} engines__name--button`} onClick={onBuyEngine}>
                  {name}
                </button>
              ) : (
                <span className={nameClass}>{name}</span>
              )}
              {distance && (
                <span className="engines__distance">
                  · <EngineSegments count={distance.total} />
                  {distance.bonus > 0 ? " (Service Yard)" : ""}
                </span>
              )}
            </span>
            {type &&
              (canEdit ? (
                <button
                  type="button"
                  className={`plainButton engines__cargo engines__cargo--button${cargo ? "" : " engines__cargo--none"}`}
                  aria-label={`${SLOT_NAMES[slot]} engine cargo: ${cargo ? formatCommodity(cargo) : "none"}`}
                  onClick={() => setPickingSlot(slot)}
                >
                  {cargo && (
                    <img className="engines__cargoIcon" src={(commodityIcons as Record<string, string>)[cargo]} alt="" />
                  )}
                  <span>{cargo ? formatCommodity(cargo) : "Set cargo"}</span>
                  <span className="engines__cargoChevron" aria-hidden="true">
                    ▾
                  </span>
                </button>
              ) : (
                <span className={`engines__cargo${cargo ? "" : " engines__cargo--none"}`}>
                  {cargo && (
                    <img className="engines__cargoIcon" src={(commodityIcons as Record<string, string>)[cargo]} alt="" />
                  )}
                  <span>{cargo ? formatCommodity(cargo) : "No cargo recorded"}</span>
                </span>
              ))}
          </div>
        );
      })}
    </div>
  );
}
