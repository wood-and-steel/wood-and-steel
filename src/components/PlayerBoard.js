import React from "react";
import { ContractsList } from "./ContractsList";
import { buttonStyles } from "../shared/styles/styles";

// Player Board Component
export function PlayerBoard({ G, ctx, startingContractExists }) {
  return (
    <div className="playerBoard">
      {G.players.map(([key, {name, activeCities}]) => {
        const activePlayerBoard = ctx.currentPlayer === key;
        
        return (
          <div key={key} style={{flexGrow: 1}}>
            <div style={{
              backgroundColor: activePlayerBoard ? "#f0f2ff" : "transparent",
              padding: "0.5rem",
            }}>
              <div style={{
                fontWeight: activePlayerBoard ? "bold" : "400",
                marginBottom: "0.25rem",
              }}>
                {name}
              </div>
              {activeCities.map((city, index) => <div key={index}>{city}</div>)}
            </div>
            <div style={{display: "flex", flexDirection: "column", gap: "0.25em", paddingTop: "0.5em"}}>
              <button 
                name="privateContract" 
                className="button"
                style={{ 
                  ...( activePlayerBoard ? {} : buttonStyles.disabled ),
                  display: startingContractExists ? "block" : "none" 
                }}
              >Generate Private Contract</button>
              <ContractsList G={G} ctx={ctx} type="private" playerID={key} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
