import React from "react";
import { ContractsList } from "./ContractsList";

// Player Board Component
export function PlayerBoard({ G, ctx, startingContractExists }) {
  const activePlayer = G.players.find(([key]) => key === ctx.currentPlayer);
  if (!activePlayer) return null;

  const [key, { name }] = activePlayer;

  return (
    <div className="playerBoard">
      <div className="playerBoard__player">
        <div className="playerBoard__info playerBoard__info--active">
          <div className="playerBoard__name playerBoard__name--active">
            {name}
          </div>
        </div>
        <div className="playerBoard__contracts">
          <button
            name="privateContract"
            className={`button ${startingContractExists ? '' : 'hidden'}`}
          >
            Generate Private Contract
          </button>
          <ContractsList G={G} ctx={ctx} type="private" playerID={key} />
        </div>
      </div>
    </div>
  );
}
