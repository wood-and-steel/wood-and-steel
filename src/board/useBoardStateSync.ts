/**
 * Opens board state for a game once its G/ctx are loaded, and seeds it from G when the
 * game reaches the point where every player has a starting route.
 */
import React from 'react';
import { useGameStore } from '../stores/gameStore';
import { closeBoard, openBoard, trySeedBoard } from './boardSync';
import { useBoardStore } from './boardStore';

export function useBoardStateSync(code: string | null, gameLive: boolean): void {
  const status = useBoardStore((s) => s.status);
  const G = useGameStore((s) => s.G);
  const ctx = useGameStore((s) => s.ctx);

  React.useEffect(() => {
    if (!code || !gameLive) return;
    void openBoard(code).catch(() => {});
    return () => closeBoard();
  }, [code, gameLive]);

  React.useEffect(() => {
    if (gameLive && status === 'unseeded') void trySeedBoard(G, ctx);
  }, [G, ctx, gameLive, status]);
}
