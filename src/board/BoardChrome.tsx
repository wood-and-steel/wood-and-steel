/**
 * Board chrome: the slim top bar (game, phase, round, current player, sync, zoom).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import type { GameContext } from '../stores/gameStore';
import { formatPhase, type BoardPlayer } from './boardPlayers';
import type { BoardStateStatus } from './boardStore';
import type { BoardSyncStatus } from './useBoardGameSync';
import type { ZoomPan } from './useZoomPan';

const SYNC_LABELS: Record<BoardSyncStatus, string> = {
  loading: 'Connecting…',
  live: 'Live',
  'not-found': 'Game not found',
  error: 'Sync error',
};

const BOARD_STATUS_LABELS: Record<BoardStateStatus, string> = {
  idle: '',
  loading: 'Loading board…',
  unseeded: 'Board waits for setup',
  ready: 'Board saved',
  error: 'Board error',
};

export function Swatch({ color }: { color: string }): React.ReactElement {
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
  boardStatus: BoardStateStatus;
  /** Board ops not yet saved */
  pendingCount: number;
  zoomPan: ZoomPan;
}

export function BoardTopBar({
  code,
  ctx,
  players,
  status,
  boardStatus,
  pendingCount,
  zoomPan,
}: BoardTopBarProps): React.ReactElement {
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
      <span className={`boardTopBar__boardStatus boardTopBar__boardStatus--${boardStatus}`}>
        {boardStatus === 'ready' && pendingCount > 0 ? 'Saving board…' : BOARD_STATUS_LABELS[boardStatus]}
      </span>
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
