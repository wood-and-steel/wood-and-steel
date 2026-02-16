import React from "react";
import { rewardValue, railroadTieValue } from "../Contract.ts";
import { CommodityRichName } from "./CommodityRichName";
import { contractTieIcons } from "../shared/assets/icons";
import { PopupMenu, PopupMenuItem } from "./PopupMenu";

function formatContractTieValue(contract) {
  const ties = railroadTieValue(contract);
  return (
    <img
      className="contract__tieIcon"
      src={contractTieIcons[ties]}
      alt={`${ties} ${ties > 1 ? "railroad ties" : "railroad tie"}`}
    />
  );
}

/**
 * Displays a single contract card with commodity, destination, reward value, and railroad ties.
 * Clicking the card opens a popup menu for fulfilling or deleting the contract.
 * 
 * @component
 * @param {object} props
 * @param {object} props.contract - The contract object to display.
 * @param {boolean} props.isMenuOpen - Whether the popup menu is currently open.
 * @param {function} props.onCardClick - Called when the contract card is clicked (toggles menu).
 * @param {function} props.onClose - Called when the menu should be closed.
 * @param {function} props.onCloseOutside - Called when clicking outside the menu (used to prevent immediate reopening).
 * @param {function} props.onToggleFulfilled - Called when the contract's fulfilled state should be toggled. Receives the contract ID.
 * @param {function} props.onDelete - Called when the contract should be deleted. Receives the contract ID.
 * 
 * @example
 * <ContractDisplay
 *   contract={contract}
 *   isMenuOpen={openId === contract.id}
 *   onCardClick={() => handleClick(contract.id)}
 *   onClose={() => setOpenId(null)}
 *   onCloseOutside={handleCloseOutside}
 *   onToggleFulfilled={(id) => toggleFulfilled(id)}
 *   onDelete={(id) => deleteContract(id)}
 * />
 */
export function ContractDisplay({
  contract,
  isMenuOpen,
  onCardClick,
  onClose,
  onCloseOutside,
  onToggleFulfilled,
  onDelete,
}) {
  const cardRef = React.useRef(null);
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
              onKeyDown: (e) => {
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
          {!contract.fulfilled && (
            <PopupMenuItem onClick={handleDelete}>Delete</PopupMenuItem>
          )}
        </PopupMenu>
      )}
    </>
  );
}
