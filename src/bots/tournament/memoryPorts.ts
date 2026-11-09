/**
 * In-memory ports for headless bot-only games (docs/BOT_PLAN.md, Tournament). Moves are the app's
 * real moves on the real store; nothing is saved (no current game code), so games run fast.
 * The board and bot state live in plain objects.
 */
import { generatePrivateContractOffers } from '../../Contract';
import { applyBoardOp, type BoardState } from '../../board/boardOps';
import { canSeedBoard, seedBoardState } from '../../board/boardSeed';
import { useGameStore } from '../../stores/gameStore';
import { callMove } from '../host/hostPorts';
import type { BotPorts } from '../ports';
import type { BotStates } from '../state/botStates';

export interface MemoryPorts extends BotPorts {
  /** The board as bots left it (null until seeded). */
  boardState(): BoardState | null;
  botStates(): BotStates;
}

export function createMemoryPorts(initial: BotStates): MemoryPorts {
  let board: BoardState | null = null;
  let bots = structuredClone(initial);
  return {
    game: {
      getState: () => {
        const { G, ctx } = useGameStore.getState();
        return { G, ctx };
      },
      applyMove: async (move) => callMove(move),
      privateContractOffers: () => {
        const { G, ctx } = useGameStore.getState();
        return generatePrivateContractOffers(G, ctx);
      },
      settle: async () => {},
    },
    board: {
      load: async () => (board ? structuredClone(board) : null),
      apply: async (op) => {
        if (!board) {
          const { G, ctx } = useGameStore.getState();
          if (!canSeedBoard(G, ctx)) return;
          board = seedBoardState(G, ctx);
        }
        board = applyBoardOp(board, op);
      },
    },
    bots: {
      load: async () => structuredClone(bots),
      update: async (change) => {
        bots = change(structuredClone(bots));
        return structuredClone(bots);
      },
    },
    clock: { sleep: () => Promise.resolve(), now: () => new Date().toISOString() },
    boardState: () => board,
    botStates: () => bots,
  };
}
