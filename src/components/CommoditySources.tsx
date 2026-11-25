import React from "react";
import { commodities } from "../data";
import { formatCommodity } from "../rules/playerBoard";
import { CommodityIcon } from "./CommodityIcon";

/** A sheet section listing the cities that supply a contract's commodity. */
export function CommoditySources({ commodity }: { commodity: string }): React.ReactElement {
  const cities = commodities.get(commodity)?.cities ?? [];
  const heading = `${formatCommodity(commodity)} · Available in:`;
  return (
    <section className="commoditySources" aria-label={heading}>
      <div className="sheet__subhead commoditySources__heading">
        <CommodityIcon commodity={commodity} />
        <span>{heading}</span>
      </div>
      <p className="commoditySources__cities">{cities.length > 0 ? cities.join(", ") : "No city supplies it."}</p>
    </section>
  );
}
