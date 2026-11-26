import React from "react";
import { playerTies } from "../utils/ties";
import { getPlayerAvatarColor } from "../utils/playerAvatar";
import { PlayerAvatar } from "./PlayerAvatar";
import type { GameState, GameContext } from "../stores/gameStore";
import { useGameStore } from "../stores/gameStore";
import { displayRound } from "../utils/rounds";

export type GamePhase = "setup" | "play" | "scoring";

export interface PlayerToolbarProps {
  G: GameState;
  ctx: GameContext;
  playerID: string | null;
  startingContractExists: boolean;
  currentPhase: GamePhase;
  onOpenActions?: () => void;
  /** Opens another player's card. */
  onOpenPlayer?: (playerID: string) => void;
  /** Opens the latest round report; the round label is disabled without one. */
  onOpenRoundReport?: () => void;
  /** A round report this device hasn't seen yet: the round label shows a dot. */
  roundReportUnseen?: boolean;
}

const tiesLabel = (ties: number) => `${ties} ${ties === 1 ? "tie" : "ties"}`;

/**
 * Sticky toolbar below the money strip (MoneyStrip), in two strips that keep their shape whatever
 * the player count:
 * - Table: every player in play order with their ties, the current one's avatar pulsing; press
 *   another player for their card. In play, the round label at the end opens the latest round
 *   report, with a dot when there's one this device hasn't seen.
 * - Turn: on the player's turn in play, Undo, Actions and End Turn; otherwise whose turn it is.
 */
export function PlayerToolbar({
  G,
  ctx,
  playerID,
  startingContractExists,
  currentPhase,
  onOpenActions,
  onOpenPlayer,
  onOpenRoundReport,
  roundReportUnseen,
}: PlayerToolbarProps): React.ReactElement | null {
  const myID = playerID ?? ctx.currentPlayer;
  const me = G.players.find(([id]) => id === myID);
  const isMyTurn = playerID === ctx.currentPlayer;
  const isPlay = currentPhase === "play";

  const hasMovedThisTurn = useGameStore((s) => s.hasMovedThisTurn);
  const turnStartSnapshot = useGameStore((s) => s.turnStartSnapshot);
  const undoCurrentTurn = useGameStore((s) => s.undoCurrentTurn);
  const canUndo = isPlay && isMyTurn && turnStartSnapshot != null && hasMovedThisTurn;

  if (!me) return null;

  const currentName = G.players.find(([id]) => id === ctx.currentPlayer)?.[1]?.name ?? `Player ${ctx.currentPlayer}`;
  const seatIds = ctx.playOrder.filter((id) => G.players.some(([pid]) => pid === id));

  return (
    <div className="playerToolbar">
      <div className="playerToolbar__strip playerToolbar__strip--table">
        <span className="playerToolbar__players">
          {seatIds.map((id) => {
            const [, seatProps] = G.players.find(([pid]) => pid === id)!;
            const { name: seatName, avatarColor: seatColor } = seatProps;
            const ties = playerTies(G.contracts, id, seatProps);
            const avatar = (
              <PlayerAvatar
                name={seatName}
                avatarColor={getPlayerAvatarColor(id, seatColor)}
                isCurrentTurn={id === ctx.currentPlayer}
              />
            );
            const tiesCount = (
              <span className="playerToolbar__ties" aria-hidden="true">
                {ties}
              </span>
            );
            return id === myID ? (
              <span key={id} className="playerToolbar__seat" role="img" aria-label={`You, ${tiesLabel(ties)}`}>
                {avatar}
                {tiesCount}
              </span>
            ) : (
              <button
                key={id}
                type="button"
                className="plainButton playerToolbar__seat playerToolbar__seat--other"
                aria-label={`${seatName}, ${tiesLabel(ties)}. Show their board`}
                onClick={() => onOpenPlayer?.(id)}
              >
                {avatar}
                {tiesCount}
              </button>
            );
          })}
        </span>
        {isPlay && (
          <button
            type="button"
            className="plainButton playerToolbar__round"
            disabled={!onOpenRoundReport}
            onClick={() => onOpenRoundReport?.()}
            aria-label={`Round ${displayRound(ctx.round)}${roundReportUnseen ? ", new round report" : ""}`}
            title={onOpenRoundReport ? "Show last round's report" : undefined}
          >
            Round {displayRound(ctx.round)}
            {roundReportUnseen && <span className="playerToolbar__roundDot" aria-hidden="true" />}
          </button>
        )}
      </div>

      <div className="playerToolbar__strip playerToolbar__strip--turn">
        {isMyTurn && isPlay ? (
          <>
            <button
              type="button"
              name="undo"
              aria-label="Undo all actions this turn"
              className="playerToolbar__turnButton playerToolbar__turnButton--undo"
              disabled={!canUndo}
              onClick={() => undoCurrentTurn()}
            >
              <svg className="playerToolbar__turnIcon" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M5.5 3 2.5 6l3 3M2.5 6H10a3.5 3.5 0 0 1 0 7H6.5" />
              </svg>
              Undo
            </button>
            <span className="playerToolbar__turnButtons">
              {startingContractExists && (
                <button
                  type="button"
                  name="actions"
                  className="playerToolbar__turnButton"
                  onClick={() => onOpenActions?.()}
                >
                  <svg className="playerToolbar__turnIcon" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M6 4h7.5M6 8h7.5M6 12h7.5M2.75 4h.01M2.75 8h.01M2.75 12h.01" />
                  </svg>
                  Actions
                </button>
              )}
              <button
                type="submit"
                name="endTurn"
                className="playerToolbar__turnButton playerToolbar__turnButton--commit"
              >
                End Turn
                <svg className="playerToolbar__turnIcon" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M2.5 8h8M7.5 4.5 11 8l-3.5 3.5M13.5 3v10" />
                </svg>
              </button>
            </span>
          </>
        ) : (
          <span className="playerToolbar__whoseTurn">{isMyTurn ? "Your turn" : `${currentName}'s turn`}</span>
        )}
      </div>
    </div>
  );
}
