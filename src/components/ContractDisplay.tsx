import React from "react";
import { PopupMenu, PopupMenuItem } from "./PopupMenu";
import { ContractCard } from "./ContractCard";
import type { Contract } from "../Contract";

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
  const cardRef = React.useRef<HTMLButtonElement>(null);
  const isClickable = typeof onCardClick === "function";

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
      <ContractCard
        ref={cardRef}
        commodity={contract.commodity}
        destinationKey={contract.destinationKey}
        variant={contract.type === "market" ? "market" : "private"}
        fulfilled={contract.fulfilled}
        disabled={!isClickable}
        onClick={isClickable ? onCardClick : undefined}
        onKeyDown={
          isClickable
            ? (e: React.KeyboardEvent<HTMLButtonElement>) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onCardClick();
                }
              }
            : undefined
        }
        aria-haspopup={isClickable ? "menu" : undefined}
        aria-expanded={isClickable ? isMenuOpen : undefined}
      />
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
