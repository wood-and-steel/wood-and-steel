import React from "react";
import { moneyValue, railroadTieValue, type Contract } from "../Contract";
import type { PlayerProps } from "../stores/gameStore";
import { defaultDeliveringEngine, deliveryBreakdown } from "../rules/finance";
import { commodityIcons } from "../shared/assets/icons";
import { formatMoney } from "../utils/money";
import { PopupMenu, PopupMenuItem } from "./PopupMenu";

/** Ignore the card press that closed a menu by clicking outside it, so it doesn't reopen. */
const SKIP_OPEN_MS = 50;

export interface ContractAction {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

export interface ContractRowsProps {
  contracts: Contract[];
  /** The viewing player, for values net of their debt service; omit to show base values. */
  player?: PlayerProps;
  /** Menu items for a contract; an empty list makes its row not clickable. */
  actionsFor: (contract: Contract) => ContractAction[];
  /** Shown when there are no contracts. */
  emptyText: string;
}

function commodityLabel(commodity: string): string {
  return commodity.charAt(0).toUpperCase() + commodity.slice(1);
}

/** What a contract pays the player now, and its value before debt service when that lowers it. */
function valueFor(contract: Contract, player: PlayerProps | undefined): { net: number; gross: number | null } {
  if (!player) return { net: moneyValue(contract), gross: null };
  const r = deliveryBreakdown(player, contract, defaultDeliveringEngine(player.engines));
  const gross = r.value + r.engineBonus + r.stationsBonus;
  return { net: r.net, gross: r.debtService > 0 ? gross : null };
}

/**
 * Contracts as compact rows: commodity and destination, badges (claimed market contract,
 * rounds left before an open one expires), railroad ties, and the value to the viewing
 * player, struck through to the net when debt service lowers it. Pressing a row opens its
 * actions.
 */
export function ContractRows({ contracts, player, actionsFor, emptyText }: ContractRowsProps): React.ReactElement {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [skipOpenUntil, setSkipOpenUntil] = React.useState(0);

  if (contracts.length === 0) return <p className="contractRows__empty">{emptyText}</p>;

  return (
    <div className="contractRows">
      {[...contracts]
        .sort((a, b) => a.creationTime - b.creationTime)
        .map((contract) => (
          <ContractRow
            key={contract.id}
            contract={contract}
            player={player}
            actions={actionsFor(contract)}
            isOpen={openId === contract.id}
            onToggle={() => {
              if (Date.now() < skipOpenUntil) {
                setSkipOpenUntil(0);
                return;
              }
              setOpenId((prev: string | null) => (prev === contract.id ? null : contract.id));
            }}
            onClose={() => setOpenId(null)}
            onCloseOutside={() => setSkipOpenUntil(Date.now() + SKIP_OPEN_MS)}
          />
        ))}
    </div>
  );
}

interface ContractRowProps {
  contract: Contract;
  player?: PlayerProps;
  actions: ContractAction[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onCloseOutside: () => void;
}

function ContractRow({ contract, player, actions, isOpen, onToggle, onClose, onCloseOutside }: ContractRowProps): React.ReactElement {
  const rowRef = React.useRef<HTMLButtonElement>(null);
  const clickable = actions.length > 0 && !contract.fulfilled;
  const ties = railroadTieValue(contract);
  const claimed = contract.type === "market" && contract.playerID !== null;
  const { net, gross } = valueFor(contract, contract.fulfilled ? undefined : player);
  const classes = [
    "contractRow",
    contract.type === "market" ? "contractRow--market" : "contractRow--private",
    contract.fulfilled ? "contractRow--fulfilled" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <button
        ref={rowRef}
        type="button"
        className={classes}
        disabled={!clickable}
        onClick={clickable ? onToggle : undefined}
        aria-haspopup={clickable ? "menu" : undefined}
        aria-expanded={clickable ? isOpen : undefined}
      >
        <span className="contractRow__main">
          <img className="contractRow__icon" src={(commodityIcons as Record<string, string>)[contract.commodity]} alt="" />
          <span className="contractRow__name">
            {commodityLabel(contract.commodity)} to {contract.destinationKey}
          </span>
          {claimed && <span className="contractRow__chip">Market</span>}
          {contract.roundsLeft !== undefined && contract.playerID === null && (
            <span className={`contractRow__chip contractRow__chip--expiring${contract.roundsLeft <= 1 ? " contractRow__chip--last" : ""}`}>
              {contract.roundsLeft <= 1 ? "Last round" : `${contract.roundsLeft} rounds`}
            </span>
          )}
        </span>
        <span className="contractRow__value">
          {contract.fulfilled ? (
            <span className="contractRow__delivered">Delivered</span>
          ) : (
            <>
              {gross !== null && <s className="contractRow__gross">{formatMoney(gross)}</s>}
              <strong>{formatMoney(net)}</strong>
            </>
          )}
          <span className="contractRow__ties">
            {ties} {ties === 1 ? "tie" : "ties"}
          </span>
        </span>
      </button>
      {clickable && (
        <PopupMenu
          isOpen={isOpen}
          onClose={onClose}
          onCloseOutside={onCloseOutside}
          anchorRef={rowRef}
          placement={{ side: "bottom", align: "end" }}
        >
          {actions.map((action) => (
            <PopupMenuItem
              key={action.label}
              disabled={action.disabled}
              onClick={() => {
                action.onSelect();
                onClose();
              }}
            >
              {action.label}
            </PopupMenuItem>
          ))}
        </PopupMenu>
      )}
    </>
  );
}
