import React from "react";
import { ContractsList } from "./ContractsList";

// Player Board Component
export function PlayerBoard({ G, ctx, startingContractExists }) {
  return (
    <div className="playerBoard">
      {G.players.map(([key, {name, activeCities}]) => {
        const activePlayerBoard = ctx.currentPlayer === key;
        
        return (
          <div key={key} className="playerBoard__player">
            <div className={`playerBoard__info ${activePlayerBoard ? 'playerBoard__info--active' : ''}`}>
              <div className={`playerBoard__name ${activePlayerBoard ? 'playerBoard__name--active' : ''}`}>
                {name}
              </div>
              {activeCities.map((city, index) => <div key={index}>{city}</div>)}
            </div>
            <div className="playerBoard__contracts">
              <button 
                name="privateContract" 
                className={`button ${!activePlayerBoard ? 'button:disabled' : ''} ${startingContractExists ? '' : 'hidden'}`}
                disabled={!activePlayerBoard}
              >Generate Private Contract</button>
              <ContractsList G={G} ctx={ctx} type="private" playerID={key} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
