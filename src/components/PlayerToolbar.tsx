import React from "react";
import { railroadTieValue } from "../Contract";
import { getPlayerAvatarColor } from "../utils/playerAvatar";
import { PlayerAvatar } from "./PlayerAvatar";
import type { GameState, GameContext } from "../stores/gameStore";
import { useGameStore } from "../stores/gameStore";

export type GamePhase = "setup" | "play" | "scoring";

export interface PlayerToolbarProps {
  G: GameState;
  ctx: GameContext;
  playerID: string | null;
  isBYODMode?: boolean;
  startingContractExists: boolean;
  currentPhase: GamePhase;
  onOpenPrivateContractModal?: () => void;
}

/**
 * Toolbar shown below NavBar: current player name, score, turn indicator or action buttons (Undo, +P, +M, End Turn).
 */
export function PlayerToolbar({
  G,
  ctx,
  playerID,
  isBYODMode = false,
  startingContractExists,
  currentPhase,
  onOpenPrivateContractModal,
}: PlayerToolbarProps): React.ReactElement | null {
  const effectivePlayerID = isBYODMode && playerID != null ? playerID : ctx.currentPlayer;
  const activePlayer = G.players.find(([key]) => key === effectivePlayerID);
  const isPlayerTurn = !isBYODMode || playerID === ctx.currentPlayer;
  const currentPlayerEntry = G.players.find(([id]) => id === ctx.currentPlayer);
  const currentPlayerName = currentPlayerEntry?.[1]?.name ?? `Player ${ctx.currentPlayer}`;
  const showTurnIndicator = isBYODMode && !isPlayerTurn;

  const hasMovedThisTurn = useGameStore((s) => s.hasMovedThisTurn);
  const turnStartSnapshot = useGameStore((s) => s.turnStartSnapshot);
  const undoCurrentTurn = useGameStore((s) => s.undoCurrentTurn);
  const canUndo =
    currentPhase === "play" &&
    isPlayerTurn &&
    turnStartSnapshot != null &&
    hasMovedThisTurn;

  if (!activePlayer) return null;

  const [key, { name, avatarColor }] = activePlayer;
  const contracts = G.contracts;
  const playerScore = contracts
    .filter((contract) => contract.playerID === key && contract.fulfilled)
    .reduce((sum, contract) => sum + railroadTieValue(contract), 0);

  return (
    <div className="playerToolbar">
      <div className="playerToolbar__info playerToolbar__info--active">
        <div className="playerToolbar__name playerToolbar__name--active">
          <PlayerAvatar name={name} avatarColor={getPlayerAvatarColor(key, avatarColor)} />
          <span>
            {name} <span className="playerToolbar__score">(Score: {playerScore})</span>
          </span>
        </div>
        {showTurnIndicator ? (
          <div className="playerToolbar__turnIndicator">
            {currentPlayerName} is taking their turn
          </div>
        ) : (
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
              name="privateContract"
              className={`button ${startingContractExists && isPlayerTurn ? "" : "button--hidden"}`}
              onClick={() => onOpenPrivateContractModal?.()}
            >
              +P
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
        )}
      </div>
    </div>
  );
}
