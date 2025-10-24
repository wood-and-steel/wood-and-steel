import React from "react";
import { ContractsList } from "./ContractsList";

// Market Contracts Component
export function MarketContracts({ G, ctx }) {
  return (
    <div className="marketContracts">
      <div className="marketContracts__title">Market contracts</div>
      <button name="marketContract" className="button">Generate Market Contract</button>
      <ContractsList G={G} ctx={ctx} type="market" />
    </div>
  );
}
