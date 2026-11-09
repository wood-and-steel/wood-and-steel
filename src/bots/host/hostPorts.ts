/**
 * Port implementations for the host's browser (docs/BOT_PLAN.md, Ports): moves go through the
 * app's own move functions on the shared store, the board row is edited directly, and bot
 * state is read and written with conditional saves.
 */
import { generatePrivateContractOffers } from '../../Contract';
import { seedBoardState, canSeedBoard } from '../../board/boardSeed';
import { saveBoardOp } from '../../board/boardRowOps';
import { getBoardStateAdapter } from '../../board/boardStateAdapter';
import * as gameActions from '../../stores/gameActions';
import { useGameStore, type GameContext, type GameState } from '../../stores/gameStore';
import { getCurrentGameCode, saveGameState } from '../../utils/gameManager';
import { serializeState } from '../../utils/stateSerialization';
import { getStorageAdapter } from '../../utils/storage';
import type { GameMove } from '../engine/actions';
import type { BotPorts, Clock, GamePort } from '../ports';
import { getBotStatesAdapter } from '../state/botStatesAdapter';
import { loadBotStates, updateBotStates } from '../state/botStatesSync';

/** JSON with sorted keys, so states compare equal however the database ordered them. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

type GameSnapshot = { G: GameState; ctx: GameContext };

function snapshotKey(state: { G: unknown; ctx: unknown }): string {
  return stableStringify(serializeState(state.G as Record<string, unknown>, state.ctx as Record<string, unknown>));
}

function storeState(): GameSnapshot {
  const { G, ctx } = useGameStore.getState();
  return structuredClone({ G, ctx });
}

/** Put a known-good state back in the store (keeping its other fields). */
function restoreStore(state: GameSnapshot): void {
  useGameStore.setState({ G: structuredClone(state.G), ctx: structuredClone(state.ctx) });
}

export interface WaitForSaveOptions {
  clock: Clock;
  /** Poll interval (ms). */
  intervalMs?: number;
  /** Re-save the expected state once if the stored game still differs after this long (ms). */
  resaveAfterMs?: number;
  /** Give up after this long (ms). */
  timeoutMs?: number;
}

/**
 * Wait until the stored game is `expected`, the state a move produced. Moves save in the
 * background and saves are last-write-wins, so an older save can land after a newer one; if the
 * row is still different after a while, save `expected` once more. (Never the live store: a late
 * realtime echo of an older save may have rewound it.)
 */
export async function waitForSavedGame(
  code: string,
  expected: GameSnapshot,
  { clock, intervalMs = 150, resaveAfterMs = 3000, timeoutMs = 15000 }: WaitForSaveOptions
): Promise<void> {
  const key = snapshotKey(expected);
  let waited = 0;
  let resaved = false;
  for (;;) {
    const stored = await getStorageAdapter().loadGame(code);
    if (stored && snapshotKey(stored) === key) return;
    if (!resaved && waited >= resaveAfterMs) {
      resaved = true;
      await saveGameState(code, expected.G, expected.ctx);
      continue;
    }
    if (waited >= timeoutMs) throw new Error(`Game ${code} did not save within ${timeoutMs / 1000} seconds.`);
    await clock.sleep(intervalMs);
    waited += intervalMs;
  }
}

/**
 * Wait for the store to show `expected`: realtime echoes of this device's own saves may still be
 * arriving and briefly rewind it. If it hasn't caught up after a while, restore it.
 */
export async function settleStore(expected: GameSnapshot, clock: Clock, intervalMs = 150, restoreAfterMs = 2000): Promise<void> {
  const key = snapshotKey(expected);
  for (let waited = 0; snapshotKey(useGameStore.getState()) !== key; waited += intervalMs) {
    if (waited >= restoreAfterMs) {
      restoreStore(expected);
      return;
    }
    await clock.sleep(intervalMs);
  }
}

/** Call an app move by name, exactly as the UI would. */
export function callMove(move: GameMove): void {
  switch (move.name) {
    case 'generateStartingContract':
      return gameActions.generateStartingContract(move.args[0], move.args[1]);
    case 'toggleContractFulfilled':
      return gameActions.toggleContractFulfilled(move.args[0]);
    case 'claimMarketContract':
      return gameActions.claimMarketContract(move.args[0]);
    case 'addContract':
      return gameActions.addContract(move.args[0], move.args[1], move.args[2]);
    case 'deleteContract':
      return gameActions.deleteContract(move.args[0]);
    case 'acquireIndependentRailroad':
      return gameActions.acquireIndependentRailroad(move.args[0]);
    case 'claimHubCity':
      gameActions.claimHubCity(move.args[0]);
      return;
    case 'claimRegionalOffice':
      gameActions.claimRegionalOffice(move.args[0]);
      return;
    case 'endTurn':
      return gameActions.endTurn();
  }
}

export const browserClock: Clock = {
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => new Date().toISOString(),
};

export function createHostPorts(code: string, clock: Clock = browserClock): BotPorts {
  const game: GamePort = {
    getState: () => {
      const { G, ctx } = useGameStore.getState();
      return { G, ctx };
    },
    async applyMove(move) {
      if (getCurrentGameCode() !== code) throw new Error(`Game ${code} is no longer the open game.`);
      callMove(move);
      // Moves change the store at once; this is the state the move produced.
      const expected = storeState();
      await waitForSavedGame(code, expected, { clock });
      await settleStore(expected, clock);
    },
    async settle() {
      const stored = await getStorageAdapter().loadGame(code);
      if (stored?.G && stored.ctx) await settleStore(stored as unknown as GameSnapshot, clock);
    },
    privateContractOffers: () => {
      const { G, ctx } = useGameStore.getState();
      return generatePrivateContractOffers(G, ctx);
    },
  };

  return {
    game,
    board: {
      load: async () => (await getBoardStateAdapter().load(code))?.state ?? null,
      async apply(op) {
        const { G, ctx } = useGameStore.getState();
        await saveBoardOp(getBoardStateAdapter(), code, op, () => (canSeedBoard(G, ctx) ? seedBoardState(G, ctx) : null));
      },
    },
    bots: {
      load: async () => (await loadBotStates(code, getBotStatesAdapter()))?.states ?? null,
      update: async (change) => (await updateBotStates(code, change, { adapter: getBotStatesAdapter() })).states,
    },
    clock,
  };
}
