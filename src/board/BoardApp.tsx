/**
 * Playtest board app at /board?game=CODE (docs/BOARD_APP_PLAN.md).
 * Lazy-loaded behind __INCLUDE_BOARD__; the main app imports nothing from src/board/.
 * Read-only with respect to G/ctx: it shows game state but never changes it.
 */
import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import '../shared/styles/board.css';
import { useGameStore } from '../stores/gameStore';
import { listGames } from '../utils/gameManager';
import type { GameListItem } from '../utils/storage/storageAdapter';
import { BoardMap } from './BoardMap';
import { BoardTopBar, PlayerTrays } from './BoardChrome';
import { formatPhase, getBoardPlayers } from './boardPlayers';
import { useBoardStore } from './boardStore';
import { useBoardGameSync } from './useBoardGameSync';
import { useBoardStateSync } from './useBoardStateSync';
import { useZoomPan } from './useZoomPan';

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
    <div className="boardApp">
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
      <div ref={viewportRef} className="boardViewport">
        {ready && <BoardMap G={G} players={players} zoomPan={zoomPan} />}
      </div>
      {ready && <PlayerTrays players={players} currentPlayer={ctx.currentPlayer} board={board} />}
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
