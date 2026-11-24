import React from "react";
import { moneyValue, railroadTieValue, type Contract } from "../Contract";
import type { PlayerProps } from "../stores/gameStore";
import { deliveryRange } from "../rules/finance";
import { commodityIcons, contractTieIcons } from "../shared/assets/icons";
import { formatMoney } from "../utils/money";
export interface ContractRowsProps {
  contracts: Contract[];
  /** The viewing player, for values net of their debt service; omit to show base values. */
  player?: PlayerProps;
  /** What tapping an unfulfilled contract does; omit to make the rows not clickable. */
  onSelect?: (contract: Contract) => void;
  /** Shown when there are no contracts. */
  emptyText: string;
  /** Keep the given order instead of sorting oldest first (e.g. the market, soonest to expire first). */
  keepOrder?: boolean;
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
 * player, struck through to the net when debt service lowers it. Pressing a row calls
 * `onSelect` (the delivery receipt or the claim sheet).
 */
export function ContractRows({ contracts, player, onSelect, emptyText, keepOrder }: ContractRowsProps): React.ReactElement {
  if (contracts.length === 0) return <p className="contractRows__empty">{emptyText}</p>;

  return (
    <div className="contractRows">
      {(keepOrder ? contracts : [...contracts].sort((a, b) => a.creationTime - b.creationTime))
        .map((contract) => (
          <ContractRow
            key={contract.id}
            contract={contract}
            player={player}
            onSelect={onSelect && !contract.fulfilled ? () => onSelect(contract) : undefined}
          />
        ))}
    </div>
  );
}

interface ContractRowProps {
  contract: Contract;
  player?: PlayerProps;
  onSelect?: () => void;
}

function ContractRow({ contract, player, onSelect }: ContractRowProps): React.ReactElement {
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
    <button type="button" className={classes} disabled={!onSelect} onClick={onSelect}>
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
        {!contract.fulfilled && (
          <>
            {gross !== null && <s className="contractRow__gross">{gross}</s>}
            <strong title={byEngine ? "Depends on which engine delivers" : undefined}>{net}</strong>
            <span className="contractRow__dot" aria-hidden="true">
              ·
            </span>
          </>
        )}
        <span className="contractRow__ties">
          {ties}
          <img
            className="contractRow__tieIcon"
            src={(contractTieIcons as Record<string, string>)[String(ties)]}
            alt={ties === 1 ? " tie" : " ties"}
          />
        </span>
      </span>
    </button>
  );
}
