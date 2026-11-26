import React from "react";
import { getPlayerAvatarColor } from "../utils/playerAvatar";
import { playerTies } from "../utils/ties";
import type { GameState } from "../stores/gameStore";
import { formatMoney } from "../utils/money";
import { ContractRows } from "./ContractRows";
import { EnginesPanel } from "./EnginesPanel";
import { PlayerAvatar } from "./PlayerAvatar";
import { upgradeLabels } from "./PlayerBoard";
import { Sheet } from "./Sheet";

export interface PlayerSheetProps {
  G: GameState;
  playerID: string;
  onClose: () => void;
}

/**
 * Another player's board, as a glance across the table would show it, laid out like Home: a card
 * with where they stand (ties, cash, debt, deliveries, and how far their debt service has
 * advanced), then their engines and any cargo they recorded, their contracts (private and
 * claimed market, valued for them) and their upgrades.
 */
export function PlayerSheet({ G, playerID, onClose }: PlayerSheetProps): React.ReactElement | null {
  const serviceLabelId = React.useId();
  const props = G.players.find(([id]) => id === playerID)?.[1];
  if (!props) return null;
  const contracts = G.contracts.filter((c) => c.playerID === playerID && !c.fulfilled);
  const deliveries = G.contracts.filter((c) => c.playerID === playerID && c.fulfilled).length;
  const upgrades = upgradeLabels(props);
  const stats: { label: string; value: React.ReactNode; className?: string }[] = [
    { label: "Ties", value: playerTies(G.contracts, playerID, props) },
    { label: "Cash", value: formatMoney(props.cash) },
    { label: "Debt", value: formatMoney(props.debt), className: props.debt > 0 ? "playerSheet__value--debt" : undefined },
    { label: "Delivered", value: deliveries },
  ];
  const service = [
    { region: "Central", done: props.centralDebtServicePaid, doneText: "paid", notYetText: "not yet" },
    { region: "Western", done: props.westernDeliveryMade, doneText: "every delivery", notYetText: "not yet" },
  ];

  return (
    <Sheet
      title={
        <span className="playerSheet__title">
          <PlayerAvatar name={props.name} avatarColor={getPlayerAvatarColor(playerID, props.avatarColor)} />
          {props.name}
        </span>
      }
      onClose={onClose}
    >
      <div className="playerSheet">
        {/* Where they stand */}
        <section className="infoCard playerSheet__standing" aria-label="Standing">
          <dl className="playerSheet__stats">
            {stats.map((s) => (
              <div key={s.label} className="playerSheet__stat">
                <dt className="playerSheet__label">{s.label}</dt>
                <dd className={`playerSheet__value${s.className ? ` ${s.className}` : ""}`}>{s.value}</dd>
              </div>
            ))}
          </dl>
          <div className="playerSheet__service">
            <span className="playerSheet__label" id={serviceLabelId}>
              Debt service
            </span>
            <ul className="playerSheet__pills" aria-labelledby={serviceLabelId}>
              {service.map((s) => (
                <li key={s.region} className={`playerSheet__pill${s.done ? " playerSheet__pill--done" : ""}`}>
                  {s.done && (
                    <svg className="playerSheet__check" viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M3 8.5 6.5 12 13 4.5" />
                    </svg>
                  )}
                  {s.region}
                  <span className="visuallyHidden">: {s.done ? s.doneText : s.notYetText}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="infoSection" aria-label="Trains">
          <h3 className="infoSection__heading">Trains</h3>
          <EnginesPanel
            player={props}
            playerID={playerID}
            canEdit={false}
            onSetCargo={() => false}
            label={`${props.name}'s engines`}
          />
        </section>

        <section className="infoSection" aria-label="Contracts">
          <h3 className="infoSection__heading">Contracts</h3>
          <ContractRows contracts={contracts} player={props} emptyText="None right now." />
        </section>

        <section className="infoSection" aria-label="Upgrades">
          <h3 className="infoSection__heading">Upgrades</h3>
          {upgrades.length > 0 ? (
            <div className="upgradeChips">
              {upgrades.map((u) => (
                <span key={u} className="upgradeChips__chip">
                  {u}
                </span>
              ))}
            </div>
          ) : (
            <p className="contractRows__empty">None yet.</p>
          )}
        </section>
      </div>
    </Sheet>
  );
}
