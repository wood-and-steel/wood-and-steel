import React from "react";
import { commodities } from "../data";
import { useGame } from "../hooks/useGame";
import { CommodityRichName } from "./CommodityRichName";

function formatCommodityCityList(items: string[]): string {
  return items.toString().replace(/,/g, ", ");
}

/**
 * Page component displaying all commodities, split into two sections:
 * commodities that appear in active contracts, and all other commodities.
 */
export function CommoditiesPage(): React.ReactElement {
  const { G, ctx } = useGame();

  const commoditiesInContracts = new Set<string>();
  G.contracts.forEach((contract) => {
    if (
      (contract.playerID === ctx.currentPlayer &&
        contract.type === "private" &&
        !contract.fulfilled) ||
      (contract.type === "market" && !contract.fulfilled)
    ) {
      commoditiesInContracts.add(contract.commodity);
    }
  });

  const inContractsList: React.ReactElement[] = [];
  const othersList: React.ReactElement[] = [];

  [...commodities].forEach(([key, value]) => {
    const commodityRow = (
      <div key={key} className="commodityRow">
        <div className="commodityRow__header">
          <CommodityRichName commodity={key} />
        </div>
        <div className="commodityRow__cities">{formatCommodityCityList(value.cities)}</div>
      </div>
    );

    if (commoditiesInContracts.has(key)) {
      inContractsList.push(commodityRow);
    } else {
      othersList.push(commodityRow);
    }
  });

  return (
    <div className="pageContent">
      <div className="referenceTable commodityTable">
        <div>
          <h3 className="commoditySection__title">In contracts</h3>
          {inContractsList.length > 0 ? (
            <div>{inContractsList}</div>
          ) : (
            <div className="commoditySection__empty">No commodities in contracts</div>
          )}
        </div>
        <div>
          <h3 className="commoditySection__title">Others</h3>
          {othersList.length > 0 ? (
            <div>{othersList}</div>
          ) : (
            <div className="commoditySection__empty">No other commodities</div>
          )}
        </div>
      </div>
    </div>
  );
}
