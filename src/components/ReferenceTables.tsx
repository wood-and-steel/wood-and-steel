import React from "react";
import { cities, commodities } from "../data";
import { valueOfCity } from "../Contract";
import { commodityIcons } from "../shared/assets/icons";
import type { GameState } from "../stores/gameStore";

function formatCommodityList(items: string[]): string {
  return items.toString().replace(/,/g, ", ");
}

export interface ReferenceTablesProps {
  G: GameState;
}

/**
 * Displays reference tables showing all commodities and cities with their values.
 */
export function ReferenceTables({ G }: ReferenceTablesProps): React.ReactElement {
  const cityValues = [...cities].map(([key, value]) => (
    <div key={key} className="cityCell">
      <span
        className="cityCell__name"
        title={
          value.commodities.length === 0
            ? "(no commodities)"
            : formatCommodityList(value.commodities)
        }
      >
        {key}
      </span>
      <span className="cityCell__value">{valueOfCity(G, key) ?? "—"}</span>
    </div>
  ));

  const commodityList = [...commodities].map(([key, value]) => (
    <div key={key} className="commodityRow">
      <img
        src={(commodityIcons as Record<string, string>)[key]}
        alt={key}
        className="commodityRow__icon"
      />
      <span>{key}</span>
      <span className="commodityRow__cities">• {formatCommodityList(value.cities)}</span>
    </div>
  ));

  return (
    <>
      <div>
        <div className="referenceTable__title">Commodities</div>
        <div className="referenceTable commodityTable">{commodityList}</div>
      </div>
      <div>
        <div className="referenceTable__title">Cities</div>
        <div className="referenceTable cityTable">{cityValues}</div>
      </div>
    </>
  );
}
