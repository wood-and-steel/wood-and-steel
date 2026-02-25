import React from "react";
import { generatePrivateContractOffers } from "../Contract";
import { ContractCard } from "./ContractCard";
import type { GameState, GameContext } from "../stores/gameStore";
import type { PrivateContractSpec } from "../Contract";

/** Moves used by the modal for upgrade cards. */
export interface PrivateContractOfferModalMoves {
  claimHubCity: (cityKey: string) => boolean;
  claimRegionalOffice: (regionCode: string) => void;
}

export interface PrivateContractOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  G: GameState;
  ctx: GameContext;
  onSelect: (commodity: string, destinationKey: string) => void;
  moves?: PrivateContractOfferModalMoves;
}

/**
 * Modal for selecting a private contract from generated offers.
 * Displays 2, 3, or 4 contract options as selectable cards.
 * Backdrop click or Escape closes without selecting.
 */
export function PrivateContractOfferModal({
  isOpen,
  onClose,
  G,
  ctx,
  onSelect,
  moves,
}: PrivateContractOfferModalProps): React.ReactElement | null {
  const [offers, setOffers] = React.useState<PrivateContractSpec[]>([]);

  const currentPlayer = React.useMemo(
    () => G?.players?.find(([id]) => id === ctx?.currentPlayer)?.[1],
    [G, ctx]
  );

  React.useEffect(() => {
    if (isOpen && G && ctx) {
      const generated = generatePrivateContractOffers(G, ctx);
      setOffers(generated);
    }
  }, [isOpen, G, ctx]);

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

  const handleBuyHub = React.useCallback(() => {
    if (!moves || !currentPlayer?.activeCities?.length) return;
    moves.claimHubCity(currentPlayer.activeCities[0]!);
    onClose();
  }, [moves, currentPlayer, onClose]);

  const handleBuyRegionalOffice = React.useCallback(() => {
    if (!moves) return;
    moves.claimRegionalOffice("NE");
    onClose();
  }, [moves, onClose]);

  const showBuyHub = moves && currentPlayer && currentPlayer.hubCity === null;
  const showBuyRegionalOffice =
    moves && currentPlayer && currentPlayer.regionalOffice === null;

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
          {showBuyHub && (
            <button
              type="button"
              className="contract contract--private privateContractOfferModal__card"
              onClick={handleBuyHub}
            >
              <div className="contract__header" aria-hidden="true">
                <span style={{ visibility: "hidden" }}>0</span>
              </div>
              <div className="contract__body">Buy a Hub</div>
            </button>
          )}
          {showBuyRegionalOffice && (
            <button
              type="button"
              className="contract contract--private privateContractOfferModal__card"
              onClick={handleBuyRegionalOffice}
            >
              <div className="contract__header" aria-hidden="true">
                <span style={{ visibility: "hidden" }}>0</span>
              </div>
              <div className="contract__body">Buy a Regional Office</div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
