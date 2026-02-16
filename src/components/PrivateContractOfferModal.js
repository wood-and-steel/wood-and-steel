import React from "react";
import { rewardValue, railroadTieValue, generatePrivateContractOffers } from "../Contract.ts";
import { CommodityRichName } from "./CommodityRichName";
import { contractTieIcons } from "../shared/assets/icons";

function formatContractTieValue(spec) {
  const ties = railroadTieValue(spec);
  return (
    <img
      className="contract__tieIcon"
      src={contractTieIcons[ties]}
      alt={`${ties} ${ties > 1 ? "railroad ties" : "railroad tie"}`}
    />
  );
}

/**
 * Modal for selecting a private contract from generated offers.
 * Displays 2, 3, or 4 contract options as selectable cards.
 * Backdrop click or Escape closes without selecting.
 *
 * @component
 * @param {object} props
 * @param {boolean} props.isOpen - Whether the modal is currently open
 * @param {function} props.onClose - Called when the modal should close (e.g., backdrop click, Escape)
 * @param {number} props.offerCount - Number of offers to display (2, 3, or 4)
 * @param {object} props.G - The game state object
 * @param {object} props.ctx - The game context
 * @param {function} props.onSelect - Called when an offer is selected. Receives (commodity, destinationKey)
 */
export function PrivateContractOfferModal({ isOpen, onClose, offerCount, G, ctx, onSelect }) {
  const [offers, setOffers] = React.useState([]);

  // Generate offers when modal opens
  React.useEffect(() => {
    if (isOpen && G && ctx) {
      const generated = generatePrivateContractOffers(G, ctx, offerCount ?? 2);
      setOffers(generated);
    }
  }, [isOpen, G, ctx, offerCount]);

  const handleOfferClick = React.useCallback(
    (commodity, destinationKey) => {
      onSelect(commodity, destinationKey);
      onClose();
    },
    [onSelect, onClose]
  );

  const handleBackdropClick = React.useCallback(
    (e) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const handleKeyDown = React.useCallback(
    (e) => {
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
      <div className="modal__content privateContractOfferModal__content" onClick={(e) => e.stopPropagation()}>
        <h2 className="privateContractOfferModal__instruction" id="private-contract-offer-title">
          Choose a new contract
        </h2>
        <div className="privateContractOfferModal__grid">
          {offers.map((spec, index) => {
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
