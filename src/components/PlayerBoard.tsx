import React from "react";
import type { Contract } from "../Contract";
import { ContractRows } from "./ContractRows";
import { EnginesPanel } from "./EnginesPanel";
import type { EngineSlot } from "../rules/playerBoard";
import { formatCommodity } from "../rules/playerBoard";
import { MARKET_CONTRACT_MIN_ENGINE, UPGRADE_NAMES, type UpgradeKey } from "../rules/rulesData";
import { bestEngineLevel, engineLevel } from "../rules/engines";
import type { GameState, GameContext, PlayerProps } from "../stores/gameStore";
import { STARTING_CITY_PAIRS } from "../data/startingRoutes";

export type GamePhase = "setup" | "play" | "scoring";

export interface PlayerBoardProps {
  G: GameState;
  ctx: GameContext;
  playerID: string | null;
  startingContractExists: boolean;
  currentPhase: GamePhase;
  onStartingPairSelect: (pair: [string, string]) => void;
  onOpenPrivateContractModal?: () => void;
  /** Opens the delivery receipt for one of the player's contracts, when they tap it. */
  onToggleFulfilled: (contractID: string) => void;
  /** Opens the claim sheet for an open market contract, when they tap it. */
  onClaimContract?: (contractID: string) => void;
  onSetCargo?: (slot: EngineSlot, commodity: string | null) => boolean;
  /** Opens the Buy an engine sheet, when the player taps one of their engines' names. */
  onOpenBuyEngine?: () => void;
}

const REGION_NAMES: Record<string, string> = {
  NW: "Northwest",
  NC: "North Central",
  NE: "Northeast",
  SW: "Southwest",
  SC: "South Central",
  SE: "Southeast",
};

/** A player's upgrades as short labels, with the Hub city, Exchange commodity and Office region. Home and the player card both list them. */
export function upgradeLabels(player: PlayerProps): string[] {
  return [
    ...(player.hubCity ? [`Hub · ${player.hubCity}`] : []),
    ...player.upgrades.map((u) =>
      u === "commodities-exchange" && player.exchangeCommodity
        ? `${UPGRADE_NAMES[u]} · ${formatCommodity(player.exchangeCommodity)}`
        : UPGRADE_NAMES[u as UpgradeKey]
    ),
    ...(player.regionalOffice ? [`Regional Office · ${REGION_NAMES[player.regionalOffice]}`] : []),
  ];
}

/**
 * Home: during setup, the starting-city choice; in play, a card with the player's engines and
 * contracts, then the market as rows valued for them (high enough to be seen without scrolling
 * on a small phone), then their upgrades and fulfilled contracts. Until they have either, those
 * two fold into one "Your railroad" line, so an early game isn't a column of empty sections.
 */
export function PlayerBoard({
  G,
  ctx,
  playerID,
  currentPhase,
  onStartingPairSelect,
  onToggleFulfilled,
  onClaimContract,
  onSetCargo,
  onOpenBuyEngine,
}: PlayerBoardProps): React.ReactElement | null {
  const effectivePlayerID = playerID ?? ctx.currentPlayer;
  const activePlayer = G.players.find(([key]) => key === effectivePlayerID);
  const isPlayerTurn = playerID === ctx.currentPlayer;

  if (!activePlayer) return null;

  const [key, playerProps] = activePlayer;
  const canAct = isPlayerTurn && playerID === key;

  const getChosenCities = (): Set<string> => {
    const chosenCities = new Set<string>();
    G.players.forEach(([, player]) => {
      player.activeCities.forEach((city) => chosenCities.add(city));
    });
    return chosenCities;
  };

  const chosenCities = currentPhase === "setup" ? getChosenCities() : new Set<string>();

  const isPairChosen = (pair: [string, string]): boolean =>
    chosenCities.has(pair[0]) || chosenCities.has(pair[1]);

  const handlePairClick = (pair: [string, string]) => {
    if (isPairChosen(pair) || !isPlayerTurn) return;
    onStartingPairSelect(pair);
  };

  const mine = G.contracts.filter((c: Contract) => c.playerID === key && !c.fulfilled);
  // Expiring contracts first, soonest to leave the tableau at the top; then oldest first.
  const market = G.contracts
    .filter((c: Contract) => c.type === "market" && c.playerID === null && !c.fulfilled)
    .sort(
      (a: Contract, b: Contract) =>
        (a.roundsLeft ?? Infinity) - (b.roundsLeft ?? Infinity) || a.creationTime - b.creationTime
    );
  const fulfilled = G.contracts.filter((c: Contract) => c.playerID === key && c.fulfilled);
  const upgrades = upgradeLabels(playerProps);
  // The first Mogul anyone buys opens the market; after that an empty tableau just means none are open.
  const marketOpened = G.players.some(
    ([, p]) => bestEngineLevel(p.engines) >= engineLevel(MARKET_CONTRACT_MIN_ENGINE)
  );

  return (
    <div className="playerBoard">
      <div className="playerBoard__player">
        {currentPhase === "setup" && (
          <div className="playerBoard__startingPairs">
            <div className="playerBoard__startingPairsLabel">Choose your starting cities:</div>
            {STARTING_CITY_PAIRS.map((pair, index) => {
              const disabled = isPairChosen(pair) || !isPlayerTurn;
              return (
                <button
                  key={index}
                  type="button"
                  className="button playerBoard__pairButton"
                  disabled={disabled}
                  onClick={() => handlePairClick(pair)}
                >
                  {pair.join(" & ")}
                </button>
              );
            })}
          </div>
        )}
        {currentPhase === "play" && (
          <div className="home">
            {/* What the player acts on each turn, set apart from the market and their history. */}
            <div className="infoCard">
              <section className="infoSection" aria-label="Your train">
                <h3 className="infoSection__heading">Your train</h3>
                <EnginesPanel
                  player={playerProps}
                  playerID={key}
                  canEdit={canAct}
                  onSetCargo={(slot, commodity) => onSetCargo?.(slot, commodity) ?? false}
                  onBuyEngine={canAct ? onOpenBuyEngine : undefined}
                />
              </section>
              <section className="infoSection" aria-label="Your contracts">
                <h3 className="infoSection__heading">Your contracts</h3>
                <ContractRows
                  contracts={mine}
                  player={playerProps}
                  onSelect={canAct ? (c) => onToggleFulfilled(c.id) : undefined}
                  emptyText="No contracts right now."
                />
              </section>
            </div>
            <section className="infoSection" aria-label="Market contracts">
              <h3 className="infoSection__heading">Market</h3>
              <ContractRows
                contracts={market}
                player={playerProps}
                onSelect={canAct && onClaimContract ? (c) => onClaimContract(c.id) : undefined}
                emptyText={marketOpened ? "No open market contracts." : "The market opens when someone buys a Mogul."}
                keepOrder
              />
            </section>
            {upgrades.length === 0 && fulfilled.length === 0 ? (
              // Early on, one line instead of two empty sections; they split once either has something.
              <section className="infoSection" aria-label="Your railroad">
                <h3 className="infoSection__heading">Your railroad</h3>
                <p className="infoSection__summary">No upgrades yet · No deliveries yet</p>
              </section>
            ) : (
              <>
                <section className="infoSection" aria-label="Your upgrades">
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
                    <p className="contractRows__empty">None yet. Buy them from Actions.</p>
                  )}
                </section>
                <section className="infoSection" aria-label="Fulfilled contracts">
                  <h3 className="infoSection__heading">Fulfilled</h3>
                  <ContractRows contracts={fulfilled} emptyText="None yet." />
                </section>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
