/**
 * Edit a route's owners (docs/archived/BOARD_APP_PLAN.md, Interactions): set the primary owner,
 * toggle parallel owners, or unclaim. Every click applies at once; there is no confirm.
 * Positioned with CSS custom properties set from a ref (no inline style objects).
 */
import React from 'react';
import { routes } from '../data/routes';
import { getAvatarTextColor, getPlayerInitials } from '../utils/playerAvatar';
import { MAX_ROUTE_OWNERS } from './boardOps';
import type { BoardPlayer } from './boardPlayers';
import { useBoardPopover } from './useBoardPopover';

interface RoutePopoverProps {
  routeKey: string;
  owners: string[];
  /** Players in play order */
  players: BoardPlayer[];
  /** Player to suggest as a parallel owner, or null outside the play phase */
  currentPlayer: string | null;
  clientX: number;
  clientY: number;
  onChange: (owners: string[]) => void;
  onClose: () => void;
}

interface SwatchButtonProps {
  player: BoardPlayer;
  pressed: boolean;
  disabled?: boolean;
  suggested?: boolean;
  autoFocus?: boolean;
  onClick: () => void;
}

function SwatchButton({ player, pressed, disabled, suggested, autoFocus, onClick }: SwatchButtonProps): React.ReactElement {
  const classes = ['routePopover__swatch'];
  if (pressed) classes.push('routePopover__swatch--pressed');
  if (suggested) classes.push('routePopover__swatch--suggested');
  return (
    <button
      type="button"
      className={classes.join(' ')}
      aria-pressed={pressed}
      aria-label={player.name}
      title={player.name}
      disabled={disabled}
      autoFocus={autoFocus}
      onClick={onClick}
    >
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <circle cx="14" cy="14" r="13" fill={player.color} />
        <text x="14" y="14" dy="0.35em" textAnchor="middle" fill={getAvatarTextColor(player.color)}>
          {getPlayerInitials(player.name)}
        </text>
      </svg>
    </button>
  );
}

export function RoutePopover({
  routeKey,
  owners,
  players,
  currentPlayer,
  clientX,
  clientY,
  onChange,
  onClose,
}: RoutePopoverProps): React.ReactElement {
  const ref = React.useRef<HTMLDivElement>(null);
  const placed = useBoardPopover(ref, clientX, clientY, onClose);
  const route = routes.get(routeKey);
  const primary = owners[0] ?? null;
  const parallel = owners.slice(1);
  const full = owners.length >= MAX_ROUTE_OWNERS;
  const suggestParallel = currentPlayer !== null && primary !== null && !owners.includes(currentPlayer) && !full;

  const setPrimary = (id: string) => {
    if (id !== primary) onChange([id, ...parallel.filter((o) => o !== id)]);
  };
  const toggleParallel = (id: string) => {
    onChange(parallel.includes(id) ? owners.filter((o) => o !== id) : [...owners, id]);
  };

  return (
    <div
      ref={ref}
      className={`routePopover${placed ? ' routePopover--placed' : ''}`}
      role="dialog"
      aria-label={`Route ${routeKey}`}
    >
      <header className="routePopover__header">
        <span className="routePopover__title">{routeKey}</span>
        {route && (
          <span className="routePopover__meta">
            length {route.length}
            {route.mountainous ? ', mountainous' : ''}
          </span>
        )}
        <button type="button" className="routePopover__close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </header>

      <div className="routePopover__row" role="group" aria-label="Owner">
        <span className="routePopover__label">Owner</span>
        {players.map((player) => (
          <SwatchButton
            key={player.id}
            player={player}
            pressed={player.id === primary}
            autoFocus={!suggestParallel && player.id === (primary ?? currentPlayer)}
            onClick={() => setPrimary(player.id)}
          />
        ))}
      </div>

      <div className="routePopover__row" role="group" aria-label="Parallel">
        <span className="routePopover__label">Parallel</span>
        {players
          .filter((player) => player.id !== primary)
          .map((player) => {
            const pressed = parallel.includes(player.id);
            const suggested = suggestParallel && player.id === currentPlayer;
            return (
              <SwatchButton
                key={player.id}
                player={player}
                pressed={pressed}
                disabled={primary === null || (!pressed && full)}
                suggested={suggested}
                autoFocus={suggested}
                onClick={() => toggleParallel(player.id)}
              />
            );
          })}
      </div>

      <div className="routePopover__actions">
        <button
          type="button"
          className="button"
          disabled={owners.length === 0}
          onClick={() => {
            onChange([]);
            onClose();
          }}
        >
          Unclaim
        </button>
      </div>
    </div>
  );
}
