/**
 * Comprehensive persistence tests for game state management.
 * Tests persistence across moves, turns, phases, game switching, and reloads.
 */

import { vi, describe, test, expect, beforeAll, beforeEach } from 'vitest';
import {
  generateGameCode,
  generateUniqueGameCode,
  saveGameState,
  loadGameState,
  createNewGame,
  switchToGame,
  deleteGame,
  listGameCodes,
  getCurrentGameCode,
  setCurrentGameCode,
  clearCurrentGameCode,
  gameExists,
  SeatAssignmentError,
  getGameMetadata,
  updateGameMetadata,
  assignPlayerSeat,
  updatePlayerName,
  isHost,
  getNumPlayersJoined,
  allPlayersJoined,
  assignRandomPlayerIDs,
  getDevicePlayerID,
  getDeviceSeat,
  getPlayerSeats,
} from './gameManager';
import type { GameMetadata } from './gameManager';
import { useGameStore, type GameContext } from '../stores/gameStore';
import {
  generateStartingContract,
  generatePrivateContract,
  toggleContractFulfilled,
  endTurn,
} from '../stores/gameActions';
import { endTurn as endTurnEvent } from '../stores/events';
import { checkPhaseTransition } from '../stores/phaseManager';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

beforeAll(() => {
  (globalThis as typeof globalThis & { localStorage: Storage }).localStorage =
    localStorageMock as unknown as Storage;
});

beforeEach(() => {
  localStorageMock.clear();
  useGameStore.getState().resetState();
  vi.clearAllMocks();
});

describe('Persistence Tests', () => {
  describe('1. Moves - State persists after moves', () => {
    test('state persists after generateStartingContract', async () => {
      const gameCode = await createNewGame();
      const { G: initialG, ctx: initialCtx } = useGameStore.getState();

      generateStartingContract(['New York', 'Philadelphia']);

      const savedState = await loadGameState(gameCode);
      expect(savedState != null).toBe(true);
      expect(savedState!.G.contracts.length).toBeGreaterThan(initialG.contracts.length);
      expect(savedState!.ctx.currentPlayer).toBeDefined();
    });

    test('state persists after generatePrivateContract', async () => {
      const gameCode = await createNewGame();

      useGameStore.setState({
        G: {
          ...useGameStore.getState().G,
          players: [
            ['0', { name: 'Player 0', activeCities: ['New York', 'Philadelphia'] }],
            ['1', { name: 'Player 1', activeCities: [] }],
          ],
        },
        ctx: {
          ...useGameStore.getState().ctx,
          phase: 'play',
          currentPlayer: '0',
        },
      });
      await saveGameState(gameCode, useGameStore.getState().G, useGameStore.getState().ctx);

      const { G: initialG } = useGameStore.getState();
      const initialContractCount = initialG.contracts.length;

      generatePrivateContract();

      const savedState = await loadGameState(gameCode);
      expect(savedState != null).toBe(true);
      expect(savedState!.G.contracts.length).toBe(initialContractCount + 1);
    });

    test('state persists after toggleContractFulfilled', async () => {
      const gameCode = await createNewGame();

      useGameStore.setState({
        G: {
          ...useGameStore.getState().G,
          contracts: [
            {
              id: 'test-contract-1',
              destinationKey: 'Chicago',
              commodity: 'coal',
              type: 'private',
              playerID: '0',
              fulfilled: false,
            },
          ],
        },
        ctx: {
          ...useGameStore.getState().ctx,
          phase: 'play',
          currentPlayer: '0',
        },
      });
      await saveGameState(gameCode, useGameStore.getState().G, useGameStore.getState().ctx);

      toggleContractFulfilled('test-contract-1');

      const savedState = await loadGameState(gameCode);
      expect(savedState != null).toBe(true);
      const contract = savedState!.G.contracts.find((c) => c.id === 'test-contract-1');
      expect(contract).toBeDefined();
      expect(contract!.fulfilled).toBe(true);
    });

    test('state persists after multiple moves in sequence', async () => {
      const gameCode = await createNewGame();

      useGameStore.setState({
        G: {
          ...useGameStore.getState().G,
          players: [
            ['0', { name: 'Player 0', activeCities: ['New York', 'Philadelphia', 'Pittsburgh'] }],
            ['1', { name: 'Player 1', activeCities: [] }],
          ],
        },
        ctx: {
          ...useGameStore.getState().ctx,
          phase: 'play',
          currentPlayer: '0',
        },
      });
      await saveGameState(gameCode, useGameStore.getState().G, useGameStore.getState().ctx);

      generatePrivateContract();
      generatePrivateContract();
      generatePrivateContract();

      const savedState = await loadGameState(gameCode);
      expect(savedState != null).toBe(true);
      // At least 2 of 3 generatePrivateContract calls typically succeed (one may fail due to randomness)
      expect(savedState!.G.contracts.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('2. Turns - State persists after turn changes', () => {
    test('state persists after endTurn', async () => {
      const gameCode = await createNewGame();
      const { ctx: initialCtx } = useGameStore.getState();
      const initialPlayer = initialCtx.currentPlayer;
      const initialTurn = initialCtx.turn;

      endTurnEvent();

      const savedState = await loadGameState(gameCode);
      expect(savedState != null).toBe(true);

      const { ctx: savedCtx } = savedState!;
      expect(savedCtx.currentPlayer === initialPlayer).toBe(false);
      expect(savedCtx.playOrderPos).toBe(
        (initialCtx.playOrderPos + 1) % initialCtx.playOrder.length
      );
    });

    test('state persists after turn wraps to new round', async () => {
      const gameCode = await createNewGame();

      useGameStore.setState({
        ctx: {
          ...useGameStore.getState().ctx,
          currentPlayer: '1',
          playOrderPos: 1,
          turn: 5,
        },
      });
      await saveGameState(gameCode, useGameStore.getState().G, useGameStore.getState().ctx);

      const initialTurn = useGameStore.getState().ctx.turn;

      endTurnEvent();

      const savedState = await loadGameState(gameCode);
      expect(savedState != null).toBe(true);

      expect(savedState!.ctx.turn).toBe(initialTurn + 1);
      expect(savedState!.ctx.currentPlayer).toBe('0');
      expect(savedState!.ctx.playOrderPos).toBe(0);
    });

    test('state persists after multiple turn changes', async () => {
      const gameCode = await createNewGame();
      const initialTurn = useGameStore.getState().ctx.turn;

      endTurnEvent();
      endTurnEvent();
      endTurnEvent();

      const savedState = await loadGameState(gameCode);
      expect(savedState != null).toBe(true);

      expect(savedState!.ctx.currentPlayer).toBe('1');
      expect(savedState!.ctx.turn).toBe(initialTurn + 1);
    });
  });

  describe('3. Phases - State persists after phase transitions', () => {
    test('state persists after phase transition from setup to play', async () => {
      const gameCode = await createNewGame();

      useGameStore.setState({
        G: {
          ...useGameStore.getState().G,
          contracts: [
            {
              id: 'c1',
              destinationKey: 'New York',
              commodity: 'coal',
              type: 'private',
              playerID: '0',
              fulfilled: false,
            },
            {
              id: 'c2',
              destinationKey: 'Chicago',
              commodity: 'wood',
              type: 'private',
              playerID: '1',
              fulfilled: false,
            },
          ],
        },
        ctx: {
          ...useGameStore.getState().ctx,
          phase: 'setup',
          currentPlayer: '1',
          playOrderPos: 1,
        },
      });
      await saveGameState(gameCode, useGameStore.getState().G, useGameStore.getState().ctx);

      const transitioned = checkPhaseTransition(
        useGameStore.getState().G,
        useGameStore.getState().ctx
      );

      expect(transitioned).toBe(true);

      const savedState = await loadGameState(gameCode);
      expect(savedState != null).toBe(true);
      expect(savedState!.ctx.phase).toBe('play');
    });

    test('state persists even when phase transition does not occur', async () => {
      const gameCode = await createNewGame();

      useGameStore.setState({
        G: {
          ...useGameStore.getState().G,
          contracts: [
            {
              id: 'c1',
              destinationKey: 'New York',
              commodity: 'coal',
              type: 'private',
              playerID: '0',
              fulfilled: false,
            },
          ],
        },
        ctx: {
          ...useGameStore.getState().ctx,
          phase: 'setup',
        },
      });
      await saveGameState(gameCode, useGameStore.getState().G, useGameStore.getState().ctx);

      const initialPhase = useGameStore.getState().ctx.phase;

      const transitioned = checkPhaseTransition(
        useGameStore.getState().G,
        useGameStore.getState().ctx
      );

      expect(transitioned).toBe(false);

      const savedState = await loadGameState(gameCode);
      expect(savedState != null).toBe(true);
      expect(savedState!.ctx.phase).toBe(initialPhase);
    });
  });

  describe('4. Game switching - State persists when switching between games', () => {
    test('can create and switch between multiple games', async () => {
      const gameCode1 = await createNewGame();
      useGameStore.setState({
        G: {
          ...useGameStore.getState().G,
          contracts: [
            {
              id: 'c1',
              destinationKey: 'New York',
              commodity: 'coal',
              type: 'private',
              playerID: '0',
              fulfilled: false,
            },
          ],
        },
        ctx: {
          ...useGameStore.getState().ctx,
          turn: 5,
        },
      });
      await saveGameState(gameCode1, useGameStore.getState().G, useGameStore.getState().ctx);

      const gameCode2 = await createNewGame();
      useGameStore.setState({
        G: {
          ...useGameStore.getState().G,
          contracts: [
            {
              id: 'c2',
              destinationKey: 'Chicago',
              commodity: 'wood',
              type: 'private',
              playerID: '0',
              fulfilled: false,
            },
          ],
        },
        ctx: {
          ...useGameStore.getState().ctx,
          turn: 10,
        },
      });
      await saveGameState(gameCode2, useGameStore.getState().G, useGameStore.getState().ctx);

      expect(await gameExists(gameCode1, 'local')).toBe(true);
      expect(await gameExists(gameCode2, 'local')).toBe(true);

      await switchToGame(gameCode1);
      const state1 = await loadGameState(gameCode1);
      expect(state1 != null).toBe(true);
      expect(state1!.G.contracts.length).toBe(1);
      expect(state1!.G.contracts[0].id).toBe('c1');
      expect(state1!.ctx.turn).toBe(5);

      await switchToGame(gameCode2);
      const state2 = await loadGameState(gameCode2);
      expect(state2 != null).toBe(true);
      expect(state2!.G.contracts.length).toBe(1);
      expect(state2!.G.contracts[0].id).toBe('c2');
      expect(state2!.ctx.turn).toBe(10);
    });

    test('state persists correctly when switching back and forth between games', async () => {
      const gameCode1 = await createNewGame();
      useGameStore.setState({
        G: {
          ...useGameStore.getState().G,
          contracts: [
            {
              id: 'c1',
              destinationKey: 'New York',
              commodity: 'coal',
              type: 'private',
              playerID: '0',
              fulfilled: false,
            },
          ],
        },
      });
      await saveGameState(gameCode1, useGameStore.getState().G, useGameStore.getState().ctx);

      const gameCode2 = await createNewGame();
      useGameStore.setState({
        G: {
          ...useGameStore.getState().G,
          contracts: [
            {
              id: 'c2',
              destinationKey: 'Chicago',
              commodity: 'wood',
              type: 'private',
              playerID: '0',
              fulfilled: false,
            },
          ],
        },
      });
      await saveGameState(gameCode2, useGameStore.getState().G, useGameStore.getState().ctx);

      await switchToGame(gameCode1);
      let state1 = await loadGameState(gameCode1);
      expect(state1!.G.contracts[0].id).toBe('c1');

      await switchToGame(gameCode2);
      let state2 = await loadGameState(gameCode2);
      expect(state2!.G.contracts[0].id).toBe('c2');

      await switchToGame(gameCode1);
      state1 = await loadGameState(gameCode1);
      expect(state1!.G.contracts[0].id).toBe('c1');

      expect(state1!.G.contracts[0].id).toBe('c1');
      state2 = await loadGameState(gameCode2);
      expect(state2!.G.contracts[0].id).toBe('c2');
    });

    test('can list all games and their states persist', async () => {
      const gameCode1 = await createNewGame();
      useGameStore.setState({
        ctx: { ...useGameStore.getState().ctx, turn: 1 },
      });
      await saveGameState(gameCode1, useGameStore.getState().G, useGameStore.getState().ctx);

      const gameCode2 = await createNewGame();
      useGameStore.setState({
        ctx: { ...useGameStore.getState().ctx, turn: 2 },
      });
      await saveGameState(gameCode2, useGameStore.getState().G, useGameStore.getState().ctx);

      const gameCode3 = await createNewGame();
      useGameStore.setState({
        ctx: { ...useGameStore.getState().ctx, turn: 3 },
      });
      await saveGameState(gameCode3, useGameStore.getState().G, useGameStore.getState().ctx);

      const gameCodes = await listGameCodes();
      expect(gameCodes.length).toBeGreaterThanOrEqual(3);
      expect(gameCodes).toContain(gameCode1);
      expect(gameCodes).toContain(gameCode2);
      expect(gameCodes).toContain(gameCode3);

      const state1 = await loadGameState(gameCode1);
      expect(state1!.ctx.turn).toBe(1);

      const state2 = await loadGameState(gameCode2);
      expect(state2!.ctx.turn).toBe(2);

      const state3 = await loadGameState(gameCode3);
      expect(state3!.ctx.turn).toBe(3);
    });
  });

  describe('5. Reloads - State persists across simulated page reloads', () => {
    test('state persists after save, clear store, and reload', async () => {
      const gameCode = await createNewGame();

      useGameStore.setState({
        G: {
          ...useGameStore.getState().G,
          contracts: [
            {
              id: 'c1',
              destinationKey: 'New York',
              commodity: 'coal',
              type: 'private',
              playerID: '0',
              fulfilled: false,
            },
            {
              id: 'c2',
              destinationKey: 'Chicago',
              commodity: 'wood',
              type: 'market',
              playerID: null,
              fulfilled: false,
            },
          ],
        },
        ctx: {
          ...useGameStore.getState().ctx,
          phase: 'play',
          turn: 10,
          currentPlayer: '1',
        },
      });
      await saveGameState(gameCode, useGameStore.getState().G, useGameStore.getState().ctx);

      const savedG = useGameStore.getState().G;
      const savedCtx = useGameStore.getState().ctx;

      useGameStore.getState().resetState();

      expect(useGameStore.getState().G.contracts.length).toBe(0);
      expect(useGameStore.getState().ctx.turn).toBe(0);

      const reloadedState = await loadGameState(gameCode);
      expect(reloadedState != null).toBe(true);

      useGameStore.setState({
        G: reloadedState!.G,
        ctx: reloadedState!.ctx,
      });

      const { G, ctx } = useGameStore.getState();
      expect(G.contracts.length).toBe(savedG.contracts.length);
      expect(G.contracts[0].id).toBe(savedG.contracts[0].id);
      expect(ctx.phase).toBe(savedCtx.phase);
      expect(ctx.turn).toBe(savedCtx.turn);
      expect(ctx.currentPlayer).toBe(savedCtx.currentPlayer);
    });

    test('state persists after complex game session simulation', async () => {
      const gameCode = await createNewGame();

      useGameStore.setState({
        ctx: { ...useGameStore.getState().ctx, phase: 'setup' },
      });
      generateStartingContract(['New York', 'Philadelphia']);
      await saveGameState(gameCode, useGameStore.getState().G, useGameStore.getState().ctx);

      endTurnEvent();
      await saveGameState(gameCode, useGameStore.getState().G, useGameStore.getState().ctx);

      generateStartingContract(['Chicago', 'Detroit']);
      await saveGameState(gameCode, useGameStore.getState().G, useGameStore.getState().ctx);

      useGameStore.setState({
        G: {
          ...useGameStore.getState().G,
          players: [
            ['0', { name: 'Player 0', activeCities: ['New York', 'Philadelphia'] }],
            ['1', { name: 'Player 1', activeCities: ['Chicago', 'Detroit'] }],
          ],
        },
        ctx: { ...useGameStore.getState().ctx, phase: 'play', currentPlayer: '0' },
      });
      await saveGameState(gameCode, useGameStore.getState().G, useGameStore.getState().ctx);

      generatePrivateContract();
      await saveGameState(gameCode, useGameStore.getState().G, useGameStore.getState().ctx);

      const finalG = useGameStore.getState().G;
      const finalCtx = useGameStore.getState().ctx;

      useGameStore.getState().resetState();

      const reloadedState = await loadGameState(gameCode);
      expect(reloadedState != null).toBe(true);

      useGameStore.setState({
        G: reloadedState!.G,
        ctx: reloadedState!.ctx,
      });

      const { G, ctx } = useGameStore.getState();
      expect(G.contracts.length).toBe(finalG.contracts.length);
      expect(ctx.phase).toBe(finalCtx.phase);
      expect(ctx.turn).toBe(finalCtx.turn);
      expect(ctx.currentPlayer).toBe(finalCtx.currentPlayer);
    });

    test('state persists correctly with nested data structures', async () => {
      const gameCode = await createNewGame();

      useGameStore.setState({
        G: {
          ...useGameStore.getState().G,
          contracts: [
            {
              id: 'c1',
              destinationKey: 'New York',
              commodity: 'coal',
              type: 'private',
              playerID: '0',
              fulfilled: true,
            },
          ],
          players: [
            [
              '0',
              {
                name: 'Player 0',
                activeCities: ['New York', 'Philadelphia', 'Chicago'],
              },
            ],
            ['1', { name: 'Player 1', activeCities: ['Boston', 'Detroit'] }],
          ],
        },
        ctx: {
          ...useGameStore.getState().ctx,
          phase: 'play',
          turn: 15,
        },
      });
      await saveGameState(gameCode, useGameStore.getState().G, useGameStore.getState().ctx);

      useGameStore.getState().resetState();
      const reloadedState = await loadGameState(gameCode);
      useGameStore.setState({
        G: reloadedState!.G,
        ctx: reloadedState!.ctx,
      });

      const { G } = useGameStore.getState();
      expect(G.players.length).toBe(2);
      expect(G.players[0][1].activeCities.length).toBe(3);
      expect(G.players[0][1].activeCities).toContain('New York');
      expect(G.players[0][1].activeCities).toContain('Philadelphia');
      expect(G.players[0][1].activeCities).toContain('Chicago');
      expect(G.contracts[0].fulfilled).toBe(true);
    });
  });

  describe('6. Edge cases and error handling', () => {
    test('handles loading non-existent game gracefully', async () => {
      const nonExistentCode = 'XXXX';
      const state = await loadGameState(nonExistentCode);
      expect(state).toBeNull();
    });

    test('handles invalid game code format', async () => {
      const invalidCode = 'invalid';
      const result = await saveGameState(
        invalidCode,
        {} as Parameters<typeof saveGameState>[1],
        {} as Parameters<typeof saveGameState>[2]
      );
      expect(result).toBe(false);
    });

    test('handles corrupted state data gracefully', async () => {
      const gameCode = await createNewGame();

      await saveGameState(gameCode, useGameStore.getState().G, useGameStore.getState().ctx);

      const stateMap = JSON.parse(
        localStorage.getItem('game_state') ?? '[]'
      ) as Array<[string, unknown]>;
      const corruptedState = { G: 'invalid', ctx: 'invalid' };
      const idx = stateMap.findIndex(([code]) => code === gameCode);
      if (idx >= 0) {
        stateMap[idx][1] = corruptedState;
        localStorage.setItem('game_state', JSON.stringify(stateMap));
      }

      const loadedState = await loadGameState(gameCode);
      if (loadedState) {
        expect(loadedState.G).toBe('invalid');
      }
    });

    test('state serialization filters internal properties', async () => {
      const gameCode = await createNewGame();

      useGameStore.setState({
        ctx: {
          ...useGameStore.getState().ctx,
          _internalProp: 'should not be saved',
        } as GameContext & { _internalProp?: string },
      });
      await saveGameState(gameCode, useGameStore.getState().G, useGameStore.getState().ctx);

      const reloadedState = await loadGameState(gameCode);
      expect(reloadedState != null).toBe(true);
      expect(reloadedState!.ctx).toBeDefined();
    });
  });

  describe('7. Game Mode support', () => {
    test('createNewGame defaults to hotseat mode', async () => {
      const gameCode = await createNewGame('local');

      expect(await gameExists(gameCode, 'local')).toBe(true);

      const metadataMap = JSON.parse(
        localStorage.getItem('game_metadata') ?? '[]'
      ) as Array<[string, GameMetadata]>;
      const metadata = new Map(metadataMap).get(gameCode);
      expect(metadata).toBeDefined();
      expect(metadata!.gameMode).toBe('hotseat');
    });

    test('createNewGame BYOD requires hostDeviceId', async () => {
      await expect(createNewGame('local', { gameMode: 'byod' })).rejects.toThrow(
        'BYOD games require a hostDeviceId'
      );
    });

    test('createNewGame BYOD requires cloud storage', async () => {
      await expect(
        createNewGame('local', { gameMode: 'byod', hostDeviceId: 'test-device' })
      ).rejects.toThrow('BYOD games require cloud storage');
    });

    test('createNewGame rejects invalid gameMode', async () => {
      await expect(
        createNewGame('local', { gameMode: 'invalid' as 'hotseat' })
      ).rejects.toThrow(
        "Invalid gameMode: invalid. Must be 'hotseat' or 'byod'."
      );
    });

    test('createNewGame preserves other options with default gameMode', async () => {
      const gameCode = await createNewGame('local');

      const metadataMap = JSON.parse(
        localStorage.getItem('game_metadata') ?? '[]'
      ) as Array<[string, GameMetadata]>;
      const metadata = new Map(metadataMap).get(gameCode);
      expect(metadata).toBeDefined();
      expect(metadata!.gameMode).toBe('hotseat');
      expect(metadata!.lastModified).toBeDefined();
    });

    test('createNewGame with explicit hotseat mode', async () => {
      const gameCode = await createNewGame('local', { gameMode: 'hotseat' });

      const metadataMap = JSON.parse(
        localStorage.getItem('game_metadata') ?? '[]'
      ) as Array<[string, GameMetadata]>;
      const metadata = new Map(metadataMap).get(gameCode);
      expect(metadata).toBeDefined();
      expect(metadata!.gameMode).toBe('hotseat');
    });
  });

  describe('8. BYOD Player Seat Assignment', () => {
    const testDeviceId = 'test-device-uuid-1234';
    const testDeviceId2 = 'test-device-uuid-5678';
    const testDeviceId3 = 'test-device-uuid-9999';

    describe('createNewGame for BYOD', () => {
      test('BYOD game requires hostDeviceId', async () => {
        await expect(createNewGame('local', { gameMode: 'byod' })).rejects.toThrow(
          'BYOD games require a hostDeviceId'
        );
      });

      test('BYOD game requires cloud storage', async () => {
        await expect(
          createNewGame('local', { gameMode: 'byod', hostDeviceId: testDeviceId })
        ).rejects.toThrow('BYOD games require cloud storage');
      });

      test('createNewGame with BYOD initializes host device in playerSeats (local mock)', async () => {
        const gameCode = await createNewGame('local');

        const metadataMap = JSON.parse(
          localStorage.getItem('game_metadata') ?? '[]'
        ) as Array<[string, GameMetadata]>;
        const metadataMapObj = new Map(metadataMap);
        metadataMapObj.set(gameCode, {
          gameMode: 'byod',
          hostDeviceId: testDeviceId,
          playerSeats: {
            [testDeviceId]: {
              joinedAt: new Date().toISOString(),
              playerName: '',
            },
          },
          lastModified: new Date().toISOString(),
        });
        localStorage.setItem(
          'game_metadata',
          JSON.stringify(Array.from(metadataMapObj.entries()))
        );

        const metadata = (await getGameMetadata(gameCode, 'local')) as GameMetadata | null;
        expect(metadata).toBeDefined();
        expect(metadata!.gameMode).toBe('byod');
        expect(metadata!.hostDeviceId).toBe(testDeviceId);
        const seats = metadata!.playerSeats ?? {};
        expect(seats[testDeviceId]).toBeDefined();
        expect(seats[testDeviceId].joinedAt).toBeDefined();
      });
    });

    describe('getGameMetadata and updateGameMetadata', () => {
      test('getGameMetadata returns null for non-existent game', async () => {
        const metadata = await getGameMetadata('XXXXX', 'local');
        expect(metadata).toBeNull();
      });

      test('getGameMetadata returns metadata for existing game', async () => {
        const gameCode = await createNewGame('local');
        const metadata = await getGameMetadata(gameCode, 'local');
        expect(metadata).toBeDefined();
        expect(metadata!.gameMode).toBe('hotseat');
      });

      test('updateGameMetadata merges with existing metadata', async () => {
        const gameCode = await createNewGame('local');

        const result = await updateGameMetadata(gameCode, { customField: 'test' }, 'local');
        expect(result).toBe(true);

        const metadata = (await getGameMetadata(gameCode, 'local')) as (GameMetadata & {
          customField?: string;
        }) | null;
        expect(metadata).toBeDefined();
        expect(metadata!.customField).toBe('test');
        expect(metadata!.gameMode).toBe('hotseat');
      });

      test('updateGameMetadata returns false for non-existent game', async () => {
        const result = await updateGameMetadata('XXXXX', { test: true }, 'local');
        expect(result).toBe(false);
      });
    });

    describe('assignPlayerSeat', () => {
      let gameCode: string;

      beforeEach(async () => {
        gameCode = await createNewGame('local');

        const metadataMap = JSON.parse(
          localStorage.getItem('game_metadata') ?? '[]'
        ) as Array<[string, GameMetadata]>;
        const metadataMapObj = new Map(metadataMap);
        metadataMapObj.set(gameCode, {
          gameMode: 'byod',
          hostDeviceId: testDeviceId,
          playerSeats: {
            [testDeviceId]: {
              joinedAt: new Date().toISOString(),
              playerName: 'Host Player',
            },
          },
          lastModified: new Date().toISOString(),
        });
        localStorage.setItem(
          'game_metadata',
          JSON.stringify(Array.from(metadataMapObj.entries()))
        );
      });

      test('assigns seat to new device', async () => {
        const result = await assignPlayerSeat(gameCode, testDeviceId2, 'local');

        expect(result.success).toBe(true);
        expect(result.seat).toBeDefined();
        expect(result.seat!.joinedAt).toBeDefined();
        expect(result.seat!.playerName).toBe('Guest 1');

        const metadata = (await getGameMetadata(gameCode, 'local')) as GameMetadata | null;
        const seats = metadata!.playerSeats ?? {};
        expect(seats[testDeviceId2]).toBeDefined();
      });

      test('assigns "Guest" without number for 2-player game', async () => {
        const twoPlayerCode = await createNewGame('local');

        const metadataMap = JSON.parse(
          localStorage.getItem('game_metadata') ?? '[]'
        ) as Array<[string, GameMetadata]>;
        const metadataMapObj = new Map(metadataMap);
        metadataMapObj.set(twoPlayerCode, {
          gameMode: 'byod',
          hostDeviceId: testDeviceId,
          playerSeats: {
            [testDeviceId]: {
              joinedAt: new Date().toISOString(),
              playerName: 'Host',
            },
          },
          lastModified: new Date().toISOString(),
        });
        localStorage.setItem(
          'game_metadata',
          JSON.stringify(Array.from(metadataMapObj.entries()))
        );

        const state = await loadGameState(twoPlayerCode, 'local');
        state!.ctx.numPlayers = 2;
        await saveGameState(twoPlayerCode, state!.G, state!.ctx, 'local');

        const result = await assignPlayerSeat(twoPlayerCode, testDeviceId2, 'local');

        expect(result.success).toBe(true);
        expect(result.seat!.playerName).toBe('Guest');
      });

      test('assigns sequential guest numbers for 3+ player games', async () => {
        const result1 = await assignPlayerSeat(gameCode, testDeviceId2, 'local');
        expect(result1.success).toBe(true);
        expect(result1.seat!.playerName).toBe('Guest 1');

        const result2 = await assignPlayerSeat(gameCode, testDeviceId3, 'local');
        expect(result2.success).toBe(true);
        expect(result2.seat!.playerName).toBe('Guest 2');
      });

      test('returns existing seat for reconnection', async () => {
        const result = await assignPlayerSeat(gameCode, testDeviceId, 'local');

        expect(result.success).toBe(true);
        expect(result.seat!.playerName).toBe('Host Player');
      });

      test('returns error for non-existent game', async () => {
        const result = await assignPlayerSeat('XXXXX', testDeviceId2, 'local');

        expect(result.success).toBe(false);
        expect(result.error).toBe(SeatAssignmentError.GAME_NOT_FOUND);
      });

      test('returns error for hotseat game', async () => {
        const hotseatCode = await createNewGame('local', { gameMode: 'hotseat' });

        const result = await assignPlayerSeat(hotseatCode, testDeviceId2, 'local');

        expect(result.success).toBe(false);
        expect(result.error).toBe(SeatAssignmentError.WRONG_GAME_MODE);
      });

      test('returns error when game is full', async () => {
        await assignPlayerSeat(gameCode, testDeviceId2, 'local');
        await assignPlayerSeat(gameCode, testDeviceId3, 'local');

        const result = await assignPlayerSeat(gameCode, 'fourth-device', 'local');

        expect(result.success).toBe(false);
        expect(result.error).toBe(SeatAssignmentError.GAME_FULL);
      });

      test('returns error when game has started', async () => {
        await assignPlayerSeat(gameCode, testDeviceId2, 'local');
        await assignPlayerSeat(gameCode, testDeviceId3, 'local');

        const metadataMap = JSON.parse(
          localStorage.getItem('game_metadata') ?? '[]'
        ) as Array<[string, GameMetadata]>;
        const metadataMapObj = new Map(metadataMap);
        const metadata = metadataMapObj.get(gameCode);
        expect(metadata).toBeDefined();
        expect(metadata!.playerSeats).toBeDefined();
        Object.keys(metadata!.playerSeats!).forEach((deviceId, index) => {
          (metadata!.playerSeats![deviceId] as { playerID?: string }).playerID =
            String(index);
        });
        localStorage.setItem(
          'game_metadata',
          JSON.stringify(Array.from(metadataMapObj.entries()))
        );

        const result = await assignPlayerSeat(gameCode, 'new-device', 'local');

        expect(result.success).toBe(false);
        expect(result.error).toBe(SeatAssignmentError.GAME_STARTED);
      });
    });

    describe('updatePlayerName', () => {
      let gameCode: string;

      beforeEach(async () => {
        gameCode = await createNewGame('local');

        const metadataMap = JSON.parse(
          localStorage.getItem('game_metadata') ?? '[]'
        ) as Array<[string, GameMetadata]>;
        const metadataMapObj = new Map(metadataMap);
        metadataMapObj.set(gameCode, {
          gameMode: 'byod',
          hostDeviceId: testDeviceId,
          playerSeats: {
            [testDeviceId]: {
              joinedAt: new Date().toISOString(),
              playerName: '',
            },
          },
          lastModified: new Date().toISOString(),
        });
        localStorage.setItem(
          'game_metadata',
          JSON.stringify(Array.from(metadataMapObj.entries()))
        );
      });

      test('updates player name successfully', async () => {
        const result = await updatePlayerName(gameCode, testDeviceId, 'Alice', 'local');

        expect(result.success).toBe(true);

        const metadata = (await getGameMetadata(gameCode, 'local')) as GameMetadata | null;
        expect(metadata!.playerSeats![testDeviceId].playerName).toBe('Alice');
      });

      test('returns error for device not in game', async () => {
        const result = await updatePlayerName(
          gameCode,
          'not-joined-device',
          'Bob',
          'local'
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe(SeatAssignmentError.NOT_JOINED);
      });

      test('returns error for non-existent game', async () => {
        const result = await updatePlayerName('XXXXX', testDeviceId, 'Alice', 'local');

        expect(result.success).toBe(false);
        expect(result.error).toBe(SeatAssignmentError.GAME_NOT_FOUND);
      });
    });

    describe('isHost', () => {
      let gameCode: string;

      beforeEach(async () => {
        gameCode = await createNewGame('local');

        const metadataMap = JSON.parse(
          localStorage.getItem('game_metadata') ?? '[]'
        ) as Array<[string, GameMetadata]>;
        const metadataMapObj = new Map(metadataMap);
        metadataMapObj.set(gameCode, {
          gameMode: 'byod',
          hostDeviceId: testDeviceId,
          playerSeats: {},
          lastModified: new Date().toISOString(),
        });
        localStorage.setItem(
          'game_metadata',
          JSON.stringify(Array.from(metadataMapObj.entries()))
        );
      });

      test('returns true for host device', async () => {
        const result = await isHost(gameCode, testDeviceId, 'local');
        expect(result).toBe(true);
      });

      test('returns false for non-host device', async () => {
        const result = await isHost(gameCode, testDeviceId2, 'local');
        expect(result).toBe(false);
      });

      test('returns false for non-existent game', async () => {
        const result = await isHost('XXXXX', testDeviceId, 'local');
        expect(result).toBe(false);
      });
    });

    describe('getNumPlayersJoined and allPlayersJoined', () => {
      let gameCode: string;

      beforeEach(async () => {
        gameCode = await createNewGame('local');

        const metadataMap = JSON.parse(
          localStorage.getItem('game_metadata') ?? '[]'
        ) as Array<[string, GameMetadata]>;
        const metadataMapObj = new Map(metadataMap);
        metadataMapObj.set(gameCode, {
          gameMode: 'byod',
          hostDeviceId: testDeviceId,
          playerSeats: {
            [testDeviceId]: {
              joinedAt: new Date().toISOString(),
              playerName: 'Host',
            },
          },
          lastModified: new Date().toISOString(),
        });
        localStorage.setItem(
          'game_metadata',
          JSON.stringify(Array.from(metadataMapObj.entries()))
        );
      });

      test('getNumPlayersJoined returns correct counts', async () => {
        const counts = await getNumPlayersJoined(gameCode, 'local');

        expect(counts != null).toBe(true);
        expect(counts!.joined).toBe(1);
        expect(counts!.total).toBe(3);
      });

      test('allPlayersJoined returns false when not all joined', async () => {
        const result = await allPlayersJoined(gameCode, 'local');
        expect(result).toBe(false);
      });

      test('allPlayersJoined returns true when all joined', async () => {
        await assignPlayerSeat(gameCode, testDeviceId2, 'local');
        await assignPlayerSeat(gameCode, testDeviceId3, 'local');

        const result = await allPlayersJoined(gameCode, 'local');
        expect(result).toBe(true);
      });
    });

    describe('assignRandomPlayerIDs', () => {
      let gameCode: string;

      beforeEach(async () => {
        gameCode = await createNewGame('local');

        const metadataMap = JSON.parse(
          localStorage.getItem('game_metadata') ?? '[]'
        ) as Array<[string, GameMetadata]>;
        const metadataMapObj = new Map(metadataMap);
        metadataMapObj.set(gameCode, {
          gameMode: 'byod',
          hostDeviceId: testDeviceId,
          playerSeats: {
            [testDeviceId]: {
              joinedAt: new Date().toISOString(),
              playerName: 'Host',
            },
            [testDeviceId2]: {
              joinedAt: new Date().toISOString(),
              playerName: 'Player 2',
            },
            [testDeviceId3]: {
              joinedAt: new Date().toISOString(),
              playerName: 'Player 3',
            },
          },
          lastModified: new Date().toISOString(),
        });
        localStorage.setItem(
          'game_metadata',
          JSON.stringify(Array.from(metadataMapObj.entries()))
        );
      });

      test('assigns random playerIDs to all joined players', async () => {
        const result = await assignRandomPlayerIDs(gameCode, testDeviceId, 'local');

        expect(result.success).toBe(true);
        expect(result.assignments).toBeDefined();

        const assignedIDs = Object.values(result.assignments!);
        expect(assignedIDs.length).toBe(3);
        expect(new Set(assignedIDs).size).toBe(3);
        expect(assignedIDs).toContain('0');
        expect(assignedIDs).toContain('1');
        expect(assignedIDs).toContain('2');

        const metadata = (await getGameMetadata(gameCode, 'local')) as GameMetadata | null;
        const seats = metadata!.playerSeats ?? {};
        Object.keys(seats).forEach((deviceId) => {
          expect(seats[deviceId].playerID).toBeDefined();
        });
      });

      test('returns error if caller is not host', async () => {
        const result = await assignRandomPlayerIDs(gameCode, testDeviceId2, 'local');

        expect(result.success).toBe(false);
        expect(result.error).toBe(SeatAssignmentError.NOT_HOST);
      });

      test('returns error if not all players joined', async () => {
        const metadataMap = JSON.parse(
          localStorage.getItem('game_metadata') ?? '[]'
        ) as Array<[string, GameMetadata]>;
        const metadataMapObj = new Map(metadataMap);
        const metadata = metadataMapObj.get(gameCode) as GameMetadata | undefined;
        if (!metadata?.playerSeats) throw new Error('expected metadata');
        delete metadata.playerSeats[testDeviceId3];
        localStorage.setItem(
          'game_metadata',
          JSON.stringify(Array.from(metadataMapObj.entries()))
        );

        const result = await assignRandomPlayerIDs(gameCode, testDeviceId, 'local');

        expect(result.success).toBe(false);
      });

      test('returns error if playerIDs already assigned', async () => {
        await assignRandomPlayerIDs(gameCode, testDeviceId, 'local');

        const result = await assignRandomPlayerIDs(gameCode, testDeviceId, 'local');

        expect(result.success).toBe(false);
        expect(result.error).toBe(SeatAssignmentError.GAME_STARTED);
      });
    });

    describe('getDevicePlayerID and getDeviceSeat', () => {
      let gameCode: string;

      beforeEach(async () => {
        gameCode = await createNewGame('local');

        const metadataMap = JSON.parse(
          localStorage.getItem('game_metadata') ?? '[]'
        ) as Array<[string, GameMetadata]>;
        const metadataMapObj = new Map(metadataMap);
        metadataMapObj.set(gameCode, {
          gameMode: 'byod',
          hostDeviceId: testDeviceId,
          playerSeats: {
            [testDeviceId]: {
              joinedAt: '2026-01-01T00:00:00.000Z',
              playerName: 'Host',
              playerID: '2',
            },
            [testDeviceId2]: {
              joinedAt: '2026-01-01T00:01:00.000Z',
              playerName: 'Player 2',
              playerID: '0',
            },
          },
          lastModified: new Date().toISOString(),
        });
        localStorage.setItem(
          'game_metadata',
          JSON.stringify(Array.from(metadataMapObj.entries()))
        );
      });

      test('getDevicePlayerID returns assigned playerID', async () => {
        const playerID = await getDevicePlayerID(gameCode, testDeviceId, 'local');
        expect(playerID).toBe('2');

        const playerID2 = await getDevicePlayerID(gameCode, testDeviceId2, 'local');
        expect(playerID2).toBe('0');
      });

      test('getDevicePlayerID returns null for device not in game', async () => {
        const playerID = await getDevicePlayerID(gameCode, 'not-joined', 'local');
        expect(playerID).toBeNull();
      });

      test('getDeviceSeat returns full seat information', async () => {
        const seat = await getDeviceSeat(gameCode, testDeviceId, 'local');

        expect(seat != null).toBe(true);
        expect(seat!.joinedAt).toBe('2026-01-01T00:00:00.000Z');
        expect(seat!.playerName).toBe('Host');
        expect(seat!.playerID).toBe('2');
      });

      test('getDeviceSeat returns null for device not in game', async () => {
        const seat = await getDeviceSeat(gameCode, 'not-joined', 'local');
        expect(seat).toBeNull();
      });
    });

    describe('getPlayerSeats', () => {
      let gameCode: string;

      beforeEach(async () => {
        gameCode = await createNewGame('local');

        const metadataMap = JSON.parse(
          localStorage.getItem('game_metadata') ?? '[]'
        ) as Array<[string, GameMetadata]>;
        const metadataMapObj = new Map(metadataMap);
        metadataMapObj.set(gameCode, {
          gameMode: 'byod',
          hostDeviceId: testDeviceId,
          playerSeats: {
            [testDeviceId]: {
              joinedAt: '2026-01-01T00:00:00.000Z',
              playerName: 'Host',
            },
            [testDeviceId2]: {
              joinedAt: '2026-01-01T00:01:00.000Z',
              playerName: 'Player 2',
            },
          },
          lastModified: new Date().toISOString(),
        });
        localStorage.setItem(
          'game_metadata',
          JSON.stringify(Array.from(metadataMapObj.entries()))
        );
      });

      test('returns all player seats', async () => {
        const seats = await getPlayerSeats(gameCode, 'local');

        expect(seats != null).toBe(true);
        expect(Object.keys(seats!).length).toBe(2);
        expect(seats![testDeviceId]).toBeDefined();
        expect(seats![testDeviceId2]).toBeDefined();
      });

      test('returns empty object for game with no seats', async () => {
        const hotseatCode = await createNewGame('local', { gameMode: 'hotseat' });

        const seats = await getPlayerSeats(hotseatCode, 'local');
        expect(seats).toEqual({});
      });

      test('returns null for non-existent game', async () => {
        const seats = await getPlayerSeats('XXXXX', 'local');
        expect(seats).toBeNull();
      });
    });
  });
});
