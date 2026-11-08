/**
 * Opens board state for a game once its G/ctx are loaded, seeds it from G when the game
 * reaches the point where every player has a starting route, and converts acquired
 * independent railroads to track whenever G changes.
 */
import React from 'react';
import { useGameStore } from '../stores/gameStore';
import { reconcileOp } from './boardAcquisitions';
import { closeBoard, dispatchBoardOp, openBoard, trySeedBoard } from './boardSync';
import { useBoardStore } from './boardStore';

export function useBoardStateSync(code: string | null, gameLive: boolean): void {
  const status = useBoardStore((s) => s.status);
  const board = useBoardStore((s) => s.board);
  const confirmedAt = useBoardStore((s) => s.confirmed?.updatedAt ?? null);
  const G = useGameStore((s) => s.G);
  const ctx = useGameStore((s) => s.ctx);
  /** Last (G, saved board version) we reconciled, so a failing save isn't retried in a loop. */
  const reconciledFor = React.useRef<{ G: unknown; confirmedAt: string | null } | null>(null);

  React.useEffect(() => {
    if (!code || !gameLive) return;
    void openBoard(code).catch(() => {});
    return () => closeBoard();
  }, [code, gameLive]);

  React.useEffect(() => {
    if (gameLive && status === 'unseeded') void trySeedBoard(G, ctx);
  }, [G, ctx, gameLive, status]);

  React.useEffect(() => {
    if (!gameLive || status !== 'ready' || !board) return;
    const last = reconciledFor.current;
    if (last && last.G === G && last.confirmedAt === confirmedAt) return;
    const op = reconcileOp(board, G, ctx);
    if (!op) return;
    reconciledFor.current = { G, confirmedAt };
    dispatchBoardOp(op);
  }, [G, ctx, gameLive, status, board, confirmedAt]);
}
