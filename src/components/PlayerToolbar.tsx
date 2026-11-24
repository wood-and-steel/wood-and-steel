import React from "react";
import { contractTies } from "../utils/ties";
import { getOtherPlayerIdsInPlayOrder, getPlayerAvatarColor } from "../utils/playerAvatar";
import { PlayerAvatar } from "./PlayerAvatar";
import type { GameState, GameContext } from "../stores/gameStore";
import { useGameStore } from "../stores/gameStore";
import { formatMoney } from "../utils/money";
import { displayRound } from "../utils/rounds";

export type GamePhase = "setup" | "play" | "scoring";

export interface PlayerToolbarProps {
  G: GameState;
  ctx: GameContext;
  playerID: string | null;
  startingContractExists: boolean;
  currentPhase: GamePhase;
  onOpenActions?: () => void;
  onOpenLoans?: () => void;
  /** Opens another player's card. */
  onOpenPlayer?: (playerID: string) => void;
  /** Opens the latest round report; the round label is disabled without one. */
  onOpenRoundReport?: () => void;
  /** A round report this device hasn't seen yet: the round label shows a dot. */
  roundReportUnseen?: boolean;
}

/**
 * Toolbar shown below NavBar: the player's name, ties, cash and debt, a Loans button (always),
 * the other players with their ties (press one for their card), and on the player's turn Undo,
 * Actions and End Turn. In play, the round label opens the latest round report, with a dot when
 * there's one this device hasn't seen.
 */
export function PlayerToolbar({
  G,
  ctx,
  playerID,
  startingContractExists,
  currentPhase,
  onOpenActions,
  onOpenLoans,
  onOpenPlayer,
  onOpenRoundReport,
  roundReportUnseen,
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
  const playerScore = contractTies(G.contracts, key);
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
            {name}{" "}
            <span className="playerToolbar__score">
              {playerScore} {playerScore === 1 ? "tie" : "ties"}
            </span>
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
                const [, { name: otherName, avatarColor: otherAvatarColor }] = otherPlayer;
                const otherTies = contractTies(G.contracts, otherPlayerId);
                return (
                  <button
                    key={otherPlayerId}
                    type="button"
                    className="playerToolbar__other"
                    aria-label={`${otherName}, ${otherTies} ${otherTies === 1 ? "tie" : "ties"}. Show their board`}
                    onClick={() => onOpenPlayer?.(otherPlayerId)}
                  >
                    <PlayerAvatar
                      name={otherName}
                      avatarColor={getPlayerAvatarColor(otherPlayerId, otherAvatarColor)}
                      isCurrentTurn={otherPlayerId === ctx.currentPlayer}
                    />
                    <span className="playerToolbar__otherTies" aria-hidden="true">
                      {otherTies}
                    </span>
                  </button>
                );
              })}
            </span>
          )}
        </div>
        {(showTurnToolbar || currentPhase === "play") && (
          <div className="playerToolbar__buttonGroup">
            {currentPhase === "play" && (
              <button
                type="button"
                className="playerToolbar__round"
                disabled={!onOpenRoundReport}
                onClick={() => onOpenRoundReport?.()}
                aria-label={`Round ${displayRound(ctx.round)}${roundReportUnseen ? ", new round report" : ""}`}
                title={onOpenRoundReport ? "Show last round's report" : undefined}
              >
                Round {displayRound(ctx.round)}
                {roundReportUnseen && <span className="playerToolbar__roundDot" aria-hidden="true" />}
              </button>
            )}
            {showTurnToolbar && (
              <>
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
                  name="endTurn"
                  className={`button ${currentPhase === "play" && isPlayerTurn ? "" : "button--hidden"}`}
                >
                  End Turn
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
