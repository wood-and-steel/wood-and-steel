import React from "react";
import { COMMODITY_GROUPS, formatCommodity } from "../rules/playerBoard";
import { commodityIcons } from "../shared/assets/icons";
import { Sheet } from "./Sheet";

/** Groups in reading order for two columns: Metals | Mined goods, Crops | Finished goods, Livestock. */
const GROUP_ORDER = ["Metals", "Mined goods", "Crops", "Finished goods", "Livestock"];
const GROUPS = GROUP_ORDER.map((name) => COMMODITY_GROUPS.find((group) => group.name === name)!);

export interface CargoSheetProps {
  title: string;
  /** The commodity recorded now, or null. */
  cargo: string | null;
  /** Called with the chosen commodity, or null for no cargo; the sheet closes after. */
  onSelect: (commodity: string | null) => void;
  onClose: () => void;
}

/** Picks an engine's cargo: every commodity with its icon, grouped (without visible headers) in two columns. */
export function CargoSheet({ title, cargo, onSelect, onClose }: CargoSheetProps): React.ReactElement {
  const choose = (commodity: string | null) => {
    onSelect(commodity);
    onClose();
  };
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="cargoSheet">
        {GROUPS.map((group) => (
          <section key={group.name} className="cargoSheet__group" aria-label={group.name}>
            {group.commodities.map((c) => (
              <button
                key={c}
                type="button"
                className={`cargoSheet__item${cargo === c ? " cargoSheet__item--selected" : ""}`}
                aria-pressed={cargo === c}
                onClick={() => choose(c)}
              >
                <span>{formatCommodity(c)}</span>
                <img className="cargoSheet__icon" src={(commodityIcons as Record<string, string>)[c]} alt="" />
              </button>
            ))}
          </section>
        ))}
      </div>
      <button type="button" className="button sheet__primary" disabled={cargo === null} onClick={() => choose(null)}>
        Clear cargo
      </button>
    </Sheet>
  );
}
