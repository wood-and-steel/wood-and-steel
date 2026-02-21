import React from "react";
import { rewardValue, railroadTieValue } from "../Contract";
import { CommodityRichName } from "./CommodityRichName";
import { contractTieIcons } from "../shared/assets/icons";

export interface ContractCardSpec {
  commodity: string;
  destinationKey: string;
}

function formatContractTieValue(spec: ContractCardSpec): React.ReactElement {
  const ties = railroadTieValue(spec);
  const tieIcons = contractTieIcons as Record<string, string>;
  return (
    <img
      className="contract__tieIcon"
      src={tieIcons[String(ties)]}
      alt={`${ties} ${ties > 1 ? "railroad ties" : "railroad tie"}`}
    />
  );
}

export interface ContractCardProps extends ContractCardSpec {
  variant: "market" | "private";
  fulfilled?: boolean;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  "aria-haspopup"?: "menu" | boolean;
  "aria-expanded"?: boolean;
}

/**
 * Shared presentational contract card. Renders as a button for consistent
 * hover/focus styling. Use in lists (with aria-haspopup when opening a menu)
 * and in the private contract offer modal.
 */
export const ContractCard = React.forwardRef<HTMLButtonElement, ContractCardProps>(
  function ContractCard(
    {
      commodity,
      destinationKey,
      variant,
      fulfilled = false,
      className,
      disabled = false,
      onClick,
      onKeyDown,
      "aria-haspopup": ariaHaspopup,
      "aria-expanded": ariaExpanded,
    },
    ref
  ): React.ReactElement {
    const spec: ContractCardSpec = { commodity, destinationKey };
    const reward = rewardValue(spec);
    const classes = [
      "contract",
      variant === "market" ? "contract--market" : "contract--private",
      fulfilled ? "contract--fulfilled" : "",
      className ?? "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        ref={ref}
        type="button"
        className={classes}
        disabled={disabled}
        onClick={onClick}
        onKeyDown={onKeyDown}
        aria-haspopup={ariaHaspopup}
        aria-expanded={ariaExpanded}
      >
        <div className="contract__header">
          {formatContractTieValue(spec)}
          <div className="contract__rewardValue">${reward / 1000}K</div>
        </div>
        <div className="contract__body">
          <CommodityRichName commodity={commodity} />
          <div className="contract__destination">to {destinationKey}</div>
        </div>
      </button>
    );
  }
);
