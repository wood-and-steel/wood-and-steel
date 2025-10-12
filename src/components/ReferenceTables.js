import React from "react";
import { cities, commodities } from "../data";
import { valueOfCity } from "../Contract";
import { commodityIcons } from "../shared/assets/icons";
import { formatCommodityList } from "../utils/helpers";

// Reference Tables Component
export function ReferenceTables({ G }) {
  const cityValues = [...cities].map(([key, value]) =>
    <div key={key} className="cityCell">
      <span 
        style={{opacity: '0.65', paddingRight: '0.4rem', cursor: 'default'}} 
        title={value.commodities.length === 0 ? "(no commodities)" : formatCommodityList(value.commodities)}
      >
        {key}
      </span> 
      <span style={{fontWeight: '600'}}>{valueOfCity(G, key)}</span>
    </div>
  );

  const commodityList = [...commodities].map(([key, value]) =>
    <div key={key} style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
      <img src={commodityIcons[key]} alt={key} style={{width: '24px', height: '24px'}} />
      <span>{key}</span>
      <span style={{opacity: "0.6"}}>• {formatCommodityList(value.cities)}</span>
    </div>
  );

  return (
    <>
      <div>
        <div style={{fontWeight: "bold", paddingTop: "1rem"}}>Commodities</div>
        <div className="referenceTable commodityTable">{commodityList}</div>
      </div>
      <div>
        <div style={{fontWeight: "bold"}}>Cities</div>
        <div className="referenceTable cityTable">{cityValues}</div>
      </div>
    </>
  );
}
