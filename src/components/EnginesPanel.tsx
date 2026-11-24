import React from "react";
import type { PlayerProps } from "../stores/gameStore";
import { ENGINE_SLOT_NAMES as SLOT_NAMES, EngineSegments, EngineSlotIcon } from "./EngineIcon";
import { COMMODITY_GROUPS, engineDistance, formatCommodity, getEngineType, type EngineSlot } from "../rules/playerBoard";
import { commodityIcons } from "../shared/assets/icons";

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
  return (
    <div className="engines" aria-label="Your engines">
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
                <button type="button" className={`${nameClass} engines__name--button`} onClick={onBuyEngine}>
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
                <label className={`engines__cargo${cargo ? "" : " engines__cargo--none"}`}>
                  {cargo && (
                    <img className="engines__cargoIcon" src={(commodityIcons as Record<string, string>)[cargo]} alt="" />
                  )}
                  <span>{cargo ? formatCommodity(cargo) : "Set cargo"}</span>
                  <span className="engines__cargoChevron" aria-hidden="true">
                    ▾
                  </span>
                  <select
                    className="engines__cargoSelect"
                    aria-label={`${SLOT_NAMES[slot]} engine cargo`}
                    value={cargo ?? ""}
                    onChange={(e) => onSetCargo(slot, e.target.value || null)}
                  >
                    <option value="">No cargo</option>
                    {COMMODITY_GROUPS.map((group) => (
                      <optgroup key={group.name} label={group.name}>
                        {group.commodities.map((c) => (
                          <option key={c} value={c}>
                            {formatCommodity(c)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
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
