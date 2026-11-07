/**
 * Read-only game sync for the board: load G/ctx for a game code, subscribe to realtime
 * updates, and hydrate the existing useGameStore. Never calls moves, gameActions, or the
 * game save path; the app is the only writer of G/ctx.
 */
import React from 'react';
import { useStorage } from '../providers/StorageProvider';
import { useGameStore } from '../stores/gameStore';
import type { GameContext, GameState } from '../stores/gameStore';
import { isValidGameCode, loadGameState, normalizeGameCode } from '../utils/gameManager';

export type BoardSyncStatus = 'loading' | 'live' | 'not-found' | 'error';

export interface BoardGameSync {
  status: BoardSyncStatus;
  error: string | null;
  /** Normalized game code, or null if the input was invalid. */
  code: string | null;
}

function hydrate(G: GameState, ctx: GameContext): void {
  useGameStore.setState({ G, ctx });
}

export function useBoardGameSync(rawCode: string): BoardGameSync {
  const storage = useStorage();
  const normalized = normalizeGameCode(rawCode);
  const code = isValidGameCode(normalized) ? normalized : null;
  const [status, setStatus] = React.useState<BoardSyncStatus>(code ? 'loading' : 'error');
  const [error, setError] = React.useState<string | null>(code ? null : `Invalid game code "${rawCode}".`);

  React.useEffect(() => {
    if (!code) {
      setStatus('error');
      setError(`Invalid game code "${rawCode}".`);
      return;
    }
    let cancelled = false;
    // Newest realtime update applied; an initial load that resolves after one is stale.
    let lastApplied: string | null = null;
    let unsubscribe: () => void = () => {};
    setStatus('loading');
    setError(null);

    try {
      const adapter = storage.getStorageAdapter();
      unsubscribe = adapter.subscribeToGame(code, (state, _metadata, lastModified) => {
        if (cancelled || !state?.G || !state?.ctx) return;
        if (lastModified && lastApplied && new Date(lastModified) <= new Date(lastApplied)) return;
        lastApplied = lastModified ?? new Date().toISOString();
        hydrate(state.G as unknown as GameState, state.ctx as unknown as GameContext);
        setStatus('live');
      });
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : String(err));
      return;
    }

    loadGameState(code)
      .then((state) => {
        if (cancelled) return;
        if (!state?.G || !state?.ctx) {
          setStatus('not-found');
          return;
        }
        if (!lastApplied) hydrate(state.G, state.ctx);
        setStatus('live');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [code, rawCode, storage]);

  return { status, error, code };
}
