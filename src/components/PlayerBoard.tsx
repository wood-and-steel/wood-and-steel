import React from "react";
import { railroadTieValue } from "../Contract";
import { ContractsList } from "./ContractsList";
import type { GameState, GameContext } from "../stores/gameStore";

const STARTING_CITY_PAIRS: [string, string][] = [
  ["Montreal", "Quebec City"],
  ["Boston", "Portland ME"],
  ["New York", "Philadelphia"],
  ["Philadelphia", "Washington"],
  ["Norfolk", "Raleigh"],
  ["Charleston", "Savannah"],
];

export type GamePhase = "setup" | "play" | "scoring";

export interface PlayerBoardProps {
  G: GameState;
  ctx: GameContext;
  playerID: string | null;
  isBYODMode?: boolean;
  startingContractExists: boolean;
  currentPhase: GamePhase;
  onStartingPairSelect: (pair: [string, string]) => void;
  onOpenPrivateContractModal?: (offerCount: number) => void;
  onToggleFulfilled: (contractID: string) => void;
  onDelete: (contractID: string) => void;
  onClaimContract?: (contractID: string) => void;
}

/**
 * Displays the active player's board with contracts, action buttons, and starting city selection.
 */
export function PlayerBoard({
  G,
  ctx,
  playerID,
  isBYODMode = false,
  startingContractExists,
  currentPhase,
  onStartingPairSelect,
  onOpenPrivateContractModal,
  onToggleFulfilled,
  onDelete,
  onClaimContract,
}: PlayerBoardProps): React.ReactElement | null {
  const effectivePlayerID = isBYODMode && playerID != null ? playerID : ctx.currentPlayer;
  const activePlayer = G.players.find(([key]) => key === effectivePlayerID);
  const isPlayerTurn = !isBYODMode || playerID === ctx.currentPlayer;
  const currentPlayerEntry = G.players.find(([id]) => id === ctx.currentPlayer);
  const currentPlayerName = currentPlayerEntry?.[1]?.name ?? `Player ${ctx.currentPlayer}`;
  const showTurnIndicator = isBYODMode && !isPlayerTurn;

  if (!activePlayer) return null;

  const [key, { name }] = activePlayer;
  const contracts = G.contracts;
  const playerScore = contracts
    .filter((contract) => contract.playerID === key && contract.fulfilled)
    .reduce((sum, contract) => sum + railroadTieValue(contract), 0);

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

  return (
    <div className="playerBoard">
      <div className="playerBoard__player">
        <div className="playerBoard__info playerBoard__info--active">
          <div className="playerBoard__name playerBoard__name--active">
            {name} <span className="playerBoard__score">(Score: {playerScore})</span>
          </div>
          {showTurnIndicator ? (
            <div className="playerBoard__turnIndicator">
              {currentPlayerName} is taking their turn
            </div>
          ) : (
            <div className="playerBoard__buttonGroup">
              <button
                type="button"
                name="privateContract2"
                className={`button ${startingContractExists && isPlayerTurn ? "" : "button--hidden"}`}
                onClick={() => onOpenPrivateContractModal?.(2)}
              >
                +2P
              </button>
              <button
                type="button"
                name="privateContract3"
                className={`button ${startingContractExists && isPlayerTurn ? "" : "button--hidden"}`}
                onClick={() => onOpenPrivateContractModal?.(3)}
              >
                +3P
              </button>
              <button
                name="marketContract"
                className={`button ${currentPhase === "play" && isPlayerTurn ? "" : "button--hidden"}`}
              >
                +1M
              </button>
              <button
                name="endTurn"
                className={`button ${currentPhase === "play" && isPlayerTurn ? "" : "button--hidden"}`}
              >
                End Turn
              </button>
            </div>
          )}
        </div>

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
        <div className={`playerBoard__contracts ${currentPhase === "play" ? "" : "hidden"}`}>
          <h3 className="playerBoard__contractsTitle">Private</h3>
          <ContractsList
            G={G}
            ctx={ctx}
            type="private"
            playerID={key}
            onToggleFulfilled={onToggleFulfilled}
            onDelete={onDelete}
            onClaimContract={onClaimContract}
          />
          <h3 className="playerBoard__contractsTitle">Market</h3>
          <ContractsList
            G={G}
            ctx={ctx}
            type="market"
            playerID={key}
            onToggleFulfilled={onToggleFulfilled}
            onDelete={onDelete}
            onClaimContract={onClaimContract}
          />
          <h3 className="playerBoard__contractsTitle">Fulfilled</h3>
          <ContractsList
            G={G}
            ctx={ctx}
            type="fulfilled"
            playerID={key}
            onToggleFulfilled={onToggleFulfilled}
            onDelete={onDelete}
            onClaimContract={onClaimContract}
          />
        </div>
      </div>
    </div>
  );
}
