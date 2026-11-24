import React from "react";
import { moneyValue } from "../Contract";
import { contractTies } from "../utils/ties";
import type { GameState } from "../stores/gameStore";
import { engineDistance, formatCommodity, formatSegments, getEngineType, type EngineSlot } from "../rules/playerBoard";
import { UPGRADE_NAMES, type UpgradeKey } from "../rules/rulesData";
import { formatMoney } from "../utils/money";
import { EngineSlotIcon } from "./EngineIcon";
import { Sheet } from "./Sheet";

export interface PlayerSheetProps {
  G: GameState;
  playerID: string;
  onClose: () => void;
}

const REGION_NAMES: Record<string, string> = {
  NW: "Northwest",
  NC: "North Central",
  NE: "Northeast",
  SW: "Southwest",
  SC: "South Central",
  SE: "Southeast",
};

/**
 * Another player's board, as a glance across the table would show it: money, engines and
 * any cargo they recorded, their claimed market contract, upgrades, and how far their debt
 * service has advanced. Their private contract stays private.
 */
export function PlayerSheet({ G, playerID, onClose }: PlayerSheetProps): React.ReactElement | null {
  const props = G.players.find(([id]) => id === playerID)?.[1];
  if (!props) return null;
  const claimed = G.contracts.find((c) => c.type === "market" && c.playerID === playerID && !c.fulfilled);
  const hasServiceYard = props.upgrades.includes("service-yard");
  const upgrades: string[] = [
    ...(props.hubCity ? [`Hub · ${props.hubCity}`] : []),
    ...props.upgrades.map((u) =>
      u === "commodities-exchange" && props.exchangeCommodity
        ? `${UPGRADE_NAMES[u]} · ${formatCommodity(props.exchangeCommodity)}`
        : UPGRADE_NAMES[u as UpgradeKey]
    ),
    ...(props.regionalOffice ? [`Regional Office · ${REGION_NAMES[props.regionalOffice]}`] : []),
  ];

  return (
    <Sheet title={props.name} onClose={onClose}>
      <div className="playerSheet__stats">
        <div>
          <span className="sheet__label">Cash</span>
          <strong>{formatMoney(props.cash)}</strong>
        </div>
        <div>
          <span className="sheet__label">Debt</span>
          <strong className={props.debt > 0 ? "playerSheet__debt" : ""}>{formatMoney(props.debt)}</strong>
        </div>
        <div>
          <span className="sheet__label">Ties</span>
          <strong>{contractTies(G.contracts, playerID)}</strong>
        </div>
      </div>

      <div className="sheet__subhead">Engines</div>
      <div className="sheet__box">
        {([0, 1] as EngineSlot[]).map((slot) => {
          const type = props.engines[slot];
          const cargo = props.cargo[slot];
          return (
            <div key={slot} className="sheet__row">
              <span className="engineLabel">
                <EngineSlotIcon playerID={playerID} avatarColor={props.avatarColor} slot={slot} />
                {type
                  ? `${getEngineType(type).name} · ${formatSegments(engineDistance(type, hasServiceYard).total)}`
                  : "No engine"}
              </span>
              {type && <span className="sheet__label">{cargo ? formatCommodity(cargo) : "not recorded"}</span>}
            </div>
          );
        })}
      </div>

      <div className="sheet__subhead">Claimed contract</div>
      {claimed ? (
        <div className="sheet__box">
          <div className="sheet__row">
            <span>
              {formatCommodity(claimed.commodity)} to {claimed.destinationKey}
            </span>
            <strong>{formatMoney(moneyValue(claimed))}</strong>
          </div>
        </div>
      ) : (
        <p className="sheet__note">None</p>
      )}

      <div className="sheet__subhead">Upgrades</div>
      {upgrades.length > 0 ? (
        <div className="upgradeChips">
          {upgrades.map((u) => (
            <span key={u} className="upgradeChips__chip">
              {u}
            </span>
          ))}
        </div>
      ) : (
        <p className="sheet__note">None yet</p>
      )}

      <div className="sheet__subhead">Debt service</div>
      <div className="sheet__box">
        <div className="sheet__row">
          <span>{props.centralDebtServicePaid ? "Central paid" : "Central not yet"}</span>
          <span className="sheet__label">{props.westernDeliveryMade ? "West: every delivery" : "West not yet"}</span>
        </div>
      </div>
    </Sheet>
  );
}
