import React from "react";
import { railroadTieValue } from "../Contract";
import { getOtherPlayerIdsInPlayOrder, getPlayerAvatarColor } from "../utils/playerAvatar";
import { PlayerAvatar } from "./PlayerAvatar";
import type { GameState, GameContext } from "../stores/gameStore";
import { useGameStore } from "../stores/gameStore";
import { formatMoney } from "../utils/money";

export type GamePhase = "setup" | "play" | "scoring";

export interface PlayerToolbarProps {
  G: GameState;
  ctx: GameContext;
  playerID: string | null;
  startingContractExists: boolean;
  currentPhase: GamePhase;
  onOpenActions?: () => void;
  onOpenLoans?: () => void;
}

/**
 * Toolbar shown below NavBar: the player's name, ties, cash and debt, a Loans button (always),
 * and on their turn Undo, Actions, +M and End Turn.
 */
export function PlayerToolbar({
  G,
  ctx,
  playerID,
  startingContractExists,
  currentPhase,
  onOpenActions,
  onOpenLoans,
}: PlayerToolbarProps): React.ReactElement | null {
  const effectivePlayerID = playerID ?? ctx.currentPlayer;
  const activePlayer = G.players.find(([key]) => key === effectivePlayerID);
  const isPlayerTurn = playerID === ctx.currentPlayer;
  const currentPlayerEntry = G.players.find(([id]) => id === ctx.currentPlayer);
  const currentPlayerName = currentPlayerEntry?.[1]?.name ?? `Player ${ctx.currentPlayer}`;
  const showTurnToolbar = isPlayerTurn;

  const hasMovedThisTurn = useGameStore((s) => s.hasMovedThisTurn);
  const turnStartSnapshot = useGameStore((s) => s.turnStartSnapshot);
  const undoCurrentTurn = useGameStore((s) => s.undoCurrentTurn);
  const canUndo =
    currentPhase === "play" &&
    isPlayerTurn &&
    turnStartSnapshot != null &&
    hasMovedThisTurn;

  if (!activePlayer) return null;

  const [key, { name, avatarColor, cash, debt }] = activePlayer;
  const contracts = G.contracts;
  const playerScore = contracts
    .filter((contract) => contract.playerID === key && contract.fulfilled)
    .reduce((sum, contract) => sum + railroadTieValue(contract), 0);
  const otherPlayerIds = getOtherPlayerIdsInPlayOrder(key, ctx.playOrder);

  return (
    <div className="playerToolbar">
      <div className="playerToolbar__info playerToolbar__info--active">
        <div className="playerToolbar__name playerToolbar__name--active">
          <PlayerAvatar
            name={name}
            avatarColor={getPlayerAvatarColor(key, avatarColor)}
            isCurrentTurn={key === ctx.currentPlayer}
          />
          <span>
            {name} <span className="playerToolbar__score">(Score: {playerScore})</span>
          </span>
          {currentPhase === "play" && (
            <span className="playerToolbar__money">
              <span className="playerToolbar__cash" aria-label="Cash">
                {formatMoney(cash)}
              </span>
              {debt > 0 && (
                <span className="playerToolbar__debt" aria-label="Debt">
                  ({formatMoney(debt)} debt)
                </span>
              )}
              <button type="button" className="button playerToolbar__loans" onClick={() => onOpenLoans?.()}>
                Loans
              </button>
            </span>
          )}
          {otherPlayerIds.length > 0 && (
            <span className="playerToolbar__otherAvatars">
              {otherPlayerIds.map((otherPlayerId) => {
                const otherPlayer = G.players.find(([id]) => id === otherPlayerId);
                if (!otherPlayer) return null;
                const [, { name: otherName, avatarColor: otherAvatarColor, cash: otherCash, debt: otherDebt }] = otherPlayer;
                const otherMoney = `${formatMoney(otherCash)}${otherDebt > 0 ? `, ${formatMoney(otherDebt)} debt` : ""}`;
                return (
                  <PlayerAvatar
                    key={otherPlayerId}
                    name={otherName}
                    avatarColor={getPlayerAvatarColor(otherPlayerId, otherAvatarColor)}
                    title={`${otherName}: ${otherMoney}`}
                    isCurrentTurn={otherPlayerId === ctx.currentPlayer}
                  />
                );
              })}
            </span>
          )}
        </div>
        {showTurnToolbar ? (
          <div className="playerToolbar__buttonGroup">
            <button
              type="button"
              name="undo"
              aria-label="Undo all actions this turn"
              className={`button playerToolbar__undo ${currentPhase === "play" && isPlayerTurn ? "" : "button--hidden"}`}
              disabled={!canUndo}
              onClick={() => undoCurrentTurn()}
            >
              Undo
            </button>
            <button
              type="button"
              name="actions"
              className={`button ${startingContractExists && currentPhase === "play" && isPlayerTurn ? "" : "button--hidden"}`}
              onClick={() => onOpenActions?.()}
            >
              Actions
            </button>
            <button
              type="submit"
              name="marketContract"
              className={`button ${currentPhase === "play" && isPlayerTurn ? "" : "button--hidden"}`}
            >
              +M
            </button>
            <button
              type="submit"
              name="endTurn"
              className={`button ${currentPhase === "play" && isPlayerTurn ? "" : "button--hidden"}`}
            >
              End Turn
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
