/**
 * Board-only state (docs/archived/BOARD_APP_PLAN.md, Board state). A documented exception to the
 * "Zustand gameStore only" rule in AGENTS.md: it is playtest-only and holds no G/ctx data.
 *
 * `confirmed` is the last state known to be saved; `pending` holds ops not yet saved.
 * What the board shows is `board` = pending ops applied to confirmed.
 */
import { create } from 'zustand';
import { applyBoardOp, type BoardOp, type BoardState } from './boardOps';

export type BoardStateStatus =
  /** No game open */
  | 'idle'
  | 'loading'
  /** No row yet. Seeding happens once players have their starting routes (after setup). */
  | 'unseeded'
  | 'ready'
  | 'error';

export interface BoardStoreState {
  code: string | null;
  status: BoardStateStatus;
  error: string | null;
  confirmed: { state: BoardState; updatedAt: string } | null;
  pending: BoardOp[];
  board: BoardState | null;
}

export const initialBoardStoreState: BoardStoreState = {
  code: null,
  status: 'idle',
  error: null,
  confirmed: null,
  pending: [],
  board: null,
};

export const useBoardStore = create<BoardStoreState>(() => ({ ...initialBoardStoreState }));

export function deriveBoard(confirmed: BoardStoreState['confirmed'], pending: BoardOp[]): BoardState | null {
  return confirmed ? pending.reduce(applyBoardOp, confirmed.state) : null;
}
