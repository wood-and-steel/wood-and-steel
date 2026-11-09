/**
 * Apply one BoardOp straight to the stored board row, without a board screen's session
 * (docs/BOT_PLAN.md, Ports): load, apply, save conditionally on updated_at, and on conflict
 * reload and re-apply. Used by playtest bots; ops are re-appliable, so a retry is safe.
 * The board app's own queue (boardSync.ts) does the same for a screen's optimistic edits.
 */
import { applyBoardOp, normalizeBoardState, type BoardOp, type BoardState } from './boardOps';
import type { BoardStateAdapter } from './boardStateAdapter';

export const MAX_ROW_SAVE_ATTEMPTS = 5;

/**
 * Save `op` to the game's board row. With no row yet, `seed()` supplies the starting state
 * (or null to give up, e.g. before setup ends). Returns the saved state, or null if there was no row to edit.
 */
export async function saveBoardOp(
  adapter: BoardStateAdapter,
  code: string,
  op: BoardOp,
  seed: () => BoardState | null
): Promise<BoardState | null> {
  for (let attempt = 0; attempt < MAX_ROW_SAVE_ATTEMPTS; attempt++) {
    const record = await adapter.load(code);
    const base = record ? normalizeBoardState(record.state) : seed();
    if (!base) return null;
    const next = applyBoardOp(base, op);
    const result = await adapter.save(code, next, record?.updatedAt ?? null);
    if (result.ok) return next;
  }
  throw new Error(`Could not save the board after ${MAX_ROW_SAVE_ATTEMPTS} attempts; another screen kept saving first.`);
}
