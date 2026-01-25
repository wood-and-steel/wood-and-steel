import React from "react";
import { cities } from "../data";
import { valueOfCity } from "../Contract";

// Helper function
function formatCommodityList(items) {
  return items.toString().replaceAll(',', ', ');
}

// Cities Page Component
export function CitiesPage({ G }) {
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

  return (
    <div className="pageContent">
      <div className="referenceTable__title">Cities</div>
      <div className="referenceTable cityTable">{cityValues}</div>
    </div>
  );
}
