import React from "react";
import { rewardValue, railroadTieValue, generatePrivateContractOffers } from "../Contract";
import { CommodityRichName } from "./CommodityRichName";
import { contractTieIcons } from "../shared/assets/icons";
import type { GameState, GameContext } from "../stores/gameStore";
import type { PrivateContractSpec } from "../Contract";

function formatContractTieValue(spec: PrivateContractSpec): React.ReactElement {
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
            const reward = rewardValue(spec);
            return (
              <button
                key={specKey}
                type="button"
                className="contract contract--private privateContractOfferModal__card"
                onClick={() => handleOfferClick(spec.commodity, spec.destinationKey)}
              >
                <div className="contract__header">
                  {formatContractTieValue(spec)}
                  <div className="contract__rewardValue">${reward / 1000}K</div>
                </div>
                <div className="contract__body">
                  <CommodityRichName commodity={spec.commodity} />
                  <div className="contract__destination">to {spec.destinationKey}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
