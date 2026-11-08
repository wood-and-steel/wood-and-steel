/**
 * HTML-side token pictures (tray and drag ghost). Engines are rounded blocks in the light or
 * dark shade of the player hue; the Railyard is a disc in the dark shade.
 */
import React from 'react';
import type { BoardPlayer } from './boardPlayers';
import { tokenLabel, type TokenRef } from './tokens';

export function tokenFill(token: TokenRef, player: BoardPlayer): string {
  return token.kind === 'engine' && token.slot === 0 ? player.light : player.dark;
}

export function TokenIcon({ token, player }: { token: TokenRef; player: BoardPlayer }): React.ReactElement {
  const fill = tokenFill(token, player);
  return token.kind === 'engine' ? (
    <svg className="boardToken boardToken--engine" viewBox="0 0 24 16" aria-hidden="true">
      <rect x="1" y="1" width="22" height="14" rx="3" fill={fill} />
    </svg>
  ) : (
    <svg className="boardToken boardToken--railyard" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill={fill} />
    </svg>
  );
}

/** Follows the pointer while a token is dragged; positioned through CSS custom properties. */
export function TokenGhost({
  token,
  player,
  clientX,
  clientY,
}: {
  token: TokenRef;
  player: BoardPlayer;
  clientX: number;
  clientY: number;
}): React.ReactElement {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    ref.current?.style.setProperty('--token-ghost-x', `${clientX}px`);
    ref.current?.style.setProperty('--token-ghost-y', `${clientY}px`);
  }, [clientX, clientY]);
  return (
    <div ref={ref} className="tokenGhost" aria-hidden="true" data-token-ghost={tokenLabel(token)}>
      <TokenIcon token={token} player={player} />
    </div>
  );
}
