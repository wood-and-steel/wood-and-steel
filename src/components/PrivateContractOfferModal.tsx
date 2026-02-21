import React from "react";
import { generatePrivateContractOffers } from "../Contract";
import { ContractCard } from "./ContractCard";
import type { GameState, GameContext } from "../stores/gameStore";
import type { PrivateContractSpec } from "../Contract";

export interface PrivateContractOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  offerCount?: number;
  G: GameState;
  ctx: GameContext;
  onSelect: (commodity: string, destinationKey: string) => void;
}

/**
 * Modal for selecting a private contract from generated offers.
 * Displays 2, 3, or 4 contract options as selectable cards.
 * Backdrop click or Escape closes without selecting.
 */
export function PrivateContractOfferModal({
  isOpen,
  onClose,
  offerCount,
  G,
  ctx,
  onSelect,
}: PrivateContractOfferModalProps): React.ReactElement | null {
  const [offers, setOffers] = React.useState<PrivateContractSpec[]>([]);

  React.useEffect(() => {
    if (isOpen && G && ctx) {
      const generated = generatePrivateContractOffers(G, ctx, offerCount ?? 2);
      setOffers(generated);
    }
  }, [isOpen, G, ctx, offerCount]);

  const handleOfferClick = React.useCallback(
    (commodity: string, destinationKey: string) => {
      onSelect(commodity, destinationKey);
      onClose();
    },
    [onSelect, onClose]
  );

  const handleBackdropClick = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      className="modal"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="private-contract-offer-title"
      tabIndex={-1}
    >
      <div
        className="modal__content privateContractOfferModal__content"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="privateContractOfferModal__instruction"
          id="private-contract-offer-title"
        >
          Choose a new contract
        </h2>
        <div className="privateContractOfferModal__grid">
          {offers.map((spec: PrivateContractSpec, index: number) => {
            const specKey = `${spec.commodity}|${spec.destinationKey}|${index}`;
            return (
              <ContractCard
                key={specKey}
                commodity={spec.commodity}
                destinationKey={spec.destinationKey}
                variant="private"
                className="privateContractOfferModal__card"
                onClick={() => handleOfferClick(spec.commodity, spec.destinationKey)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
