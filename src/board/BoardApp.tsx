/**
 * Playtest board app at /board?game=CODE (docs/archived/BOARD_APP_PLAN.md).
 * Lazy-loaded behind __INCLUDE_BOARD__; the main app imports nothing from src/board/.
 * Read-only with respect to G/ctx: it shows game state but never changes it.
 */
import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import '../shared/styles/board.css';
import { useGameStore } from '../stores/gameStore';
import { listGames } from '../utils/gameManager';
import type { GameListItem } from '../utils/storage/storageAdapter';
import { BoardMap, type RouteClick } from './BoardMap';
import { RoutePopover } from './RoutePopover';
import { TokenGhost } from './TokenIcon';
import { layoutTokens, moveTokenOp, tokenCity, type TokenRef } from './tokens';
import { useTokenDrag } from './useTokenDrag';
import { dispatchBoardOp } from './boardSync';
import { BoardTopBar } from './BoardChrome';
import { PlayerTrays } from './PlayerTrays';
import { formatPhase, getBoardPlayers, type BoardPlayer } from './boardPlayers';
import { useBoardStore } from './boardStore';
import { useBoardGameSync } from './useBoardGameSync';
import { useBoardStateSync } from './useBoardStateSync';
import { useZoomPan } from './useZoomPan';
import { useBotNarration } from './useBotNarration';
import { botTrayInfo } from './botNarration';

const EMPTY_TRACK: Record<string, string[]> = {};

export function BoardApp(): React.ReactElement {
  const [params] = useSearchParams();
  const code = params.get('game')?.trim();
  // Remount per game so no state from a previous game leaks into the next one.
  return code ? <BoardView key={code} rawCode={code} /> : <GamePicker />;
}

function BoardMessage({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="boardApp boardApp--message">
      <div className="boardMessage">{children}</div>
    </div>
  );
}

function BoardView({ rawCode }: { rawCode: string }): React.ReactElement {
  const { status, error, code } = useBoardGameSync(rawCode);
  const G = useGameStore((state) => state.G);
  const ctx = useGameStore((state) => state.ctx);
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const zoomPan = useZoomPan(viewportRef);
  const players = React.useMemo(() => getBoardPlayers(G, ctx), [G, ctx]);
  useBoardStateSync(code, status === 'live');
  const boardStatus = useBoardStore((s) => s.status);
  const boardError = useBoardStore((s) => s.error);
  const board = useBoardStore((s) => s.board);
  const pendingCount = useBoardStore((s) => s.pending.length);
  const { states: botStates, now } = useBotNarration(code ?? null, status === 'live');
  const bots = React.useMemo(() => botTrayInfo(botStates, ctx, now), [botStates, ctx, now]);
  const [popover, setPopover] = React.useState<{ routeKey: string; clientX: number; clientY: number } | null>(null);
  const closePopover = React.useCallback(() => setPopover(null), []);

  // Outside the play phase there is no current player to claim for, so clicks open the popover.
  const claimant = ctx.phase === 'play' && players.some((p: BoardPlayer) => p.id === ctx.currentPlayer) ? ctx.currentPlayer : null;

  const handleRouteClick = (click: RouteClick) => {
    if (boardStatus !== 'ready' || !board) return;
    const owners = board.track[click.routeKey] ?? [];
    if (!click.forcePopover && owners.length === 0 && claimant) {
      dispatchBoardOp({ type: 'claimRoute', routeKey: click.routeKey, playerID: claimant });
      setPopover(null);
      return;
    }
    setPopover({ routeKey: click.routeKey, clientX: click.clientX, clientY: click.clientY });
  };

  const canEditBoard = boardStatus === 'ready' && board !== null;
  const handleTokenDrop = (token: TokenRef, city: string | null) => {
    const { board: latest, status: latestStatus } = useBoardStore.getState();
    if (latestStatus !== 'ready' || tokenCity(latest, token) === city) return;
    dispatchBoardOp(moveTokenOp(token, city));
  };
  const { drag, startDrag } = useTokenDrag(viewportRef, handleTokenDrop);
  const placedTokens = React.useMemo(
    () => layoutTokens(board, players.map((p: BoardPlayer) => p.id)),
    [board, players]
  );
  const startTokenDrag = canEditBoard
    ? (token: TokenRef, event: React.PointerEvent<Element>) => {
        setPopover(null);
        startDrag(token, event);
      }
    : null;
  const dragPlayer = drag ? players.find((p: BoardPlayer) => p.id === drag.token.playerID) : undefined;

  // The popover is anchored to screen coordinates, so close it when the map moves.
  React.useEffect(() => setPopover(null), [zoomPan.zoom]);
  React.useEffect(() => {
    const el = viewportRef.current;
    if (!el || !popover) return;
    el.addEventListener('scroll', closePopover, { passive: true });
    return () => el.removeEventListener('scroll', closePopover);
  }, [popover, closePopover]);

  if (status === 'not-found' || status === 'error') {
    return (
      <BoardMessage>
        <p>{status === 'not-found' ? `Game "${code ?? rawCode}" was not found.` : error}</p>
        <Link to="/board">Choose a game</Link>
      </BoardMessage>
    );
  }

  const ready = status === 'live' && code;
  return (
    <div className={`boardApp${drag ? ' boardApp--dragging' : ''}`}>
      {ready ? (
        <BoardTopBar
          code={code}
          ctx={ctx}
          players={players}
          status={status}
          boardStatus={boardStatus}
          pendingCount={pendingCount}
          zoomPan={zoomPan}
        />
      ) : (
        <header className="boardTopBar">Loading {rawCode}…</header>
      )}
      {boardError && (
        <p className="boardBanner" role="alert">
          {boardError}
        </p>
      )}
      <div className="boardMain">
        <div ref={viewportRef} className="boardViewport">
          {ready && (
            <BoardMap
              G={G}
              players={players}
              track={board?.track ?? EMPTY_TRACK}
              zoomPan={zoomPan}
              onRouteClick={handleRouteClick}
              tokens={placedTokens}
              dragging={drag?.token ?? null}
              snapCity={drag?.target.kind === 'city' ? drag.target.city : null}
              onTokenPointerDown={startTokenDrag}
            />
          )}
        </div>
        {ready && (
          <PlayerTrays
            players={players}
            currentPlayer={ctx.currentPlayer}
            board={board}
            dragging={drag?.token ?? null}
            dropTarget={drag?.target.kind === 'tray'}
            onTokenPointerDown={startTokenDrag}
            onBoardOp={canEditBoard ? dispatchBoardOp : null}
            bots={bots}
          />
        )}
      </div>
      {popover && board && (
        <RoutePopover
          routeKey={popover.routeKey}
          owners={board.track[popover.routeKey] ?? []}
          players={players}
          currentPlayer={claimant}
          clientX={popover.clientX}
          clientY={popover.clientY}
          onChange={(owners) => dispatchBoardOp({ type: 'setRouteOwners', routeKey: popover.routeKey, owners })}
          onClose={closePopover}
        />
      )}
      {drag && dragPlayer && (
        <TokenGhost token={drag.token} player={dragPlayer} clientX={drag.clientX} clientY={drag.clientY} />
      )}
    </div>
  );
}

function GamePicker(): React.ReactElement {
  const [games, setGames] = React.useState<GameListItem[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    listGames()
      .then((list) => !cancelled && setGames(list))
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <BoardMessage>
      <h1 className="boardMessage__title">Board: choose a game</h1>
      {error && <p className="boardMessage__error">{error}</p>}
      {!games && !error && <p>Loading games…</p>}
      {games?.length === 0 && <p>No games found.</p>}
      {games && games.length > 0 && (
        <ul className="boardPicker">
          {games.map((game: GameListItem) => (
            <li key={game.code}>
              <Link className="boardPicker__game" to={`/board?game=${encodeURIComponent(game.code)}`}>
                <span className="boardPicker__code">{game.code}</span>
                <span>{formatPhase(game.phase)}</span>
                <span className="boardPicker__players">{game.playerNames.join(', ')}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </BoardMessage>
  );
}
