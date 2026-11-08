/**
 * Loads, seeds, saves and live-syncs board state for one game (docs/archived/BOARD_APP_PLAN.md,
 * Persistence). Ops are applied locally at once, then saved one at a time against the
 * row's updated_at. On conflict the fresh row is loaded, the op is re-applied to it, and
 * the save is retried, so two screens editing at once both keep their edits.
 */
import type { GameContext, GameState } from '../stores/gameStore';
import { applyBoardOp, normalizeBoardState, type BoardOp } from './boardOps';
import { canSeedBoard, seedBoardState } from './boardSeed';
import { getBoardStateAdapter, type BoardStateAdapter, type BoardStateRecord } from './boardStateAdapter';
import { deriveBoard, initialBoardStoreState, useBoardStore } from './boardStore';

const MAX_SAVE_ATTEMPTS = 5;

interface Session {
  code: string;
  adapter: BoardStateAdapter;
  unsubscribe: () => void;
  flushing: boolean;
  seeding: boolean;
}

let session: Session | null = null;

const set = useBoardStore.setState;
const get = useBoardStore.getState;
const message = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** Take a stored row if it is newer than what we have. */
function accept(record: BoardStateRecord): void {
  const { confirmed, pending } = get();
  if (confirmed && Date.parse(record.updatedAt) <= Date.parse(confirmed.updatedAt)) return;
  try {
    const next = { state: normalizeBoardState(record.state), updatedAt: record.updatedAt };
    set({ confirmed: next, board: deriveBoard(next, pending), status: 'ready' });
  } catch (err) {
    set({ status: 'error', error: message(err) });
  }
}

export async function openBoard(code: string, adapter: BoardStateAdapter = getBoardStateAdapter()): Promise<void> {
  closeBoard();
  const s: Session = { code, adapter, unsubscribe: () => {}, flushing: false, seeding: false };
  session = s;
  set({ ...initialBoardStoreState, code, status: 'loading' });
  try {
    s.unsubscribe = adapter.subscribe(code, (record) => {
      if (session === s) accept(record);
    });
    const record = await adapter.load(code);
    if (session !== s) return;
    if (record) accept(record);
    else if (get().status === 'loading') set({ status: 'unseeded' });
  } catch (err) {
    if (session === s) set({ status: 'error', error: message(err) });
  }
}

export function closeBoard(): void {
  session?.unsubscribe();
  session = null;
  set({ ...initialBoardStoreState });
}

/** Create the row from G once the game is far enough along. Safe to call on every G update. */
export async function trySeedBoard(G: GameState, ctx: GameContext): Promise<void> {
  const s = session;
  if (!s || s.seeding || get().status !== 'unseeded' || !canSeedBoard(G, ctx)) return;
  s.seeding = true;
  const state = seedBoardState(G, ctx);
  try {
    const result = await s.adapter.save(s.code, state, null);
    if (session !== s) return;
    if (result.ok) {
      accept({ state, updatedAt: result.updatedAt });
    } else {
      // Another screen seeded first; use theirs.
      const record = await s.adapter.load(s.code);
      if (session === s && record) accept(record);
    }
  } catch (err) {
    if (session === s) set({ status: 'error', error: message(err) });
  } finally {
    s.seeding = false;
  }
}

/** Apply an op now and queue it for saving. Ignored until the board is ready. */
export function dispatchBoardOp(op: BoardOp): void {
  const s = session;
  if (!s || get().status !== 'ready') return;
  const pending = [...get().pending, op];
  set({ pending, board: deriveBoard(get().confirmed, pending), error: null });
  void flush(s);
}

async function flush(s: Session): Promise<void> {
  if (s.flushing) return;
  s.flushing = true;
  try {
    while (session === s && get().pending.length > 0) {
      await saveHeadOp(s);
    }
  } finally {
    s.flushing = false;
  }
}

function dropPending(error: string): void {
  set({ pending: [], board: deriveBoard(get().confirmed, []), error });
}

async function saveHeadOp(s: Session): Promise<void> {
  const op = get().pending[0];
  for (let attempt = 0; attempt < MAX_SAVE_ATTEMPTS; attempt++) {
    const confirmed = get().confirmed;
    if (!confirmed) return dropPending('Board state is not loaded.');
    const next = applyBoardOp(confirmed.state, op);
    try {
      const result = await s.adapter.save(s.code, next, confirmed.updatedAt);
      if (session !== s) return;
      if (result.ok) {
        const saved = { state: next, updatedAt: result.updatedAt };
        const pending = get().pending.slice(1);
        set({ confirmed: saved, pending, board: deriveBoard(saved, pending) });
        return;
      }
      // Conflict: someone else saved first. Load their row and re-apply this op to it.
      const record = await s.adapter.load(s.code);
      if (session !== s) return;
      if (record) accept(record);
    } catch (err) {
      if (session === s) dropPending(`Could not save board: ${message(err)}`);
      return;
    }
  }
  dropPending(`Could not save board after ${MAX_SAVE_ATTEMPTS} attempts; another screen kept saving first.`);
}
