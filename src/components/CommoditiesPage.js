import React from "react";
import { commodities } from "../data";
import { commodityIcons } from "../shared/assets/icons";

// Helper function
function formatCommodityList(items) {
  return items.toString().replaceAll(',', ', ');
}

// Helper function to capitalize first letter
function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Commodities Page Component
export function CommoditiesPage() {
  const commodityList = [...commodities].map(([key, value]) =>
    <div key={key} className="commodityRow">
      <div className="commodityRow__header">
        <img src={commodityIcons[key]} alt={key} className="commodityRow__icon" />
        <span>{capitalizeFirst(key)}</span>
      </div>
      <div className="commodityRow__cities">{formatCommodityList(value.cities)}</div>
    </div>
  );

  return (
    <div className="pageContent">
      <div className="referenceTable commodityTable">{commodityList}</div>
    </div>
  );
}
