/**
 * Board chrome: the slim top bar (game, phase, round, current player, sync, zoom) and the
 * player tray strip (unplaced engines and Railyard per player).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import type { GameContext } from '../stores/gameStore';
import { formatPhase, type BoardPlayer } from './boardPlayers';
import type { BoardSyncStatus } from './useBoardGameSync';
import type { ZoomPan } from './useZoomPan';

const SYNC_LABELS: Record<BoardSyncStatus, string> = {
  loading: 'Connecting…',
  live: 'Live',
  'not-found': 'Game not found',
  error: 'Sync error',
};

function Swatch({ color }: { color: string }): React.ReactElement {
  return (
    <svg className="boardSwatch" viewBox="0 0 10 10" aria-hidden="true">
      <circle cx="5" cy="5" r="5" fill={color} />
    </svg>
  );
}

interface BoardTopBarProps {
  code: string;
  ctx: GameContext;
  players: BoardPlayer[];
  status: BoardSyncStatus;
  zoomPan: ZoomPan;
}

export function BoardTopBar({ code, ctx, players, status, zoomPan }: BoardTopBarProps): React.ReactElement {
  const current = players.find((p) => p.id === ctx.currentPlayer);
  return (
    <header className="boardTopBar">
      <Link className="boardTopBar__code" to="/board" title="Choose another game">
        {code}
      </Link>
      <span className="boardTopBar__item">
        <span className="boardTopBar__label">Phase</span> {formatPhase(ctx.phase)}
      </span>
      <span className="boardTopBar__item">
        <span className="boardTopBar__label">Round</span> {ctx.round ?? '—'}
      </span>
      <span className="boardTopBar__item">
        <span className="boardTopBar__label">Current</span>{' '}
        {current ? (
          <>
            <Swatch color={current.color} /> {current.name}
          </>
        ) : (
          '—'
        )}
      </span>
      <span className={`boardTopBar__sync boardTopBar__sync--${status}`}>{SYNC_LABELS[status]}</span>
      <span className="boardTopBar__zoom" role="group" aria-label="Zoom">
        <button className="button" type="button" onClick={zoomPan.zoomOut} aria-label="Zoom out">
          −
        </button>
        <span className="boardTopBar__zoomLevel">{Math.round(zoomPan.zoom * 100)}%</span>
        <button className="button" type="button" onClick={zoomPan.zoomIn} aria-label="Zoom in">
          +
        </button>
        <button className="button" type="button" onClick={zoomPan.reset}>
          Fit width
        </button>
      </span>
    </header>
  );
}

function EngineToken({ fill, label }: { fill: string; label: string }): React.ReactElement {
  return (
    <svg className="boardToken boardToken--engine" viewBox="0 0 24 16" role="img" aria-label={label}>
      <title>{label}</title>
      <rect x="1" y="1" width="22" height="14" rx="3" fill={fill} />
    </svg>
  );
}

function RailyardToken({ fill, label }: { fill: string; label: string }): React.ReactElement {
  return (
    <svg className="boardToken boardToken--railyard" viewBox="0 0 16 16" role="img" aria-label={label}>
      <title>{label}</title>
      <circle cx="8" cy="8" r="7" fill={fill} />
    </svg>
  );
}

interface PlayerTraysProps {
  players: BoardPlayer[];
  currentPlayer: string;
}

/** M1: no board state yet, so every engine and Railyard is shown in its tray. */
export function PlayerTrays({ players, currentPlayer }: PlayerTraysProps): React.ReactElement {
  return (
    <footer className="boardTrays">
      {players.map((player) => (
        <section
          key={player.id}
          className={`boardTray${player.id === currentPlayer ? ' boardTray--current' : ''}`}
          aria-label={`${player.name}'s tray`}
        >
          <span className="boardTray__name">
            <Swatch color={player.color} /> {player.name}
          </span>
          <span className="boardTray__tokens">
            <EngineToken fill={player.light} label="Light engine" />
            <EngineToken fill={player.dark} label="Dark engine" />
            <RailyardToken fill={player.dark} label="Railyard" />
          </span>
        </section>
      ))}
    </footer>
  );
}
