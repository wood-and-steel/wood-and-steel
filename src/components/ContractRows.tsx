import React from "react";
import { moneyValue, railroadTieValue, type Contract } from "../Contract";
import type { PlayerProps } from "../stores/gameStore";
import { deliveryRange } from "../rules/finance";
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

function moneyText(low: number, high: number): string {
  return low === high ? formatMoney(low) : `${formatMoney(low)}–${formatMoney(high)}`;
}

/**
 * What a contract pays the player: the net, and the amount before debt service when that
 * lowers it. A range when their engines would pay differently (a Mountain or Challenger with
 * another engine); `byEngine` says so.
 */
export function payoutFor(contract: Contract, player: PlayerProps | undefined): { net: string; gross: string | null; byEngine: boolean } {
  if (!player) return { net: formatMoney(moneyValue(contract)), gross: null, byEngine: false };
  const { low, high } = deliveryRange(player, contract);
  const gross = (r: typeof low) => r.value + r.engineBonus + r.stationsBonus;
  return {
    net: moneyText(low.net, high.net),
    gross: low.debtService > 0 ? moneyText(gross(low), gross(high)) : null,
    byEngine: low.net !== high.net,
  };
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

  // Forget an open menu whose row is gone, fulfilled, or no longer has actions (e.g. the turn
  // ended), so it doesn't reappear later.
  const openStillValid =
    openId === null ||
    contracts.some((c) => c.id === openId && !c.fulfilled && actionsFor(c).length > 0);
  React.useEffect(() => {
    if (!openStillValid) setOpenId(null);
  }, [openStillValid]);

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
  const { net, gross, byEngine } = payoutFor(contract, contract.fulfilled ? undefined : player);
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
              {gross !== null && <s className="contractRow__gross">{gross}</s>}
              <strong title={byEngine ? "Depends on which engine delivers" : undefined}>{net}</strong>
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
