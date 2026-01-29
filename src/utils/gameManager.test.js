/**
 * Comprehensive persistence tests for game state management
 * Tests persistence across moves, turns, phases, game switching, and reloads
 */

import { vi } from 'vitest';
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
} from './gameManager';
import { useGameStore } from '../stores/gameStore';
import { generateStartingContract, generatePrivateContract, toggleContractFulfilled, endTurn } from '../stores/gameActions';
import { endTurn as endTurnEvent } from '../stores/events';
import { checkPhaseTransition } from '../stores/phaseManager';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

// Setup localStorage mock before all tests
beforeAll(() => {
  global.localStorage = localStorageMock;
});

// Clear localStorage and reset store before each test
beforeEach(() => {
  localStorageMock.clear();
  useGameStore.getState().resetState();
  vi.clearAllMocks();
});

describe('Persistence Tests', () => {
  describe('1. Moves - State persists after moves', () => {
    test('state persists after generateStartingContract', () => {
      const gameCode = createNewGame();
      const { G: initialG, ctx: initialCtx } = useGameStore.getState();

      // Perform move
      generateStartingContract(['New York', 'Philadelphia']);

      // Verify state was saved
      const savedState = loadGameState(gameCode);
      expect(savedState).not.toBeNull();
      expect(savedState.G.contracts.length).toBeGreaterThan(initialG.contracts.length);
      expect(savedState.ctx.currentPlayer).toBeDefined();
    });

    test('state persists after generatePrivateContract', () => {
      const gameCode = createNewGame();
      
      // Set up game in play phase with active cities for the current player
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
        }
      });
      saveGameState(gameCode, useGameStore.getState().G, useGameStore.getState().ctx);

      const { G: initialG } = useGameStore.getState();
      const initialContractCount = initialG.contracts.length;

      // Perform move
      generatePrivateContract();

      // Verify state was saved
      const savedState = loadGameState(gameCode);
      expect(savedState).not.toBeNull();
      expect(savedState.G.contracts.length).toBe(initialContractCount + 1);
    });

    test('state persists after toggleContractFulfilled', () => {
      const gameCode = createNewGame();
      
      // Set up game in play phase with a contract
      useGameStore.setState({
        G: {
          ...useGameStore.getState().G,
          contracts: [{
            id: 'test-contract-1',
            destinationKey: 'Chicago',
            commodity: 'coal',
            type: 'private',
            playerID: '0',
            fulfilled: false,
          }],
        },
        ctx: {
          ...useGameStore.getState().ctx,
          phase: 'play',
          currentPlayer: '0',
        }
      });
      saveGameState(gameCode, useGameStore.getState().G, useGameStore.getState().ctx);

      // Perform move
      toggleContractFulfilled('test-contract-1');

      // Verify state was saved
      const savedState = loadGameState(gameCode);
      expect(savedState).not.toBeNull();
      const contract = savedState.G.contracts.find(c => c.id === 'test-contract-1');
      expect(contract).toBeDefined();
      expect(contract.fulfilled).toBe(true);
    });

    test('state persists after multiple moves in sequence', () => {
      const gameCode = createNewGame();
      
      // Set up game in play phase with active cities for the current player
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
        }
      });
      saveGameState(gameCode, useGameStore.getState().G, useGameStore.getState().ctx);

      // Perform multiple moves
      generatePrivateContract();
      generatePrivateContract();
      generatePrivateContract();

      // Verify state was saved with all changes
      const savedState = loadGameState(gameCode);
      expect(savedState).not.toBeNull();
      expect(savedState.G.contracts.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('2. Turns - State persists after turn changes', () => {
    test('state persists after endTurn', () => {
      const gameCode = createNewGame();
      const { ctx: initialCtx } = useGameStore.getState();
      const initialPlayer = initialCtx.currentPlayer;
      const initialTurn = initialCtx.turn;

      // Perform turn end
      endTurnEvent();

      // Verify state was saved
      const savedState = loadGameState(gameCode);
      expect(savedState).not.toBeNull();
      
      // Verify turn advanced
      const { ctx: savedCtx } = savedState;
      expect(savedCtx.currentPlayer).not.toBe(initialPlayer);
      expect(savedCtx.playOrderPos).toBe((initialCtx.playOrderPos + 1) % initialCtx.playOrder.length);
    });

    test('state persists after turn wraps to new round', () => {
      const gameCode = createNewGame();
      
      // Set up game with player 1's turn (last player)
      useGameStore.setState({
        ctx: {
          ...useGameStore.getState().ctx,
          currentPlayer: '1',
          playOrderPos: 1,
          turn: 5,
        }
      });
      saveGameState(gameCode, useGameStore.getState().G, useGameStore.getState().ctx);

      const initialTurn = useGameStore.getState().ctx.turn;

      // Perform turn end (should wrap to player 0 and increment turn)
      endTurnEvent();

      // Verify state was saved
      const savedState = loadGameState(gameCode);
      expect(savedState).not.toBeNull();
      
      // Verify turn number incremented
      expect(savedState.ctx.turn).toBe(initialTurn + 1);
      expect(savedState.ctx.currentPlayer).toBe('0');
      expect(savedState.ctx.playOrderPos).toBe(0);
    });

    test('state persists after multiple turn changes', () => {
      const gameCode = createNewGame();
      const initialTurn = useGameStore.getState().ctx.turn;

      // Perform multiple turn ends
      endTurnEvent();
      endTurnEvent();
      endTurnEvent();

      // Verify state was saved
      const savedState = loadGameState(gameCode);
      expect(savedState).not.toBeNull();
      
      // After 3 turn ends with 2 players:
      // Turn 1: player 0 -> player 1 (turn stays 0)
      // Turn 2: player 1 -> player 0 (turn increments to 1)
      // Turn 3: player 0 -> player 1 (turn stays 1)
      // So we should be at player 1, turn 1
      expect(savedState.ctx.currentPlayer).toBe('1');
      expect(savedState.ctx.turn).toBe(initialTurn + 1);
    });
  });

  describe('3. Phases - State persists after phase transitions', () => {
    test('state persists after phase transition from setup to play', () => {
      const gameCode = createNewGame();
      
      // Set up game in setup phase with all players having contracts
      useGameStore.setState({
        G: {
          ...useGameStore.getState().G,
          contracts: [
            { id: 'c1', destinationKey: 'New York', commodity: 'coal', type: 'private', playerID: '0', fulfilled: false },
            { id: 'c2', destinationKey: 'Chicago', commodity: 'wood', type: 'private', playerID: '1', fulfilled: false },
          ],
        },
        ctx: {
          ...useGameStore.getState().ctx,
          phase: 'setup',
          currentPlayer: '1',
          playOrderPos: 1,
        }
      });
      saveGameState(gameCode, useGameStore.getState().G, useGameStore.getState().ctx);

      // Trigger phase transition
      const transitioned = checkPhaseTransition(
        useGameStore.getState().G,
        useGameStore.getState().ctx
      );

      // Verify phase transition occurred
      expect(transitioned).toBe(true);

      // Verify state was saved
      const savedState = loadGameState(gameCode);
      expect(savedState).not.toBeNull();
      expect(savedState.ctx.phase).toBe('play');
    });

    test('state persists even when phase transition does not occur', () => {
      const gameCode = createNewGame();
      
      // Set up game in setup phase without all players having contracts
      useGameStore.setState({
        G: {
          ...useGameStore.getState().G,
          contracts: [
            { id: 'c1', destinationKey: 'New York', commodity: 'coal', type: 'private', playerID: '0', fulfilled: false },
          ],
        },
        ctx: {
          ...useGameStore.getState().ctx,
          phase: 'setup',
        }
      });
      saveGameState(gameCode, useGameStore.getState().G, useGameStore.getState().ctx);

      const initialPhase = useGameStore.getState().ctx.phase;

      // Trigger phase transition check (should not transition)
      const transitioned = checkPhaseTransition(
        useGameStore.getState().G,
        useGameStore.getState().ctx
      );

      // Verify phase did not transition
      expect(transitioned).toBe(false);

      // Verify state was still saved (even though no transition occurred)
      // Note: checkPhaseTransition only saves if transition occurs, but moves save after calling it
      const savedState = loadGameState(gameCode);
      expect(savedState).not.toBeNull();
      expect(savedState.ctx.phase).toBe(initialPhase);
    });
  });

  describe('4. Game switching - State persists when switching between games', () => {
    test('can create and switch between multiple games', async () => {
      // Create first game
      const gameCode1 = await createNewGame();
      useGameStore.setState({
        G: {
          ...useGameStore.getState().G,
          contracts: [{ id: 'c1', destinationKey: 'New York', commodity: 'coal', type: 'private', playerID: '0', fulfilled: false }],
        },
        ctx: {
          ...useGameStore.getState().ctx,
          turn: 5,
        }
      });
      await saveGameState(gameCode1, useGameStore.getState().G, useGameStore.getState().ctx);

      // Create second game
      const gameCode2 = await createNewGame();
      useGameStore.setState({
        G: {
          ...useGameStore.getState().G,
          contracts: [{ id: 'c2', destinationKey: 'Chicago', commodity: 'wood', type: 'private', playerID: '0', fulfilled: false }],
        },
        ctx: {
          ...useGameStore.getState().ctx,
          turn: 10,
        }
      });
      await saveGameState(gameCode2, useGameStore.getState().G, useGameStore.getState().ctx);

      // Verify both games exist
      expect(await gameExists(gameCode1, 'local')).toBe(true);
      expect(await gameExists(gameCode2, 'local')).toBe(true);

      // Switch to first game and verify state
      await switchToGame(gameCode1);
      const state1 = await loadGameState(gameCode1);
      expect(state1).not.toBeNull();
      expect(state1.G.contracts.length).toBe(1);
      expect(state1.G.contracts[0].id).toBe('c1');
      expect(state1.ctx.turn).toBe(5);

      // Switch to second game and verify state
      await switchToGame(gameCode2);
      const state2 = await loadGameState(gameCode2);
      expect(state2).not.toBeNull();
      expect(state2.G.contracts.length).toBe(1);
      expect(state2.G.contracts[0].id).toBe('c2');
      expect(state2.ctx.turn).toBe(10);
    });

    test('state persists correctly when switching back and forth between games', () => {
      // Create two games
      const gameCode1 = createNewGame();
      useGameStore.setState({
        G: {
          ...useGameStore.getState().G,
          contracts: [{ id: 'c1', destinationKey: 'New York', commodity: 'coal', type: 'private', playerID: '0', fulfilled: false }],
        },
      });
      saveGameState(gameCode1, useGameStore.getState().G, useGameStore.getState().ctx);

      const gameCode2 = createNewGame();
      useGameStore.setState({
        G: {
          ...useGameStore.getState().G,
          contracts: [{ id: 'c2', destinationKey: 'Chicago', commodity: 'wood', type: 'private', playerID: '0', fulfilled: false }],
        },
      });
      saveGameState(gameCode2, useGameStore.getState().G, useGameStore.getState().ctx);

      // Switch back and forth multiple times
      switchToGame(gameCode1);
      let state1 = loadGameState(gameCode1);
      expect(state1.G.contracts[0].id).toBe('c1');

      switchToGame(gameCode2);
      let state2 = loadGameState(gameCode2);
      expect(state2.G.contracts[0].id).toBe('c2');

      switchToGame(gameCode1);
      state1 = loadGameState(gameCode1);
      expect(state1.G.contracts[0].id).toBe('c1');

      // Verify states are still correct
      expect(state1.G.contracts[0].id).toBe('c1');
      state2 = loadGameState(gameCode2);
      expect(state2.G.contracts[0].id).toBe('c2');
    });

    test('can list all games and their states persist', () => {
      // Create multiple games
      const gameCode1 = createNewGame();
      useGameStore.setState({
        ctx: { ...useGameStore.getState().ctx, turn: 1 },
      });
      saveGameState(gameCode1, useGameStore.getState().G, useGameStore.getState().ctx);

      const gameCode2 = createNewGame();
      useGameStore.setState({
        ctx: { ...useGameStore.getState().ctx, turn: 2 },
      });
      saveGameState(gameCode2, useGameStore.getState().G, useGameStore.getState().ctx);

      const gameCode3 = createNewGame();
      useGameStore.setState({
        ctx: { ...useGameStore.getState().ctx, turn: 3 },
      });
      saveGameState(gameCode3, useGameStore.getState().G, useGameStore.getState().ctx);

      // List all games
      const gameCodes = listGameCodes();
      expect(gameCodes.length).toBeGreaterThanOrEqual(3);
      expect(gameCodes).toContain(gameCode1);
      expect(gameCodes).toContain(gameCode2);
      expect(gameCodes).toContain(gameCode3);

      // Verify each game's state persists
      const state1 = loadGameState(gameCode1);
      expect(state1.ctx.turn).toBe(1);

      const state2 = loadGameState(gameCode2);
      expect(state2.ctx.turn).toBe(2);

      const state3 = loadGameState(gameCode3);
      expect(state3.ctx.turn).toBe(3);
    });
  });

  describe('5. Reloads - State persists across simulated page reloads', () => {
    test('state persists after save, clear store, and reload', () => {
      const gameCode = createNewGame();
      
      // Set up game state
      useGameStore.setState({
        G: {
          ...useGameStore.getState().G,
          contracts: [
            { id: 'c1', destinationKey: 'New York', commodity: 'coal', type: 'private', playerID: '0', fulfilled: false },
            { id: 'c2', destinationKey: 'Chicago', commodity: 'wood', type: 'market', playerID: null, fulfilled: false },
          ],
        },
        ctx: {
          ...useGameStore.getState().ctx,
          phase: 'play',
          turn: 10,
          currentPlayer: '1',
        }
      });
      saveGameState(gameCode, useGameStore.getState().G, useGameStore.getState().ctx);

      // Capture state before "reload"
      const savedG = useGameStore.getState().G;
      const savedCtx = useGameStore.getState().ctx;

      // Simulate page reload: reset store
      useGameStore.getState().resetState();

      // Verify store is reset
      expect(useGameStore.getState().G.contracts.length).toBe(0);
      expect(useGameStore.getState().ctx.turn).toBe(0);

      // "Reload" state from localStorage
      const reloadedState = loadGameState(gameCode);
      expect(reloadedState).not.toBeNull();

      // Restore state to store
      useGameStore.setState({
        G: reloadedState.G,
        ctx: reloadedState.ctx,
      });

      // Verify state matches
      const { G, ctx } = useGameStore.getState();
      expect(G.contracts.length).toBe(savedG.contracts.length);
      expect(G.contracts[0].id).toBe(savedG.contracts[0].id);
      expect(ctx.phase).toBe(savedCtx.phase);
      expect(ctx.turn).toBe(savedCtx.turn);
      expect(ctx.currentPlayer).toBe(savedCtx.currentPlayer);
    });

    test('state persists after complex game session simulation', () => {
      const gameCode = createNewGame();
      
      // Simulate a game session with multiple moves, turns, and phase transitions
      
      // 1. Setup phase: generate starting contracts
      useGameStore.setState({
        ctx: { ...useGameStore.getState().ctx, phase: 'setup' },
      });
      generateStartingContract(['New York', 'Philadelphia']);
      saveGameState(gameCode, useGameStore.getState().G, useGameStore.getState().ctx);

      // 2. Advance turn
      endTurnEvent();
      saveGameState(gameCode, useGameStore.getState().G, useGameStore.getState().ctx);

      // 3. Generate another starting contract
      generateStartingContract(['Chicago', 'Detroit']);
      saveGameState(gameCode, useGameStore.getState().G, useGameStore.getState().ctx);

      // 4. Transition to play phase (manually set for test)
      // Also ensure players have active cities for generatePrivateContract
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
      saveGameState(gameCode, useGameStore.getState().G, useGameStore.getState().ctx);

      // 5. Generate private contract
      generatePrivateContract();
      saveGameState(gameCode, useGameStore.getState().G, useGameStore.getState().ctx);

      // Capture final state
      const finalG = useGameStore.getState().G;
      const finalCtx = useGameStore.getState().ctx;

      // Simulate page reload
      useGameStore.getState().resetState();

      // Reload state
      const reloadedState = loadGameState(gameCode);
      expect(reloadedState).not.toBeNull();

      // Restore to store
      useGameStore.setState({
        G: reloadedState.G,
        ctx: reloadedState.ctx,
      });

      // Verify all state matches
      const { G, ctx } = useGameStore.getState();
      expect(G.contracts.length).toBe(finalG.contracts.length);
      expect(ctx.phase).toBe(finalCtx.phase);
      expect(ctx.turn).toBe(finalCtx.turn);
      expect(ctx.currentPlayer).toBe(finalCtx.currentPlayer);
    });

    test('state persists correctly with nested data structures', () => {
      const gameCode = createNewGame();
      
      // Set up complex nested state
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
            ['0', { name: 'Player 0', activeCities: ['New York', 'Philadelphia', 'Chicago'] }],
            ['1', { name: 'Player 1', activeCities: ['Boston', 'Detroit'] }],
          ],
        },
        ctx: {
          ...useGameStore.getState().ctx,
          phase: 'play',
          turn: 15,
        }
      });
      saveGameState(gameCode, useGameStore.getState().G, useGameStore.getState().ctx);

      // Simulate reload
      useGameStore.getState().resetState();
      const reloadedState = loadGameState(gameCode);
      useGameStore.setState({
        G: reloadedState.G,
        ctx: reloadedState.ctx,
      });

      // Verify nested structures
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
    test('handles loading non-existent game gracefully', () => {
      const nonExistentCode = 'XXXX';
      const state = loadGameState(nonExistentCode);
      expect(state).toBeNull();
    });

    test('handles invalid game code format', () => {
      const invalidCode = 'invalid';
      const result = saveGameState(invalidCode, {}, {});
      expect(result).toBe(false);
    });

    test('handles corrupted state data gracefully', () => {
      const gameCode = createNewGame();
      
      // Save valid state first
      saveGameState(gameCode, useGameStore.getState().G, useGameStore.getState().ctx);
      
      // Corrupt the state in localStorage
      const stateMap = JSON.parse(localStorage.getItem('game_state') || '[]');
      const corruptedState = { G: 'invalid', ctx: 'invalid' };
      stateMap[stateMap.findIndex(([code]) => code === gameCode)][1] = corruptedState;
      localStorage.setItem('game_state', JSON.stringify(stateMap));

      // Try to load corrupted state
      const loadedState = loadGameState(gameCode);
      expect(loadedState).toBeNull();
    });

    test('state serialization filters internal properties', () => {
      const gameCode = createNewGame();
      
      // Add internal property (prefixed with _)
      useGameStore.setState({
        ctx: {
          ...useGameStore.getState().ctx,
          _internalProp: 'should not be saved',
        }
      });
      saveGameState(gameCode, useGameStore.getState().G, useGameStore.getState().ctx);

      // Reload and verify internal property is not present
      const reloadedState = loadGameState(gameCode);
      expect(reloadedState).not.toBeNull();
      expect(reloadedState.ctx._internalProp).toBeUndefined();
    });
  });

  describe('7. Game Mode support', () => {
    test('createNewGame defaults to hotseat mode', async () => {
      const gameCode = await createNewGame('local');
      
      // Verify game was created
      expect(await gameExists(gameCode, 'local')).toBe(true);
      
      // Check metadata includes gameMode
      const metadataMap = JSON.parse(localStorage.getItem('game_metadata') || '[]');
      const metadata = new Map(metadataMap).get(gameCode);
      expect(metadata).toBeDefined();
      expect(metadata.gameMode).toBe('hotseat');
    });

    test('createNewGame accepts gameMode option', async () => {
      const gameCode = await createNewGame('local', { gameMode: 'byod' });
      
      // Verify game was created
      expect(await gameExists(gameCode, 'local')).toBe(true);
      
      // Check metadata includes correct gameMode
      const metadataMap = JSON.parse(localStorage.getItem('game_metadata') || '[]');
      const metadata = new Map(metadataMap).get(gameCode);
      expect(metadata).toBeDefined();
      expect(metadata.gameMode).toBe('byod');
    });

    test('createNewGame rejects invalid gameMode', async () => {
      await expect(createNewGame('local', { gameMode: 'invalid' }))
        .rejects.toThrow("Invalid gameMode: invalid. Must be 'hotseat' or 'byod'.");
    });

    test('createNewGame preserves other options with default gameMode', async () => {
      const gameCode = await createNewGame('local');
      
      // Check metadata has required fields
      const metadataMap = JSON.parse(localStorage.getItem('game_metadata') || '[]');
      const metadata = new Map(metadataMap).get(gameCode);
      expect(metadata).toBeDefined();
      expect(metadata.gameMode).toBe('hotseat');
      expect(metadata.lastModified).toBeDefined();
    });

    test('createNewGame with explicit hotseat mode', async () => {
      const gameCode = await createNewGame('local', { gameMode: 'hotseat' });
      
      // Check metadata includes correct gameMode
      const metadataMap = JSON.parse(localStorage.getItem('game_metadata') || '[]');
      const metadata = new Map(metadataMap).get(gameCode);
      expect(metadata).toBeDefined();
      expect(metadata.gameMode).toBe('hotseat');
    });
  });
});
