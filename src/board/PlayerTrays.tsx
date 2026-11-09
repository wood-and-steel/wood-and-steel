/**
 * Player trays: the column beside the map with one card per player, in play order.
 * Each tray shows the player's engines and Railyard that are not on the board.
 */
import React from 'react';
import { Swatch } from './BoardChrome';
import type { BoardPlayer } from './boardPlayers';
import type { BoardState } from './boardOps';
import { TokenIcon } from './TokenIcon';
import { sameToken, tokenCity, tokenId, tokenLabel, type TokenRef } from './tokens';

interface PlayerTraysProps {
  players: BoardPlayer[];
  currentPlayer: string;
  /** Null until board state loads; every token is then shown in its tray. */
  board: BoardState | null;
  /** Token being dragged, shown dimmed in place */
  dragging: TokenRef | null;
  /** True while a dragged token would drop back into its tray */
  dropTarget: boolean;
  /** Null when tokens can't be moved yet (board state not ready) */
  onTokenPointerDown: ((token: TokenRef, event: React.PointerEvent<Element>) => void) | null;
}

export function PlayerTrays({
  players,
  currentPlayer,
  board,
  dragging,
  dropTarget,
  onTokenPointerDown,
}: PlayerTraysProps): React.ReactElement {
  return (
    <aside
      className={`boardTrays${dropTarget ? ' boardTrays--dropTarget' : ''}`}
      aria-label="Player trays"
      data-token-drop="tray"
    >
      {players.map((player) => {
        const tokens: TokenRef[] = [
          { kind: 'engine', playerID: player.id, slot: 0 },
          { kind: 'engine', playerID: player.id, slot: 1 },
          { kind: 'railyard', playerID: player.id },
        ];
        const inTray = tokens.filter((token) => tokenCity(board, token) === null);
        return (
          <section
            key={player.id}
            className={`boardTray${player.id === currentPlayer ? ' boardTray--current' : ''}`}
            aria-label={`${player.name}'s tray`}
          >
            <span className="boardTray__name">
              <Swatch color={player.color} /> {player.name}
            </span>
            <span className="boardTray__tokens">
              {inTray.map((token) => (
                <button
                  key={tokenId(token)}
                  type="button"
                  className={`boardTray__token${sameToken(dragging, token) ? ' boardTray__token--dragging' : ''}`}
                  aria-label={`${player.name}'s ${tokenLabel(token)}`}
                  title={`${tokenLabel(token)}: drag onto a city`}
                  data-token={tokenId(token)}
                  disabled={!onTokenPointerDown}
                  onPointerDown={onTokenPointerDown ? (event) => onTokenPointerDown(token, event) : undefined}
                >
                  <TokenIcon token={token} player={player} />
                </button>
              ))}
            </span>
          </section>
        );
      })}
    </aside>
  );
}
