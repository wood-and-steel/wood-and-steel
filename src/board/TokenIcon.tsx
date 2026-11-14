/**
 * HTML-side token pictures (tray and drag ghost). Engines are right triangles in the player's
 * light or dark color; the Railyard is a bold R in the dark color.
 */
import React from 'react';
import type { BoardPlayer } from './boardPlayers';
import { enginePoints, railyardFontSize, tokenLabel, type TokenRef } from './tokens';

export function tokenFill(token: TokenRef, player: BoardPlayer): string {
  return token.kind === 'engine' && token.slot === 0 ? player.light : player.dark;
}

export function TokenIcon({ token, player }: { token: TokenRef; player: BoardPlayer }): React.ReactElement {
  const fill = tokenFill(token, player);
  return token.kind === 'engine' ? (
    <svg className="boardToken boardToken--engine" viewBox="0 0 16 16" aria-hidden="true">
      <polygon points={enginePoints(8, 8, 14)} fill={fill} />
    </svg>
  ) : (
    <svg className="boardToken boardToken--railyard" viewBox="0 0 16 16" aria-hidden="true">
      <text className="boardRailyard" x="8" y="15" fontSize={railyardFontSize(14)} fill={fill}>
        R
      </text>
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
