import React from "react";
import { cities } from "../data";
import { valueOfCity } from "../Contract.ts";

// Helper function
function formatCommodityList(items) {
  return items.toString().replaceAll(',', ', ');
}

/**
 * Page component displaying all cities with their values. Highlights cities that are active for this player.
 * 
 * @component
 * @param {object} props
 * @param {object} props.G - The game state object containing players and their active cities.
 * @param {object} props.ctx - The game context.
 * @param {string} props.playerID - The player ID for this device/board.
 * 
 * @example
 * <CitiesPage G={G} ctx={ctx} playerID={playerID} />
 */
export function CitiesPage({ G, ctx, playerID }) {
  // Get this player's active cities (use playerID, not ctx.currentPlayer)
  const thisPlayer = G.players.find(([key]) => key === playerID);
  const activeCities = thisPlayer ? new Set(thisPlayer[1].activeCities) : new Set();
  
  const cityValues = [...cities].map(([key, value]) => {
    const isActive = activeCities.has(key);
    return (
      <div key={key} className="cityCell">
        <span 
          className={`cityCell__name ${isActive ? 'cityCell__name--active' : ''}`}
          title={value.commodities.length === 0 ? "(no commodities)" : formatCommodityList(value.commodities)}
        >
          {key}
        </span> 
        <span className="cityCell__value">{valueOfCity(G, key)}</span>
      </div>
    );
  });

  return (
    <div className="pageContent">
      <div className="referenceTable cityTable">{cityValues}</div>
    </div>
  );
}
