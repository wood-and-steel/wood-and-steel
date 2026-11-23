import React from "react";
import { generatePrivateContractOffers } from "../Contract";
import { ContractCard } from "./ContractCard";
import type { GameState, GameContext } from "../stores/gameStore";
import type { PrivateContractSpec } from "../Contract";

export interface PrivateContractOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  G: GameState;
  ctx: GameContext;
  onSelect: (commodity: string, destinationKey: string) => void;
}

/**
 * Modal for selecting a private contract from generated offers.
 * Displays 2, 3, or 4 contract options as selectable cards (3 with a Hub, one more with a
 * Regional Office; both are bought from the Actions sheet before offers are drawn).
 * Backdrop click or Escape closes without selecting.
 */
export function PrivateContractOfferModal({
  isOpen,
  onClose,
  G,
  ctx,
  onSelect,
}: PrivateContractOfferModalProps): React.ReactElement | null {
  const [offers, setOffers] = React.useState<PrivateContractSpec[]>([]);

  const prevIsOpenRef = React.useRef(false);
  React.useEffect(() => {
    const justOpened = isOpen && !prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;
    if (justOpened && G && ctx) {
      setOffers(generatePrivateContractOffers(G, ctx));
    }
  }, [isOpen, G, ctx]);

  React.useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const handleOfferClick = React.useCallback(
    (commodity: string, destinationKey: string) => {
      onSelect(commodity, destinationKey);
      onClose();
    },
    [onSelect, onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      className="modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="private-contract-offer-title"
      tabIndex={-1}
    >
      <div
        className="modal__content privateContractOfferModal__content"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="privateContractOfferModal__instruction" id="private-contract-offer-title">
          Choose a new contract
        </h2>
        <div className="privateContractOfferModal__grid">
          {offers.map((spec: PrivateContractSpec, index: number) => (
            <ContractCard
              key={`${spec.commodity}|${spec.destinationKey}|${index}`}
              commodity={spec.commodity}
              destinationKey={spec.destinationKey}
              variant="private"
              className="privateContractOfferModal__card"
              onClick={() => handleOfferClick(spec.commodity, spec.destinationKey)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
