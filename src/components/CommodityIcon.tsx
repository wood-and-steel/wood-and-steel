import React from "react";
import { commodityIcons } from "../shared/assets/icons";

/** A commodity's icon, decorative: it sits before the commodity's name everywhere in the app. */
export function CommodityIcon({ commodity }: { commodity: string }): React.ReactElement {
  return <img className="commodityIcon" src={(commodityIcons as Record<string, string>)[commodity]} alt="" />;
}
