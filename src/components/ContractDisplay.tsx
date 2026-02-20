import React from "react";
import { rewardValue, railroadTieValue } from "../Contract";
import { CommodityRichName } from "./CommodityRichName";
import { contractTieIcons } from "../shared/assets/icons";
import { PopupMenu, PopupMenuItem } from "./PopupMenu";
import type { Contract } from "../Contract";

function formatContractTieValue(contract: { destinationKey: string; commodity: string }): React.ReactElement {
  const ties = railroadTieValue(contract);
  const tieIcons = contractTieIcons as Record<string, string>;
  return (
    <img
      className="contract__tieIcon"
      src={tieIcons[String(ties)]}
      alt={`${ties} ${ties > 1 ? "railroad ties" : "railroad tie"}`}
    />
  );
}

export interface ContractDisplayProps {
  contract: Contract;
  isMenuOpen: boolean;
  onCardClick: (() => void) | null;
  onClose: () => void;
  onCloseOutside: () => void;
  onToggleFulfilled: (contractID: string) => void;
  onDelete: (contractID: string) => void;
  onClaimContract?: (contractID: string) => void;
  claimMarketDisabled?: boolean;
}

/**
 * Displays a single contract card with commodity, destination, reward value, and railroad ties.
 * Clicking the card opens a popup menu for fulfilling or deleting the contract.
 */
export function ContractDisplay({
  contract,
  isMenuOpen,
  onCardClick,
  onClose,
  onCloseOutside,
  onToggleFulfilled,
  onDelete,
  onClaimContract,
  claimMarketDisabled,
}: ContractDisplayProps): React.ReactElement {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const isClickable = typeof onCardClick === "function";
  const classes = [
    "contract",
    contract.type === "market" ? "contract--market" : "contract--private",
    contract.fulfilled ? "contract--fulfilled" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const handleToggle = () => {
    onToggleFulfilled(contract.id);
    onClose();
  };

  const handleDelete = () => {
    onDelete(contract.id);
    onClose();
  };

  const handleClaim = () => {
    onClaimContract?.(contract.id);
    onClose();
  };

  return (
    <>
      <div
        ref={cardRef}
        className={classes}
        {...(isClickable
          ? {
              role: "button",
              tabIndex: 0,
              onClick: onCardClick,
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onCardClick();
                }
              },
              "aria-haspopup": "menu",
              "aria-expanded": isMenuOpen,
            }
          : {})}
      >
        <div className="contract__header">
          {formatContractTieValue(contract)}
          <div className="contract__rewardValue">${rewardValue(contract) / 1000}K</div>
        </div>
        <div className="contract__body">
          <CommodityRichName commodity={contract.commodity} />
          <div className="contract__destination">to {contract.destinationKey}</div>
        </div>
      </div>
      {isClickable && (
        <PopupMenu
          isOpen={isMenuOpen}
          onClose={onClose}
          onCloseOutside={onCloseOutside}
          anchorRef={cardRef}
          placement={{ side: "bottom", align: "center" }}
        >
          <PopupMenuItem onClick={handleToggle}>
            {contract.fulfilled ? "Unfulfill Contract" : "Fulfill Contract"}
          </PopupMenuItem>
          {contract.type === "market" &&
            contract.playerID == null &&
            onClaimContract != null && (
              <PopupMenuItem onClick={handleClaim} disabled={claimMarketDisabled}>
                Claim Contract
              </PopupMenuItem>
            )}
          {!contract.fulfilled && (
            <PopupMenuItem onClick={handleDelete}>Delete</PopupMenuItem>
          )}
        </PopupMenu>
      )}
    </>
  );
}
