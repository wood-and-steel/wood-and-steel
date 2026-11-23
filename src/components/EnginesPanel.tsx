import React from "react";
import type { PlayerProps } from "../stores/gameStore";
import { COMMODITY_GROUPS, engineDistance, formatCommodity, formatSegments, getEngineType, type EngineSlot } from "../rules/playerBoard";

export interface EnginesPanelProps {
  player: PlayerProps;
  /** Cargo can be recorded only on the player's own turn; otherwise it's shown read-only. */
  canEdit: boolean;
  onSetCargo: (slot: EngineSlot, commodity: string | null) => boolean;
}

const SLOT_NAMES: Record<EngineSlot, string> = { 0: "Light", 1: "Dark" };

/**
 * The player's two engine tokens: engine type, distance (with the Service Yard), and cargo.
 * Recording cargo is optional; contracts can be fulfilled without it.
 */
export function EnginesPanel({ player, canEdit, onSetCargo }: EnginesPanelProps): React.ReactElement {
  const hasServiceYard = player.upgrades.includes("service-yard");
  return (
    <div className="engines" aria-label="Your engines">
      {([0, 1] as EngineSlot[]).map((slot) => {
        const type = player.engines[slot];
        const cargo = player.cargo[slot];
        const distance = type ? engineDistance(type, hasServiceYard) : null;
        return (
          <div key={slot} className="engines__row" role="group" aria-label={`${SLOT_NAMES[slot]} engine`}>
            <span className="engines__slot">{SLOT_NAMES[slot]}</span>
            <span className={`engines__type${type ? "" : " engines__type--none"}`}>
              {type ? getEngineType(type).name : "No engine"}
              {distance && (
                <span className="engines__distance">
                  {" "}
                  · {formatSegments(distance.total)}
                  {distance.bonus > 0 ? " (Service Yard)" : ""}
                </span>
              )}
            </span>
            {type &&
              (canEdit ? (
                <select
                  className="engines__cargo"
                  aria-label={`${SLOT_NAMES[slot]} engine cargo`}
                  value={cargo ?? ""}
                  onChange={(e) => onSetCargo(slot, e.target.value || null)}
                >
                  <option value="">Set cargo</option>
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
              ) : (
                <span className="engines__cargoText">{cargo ? formatCommodity(cargo) : "No cargo recorded"}</span>
              ))}
          </div>
        );
      })}
    </div>
  );
}
