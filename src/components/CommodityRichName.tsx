import React from "react";
import { commodityIcons } from "../shared/assets/icons";

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export interface CommodityRichNameProps {
  /** Commodity name (lowercase, e.g. "wood", "steel"). */
  commodity: string;
  /** Optional CSS class name for the icon. Defaults to "commodityRow__icon". */
  iconClassName?: string;
}

/**
 * Displays a commodity name with its associated icon. The name is automatically capitalized.
 */
export function CommodityRichName({
  commodity,
  iconClassName,
}: CommodityRichNameProps): React.ReactElement {
  return (
    <div className="commodityRichName">
      <img
        src={(commodityIcons as Record<string, string>)[commodity]}
        alt={commodity}
        className={iconClassName ?? "commodityRow__icon"}
      />
      <span>{capitalizeFirst(commodity)}</span>
    </div>
  );
}
