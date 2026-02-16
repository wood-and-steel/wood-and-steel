import React from "react";
import { cities, commodities } from "../data";
import { valueOfCity } from "../Contract.ts";
import { commodityIcons } from "../shared/assets/icons";

// Helper functions
function formatCommodityList(items) {
  return items.toString().replaceAll(',', ', ');
}

/**
 * Displays reference tables showing all commodities and cities with their values.
 * 
 * @component
 * @param {object} props
 * @param {object} props.G - The game state object, used to calculate city values.
 * 
 * @example
 * <ReferenceTables G={G} />
 */
export function ReferenceTables({ G }) {
  const cityValues = [...cities].map(([key, value]) =>
    <div key={key} className="cityCell">
      <span 
        className="cityCell__name"
        title={value.commodities.length === 0 ? "(no commodities)" : formatCommodityList(value.commodities)}
      >
        {key}
      </span> 
      <span className="cityCell__value">{valueOfCity(G, key)}</span>
    </div>
  );

  const commodityList = [...commodities].map(([key, value]) =>
    <div key={key} className="commodityRow">
      <img src={commodityIcons[key]} alt={key} className="commodityRow__icon" />
      <span>{key}</span>
      <span className="commodityRow__cities">• {formatCommodityList(value.cities)}</span>
    </div>
  );

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
