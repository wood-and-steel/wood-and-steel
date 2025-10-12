import React from "react";
import { rewardValue, railroadTieValue } from "../Contract";
import { contractStyles } from "../shared/styles/styles";

function getContractValue(contract) {
  const ties = railroadTieValue(contract);
  return `$${rewardValue(contract)/1000}K + ${ties} ${ties > 1 ? "RR ties" : "RR tie"}`;
}

function isContractEnabled(contract, ctx) {
  return contract.playerID === ctx.currentPlayer || 
         (contract.type === "market" && (!contract.fulfilled || contract.playerID === ctx.currentPlayer));
}

// Contract Component
export function Contract({ contract, ctx, onToggle, onDelete }) {
  const style = {
    ...contractStyles.fulfilled[contract.fulfilled], 
    ...contractStyles.type[contract.type], 
    ...(isContractEnabled(contract, ctx) ? contractStyles.enabled : contractStyles.disabled)
  };
  
  const value = getContractValue(contract);

  return (
    <div>
      <button 
        className="contract" 
        id={contract.id} 
        style={style} 
        name="toggleContractFulfilled"
        onClick={onToggle}
      >
        {contract.commodity} to {contract.destinationKey} ({value})
      </button>
      <button 
        className="deleteButton" 
        id={contract.id} 
        style={{display: contract.fulfilled ? "none" : "inline"}} 
        name="deleteContract"
        onClick={onDelete}
      >✕</button>
    </div>
  );
}
