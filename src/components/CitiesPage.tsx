import React from "react";
import { cities } from "../data";
import { valueOfCity } from "../Contract";
import type { GameState, GameContext } from "../stores/gameStore";

function formatCommodityList(items: string[]): string {
  return items.toString().replace(/,/g, ", ");
}

export interface CitiesPageProps {
  G: GameState;
  ctx: GameContext;
  playerID: string;
}

/**
 * Page component displaying all cities with their values. Highlights cities that are active for this player.
 */
export function CitiesPage({ G, ctx, playerID }: CitiesPageProps): React.ReactElement {
  const thisPlayer = G.players.find(([key]) => key === playerID);
  const activeCities = thisPlayer ? new Set(thisPlayer[1].activeCities) : new Set<string>();

  const cityValues = [...cities].map(([key, value]) => {
    const isActive = activeCities.has(key);
    const valueNum = valueOfCity(G, key);
    return (
      <div key={key} className="cityCell">
        <span
          className={`cityCell__name ${isActive ? "cityCell__name--active" : ""}`}
          title={
            value.commodities.length === 0
              ? "(no commodities)"
              : formatCommodityList(value.commodities)
          }
        >
          {key}
        </span>
        <span className="cityCell__value">{valueNum ?? "—"}</span>
      </div>
    );
  });

  return (
    <div className="pageContent">
      <div className="referenceTable cityTable">{cityValues}</div>
    </div>
  );
}
