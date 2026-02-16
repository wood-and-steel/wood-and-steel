import React from 'react';
import { useLocation } from 'react-router-dom';
import { GameProvider } from '../providers/GameProvider';
import { StorageProvider, useStorage } from '../providers/StorageProvider';
import { WoodAndSteelState } from '../Board';
import { LobbyScreen } from '../components/LobbyScreen';
import { WaitingForPlayersScreen } from '../components/WaitingForPlayersScreen';
import { useGameStore } from '../stores/gameStore';
import { useLobbyStore } from '../stores/lobbyStore';
import type { GameState, GameContext } from '../stores/gameStore';
import type { StorageType } from '../utils/gameManager';
import {
  createNewGame,
  gameExists,
  listGames,
  deleteGame,
  isValidGameCode,
  normalizeGameCode,
  loadGameState,
  saveGameState,
  updateLastModifiedCache,
} from '../utils/gameManager';
import { checkPhaseTransition } from '../stores/phaseManager';
import { initializeIndependentRailroads } from '../independentRailroads';

const NOT_PLAYING_MESSAGE = 'This device is not playing this game.';

// Import test utilities in development
if (!import.meta.env.PROD) {
  import('../utils/storage/testMigration');
}

export interface AppGameManager {
  currentGameCode: string | null;
  onNewGame: (numPlayers?: number, gameMode?: 'hotseat' | 'byod') => Promise<void>;
  onSwitchGame: (code: string) => void;
  onDeleteGame: (code: string) => Promise<boolean>;
  onListGames: () => Promise<unknown[]>;
  isValidGameCode: (code: string) => boolean;
  normalizeGameCode: (code: string) => string;
}

const GAME_CODE_PATH_REGEX = /^\/g\/([^/]+)$/;
const INVALID_CODE_MESSAGE = 'Invalid game code format. Please check and try again.';

const AppContent = (): React.ReactElement => {
  const { isLobbyMode, setLobbyMode, setSelectedGame, setJoinFormPrefill } = useLobbyStore();
  const storage = useStorage();
  const location = useLocation();
  const [currentGameCode, setCurrentGameCodeState] = React.useState<string | null>(null);
  // Get number of players and phase from game store (must be at top level, before conditional returns)
  const numPlayers = useGameStore((state) => state.ctx?.numPlayers ?? 2);
  const currentPhase = useGameStore((state) => state.ctx?.phase);

  // BYOD mode state
  const [isBYODGame, setIsBYODGame] = React.useState(false);
  const [myPlayerID, setMyPlayerID] = React.useState<string | null>(null);

  // Track last applied update timestamp to prevent stale real-time updates.
  // This ref is shared between the subscription handler and local save operations.
  const lastAppliedTimestampRef = React.useRef<string | null>(null);

  // URL /g/:code takes precedence: parse on mount and when location changes.
  React.useEffect(() => {
    const pathname = location.pathname;
    const match = pathname.match(GAME_CODE_PATH_REGEX);
    if (match) {
      const rawCode = match[1];
      const normalizedCode = normalizeGameCode(rawCode);
      setLobbyMode(true);
      setSelectedGame(null);
      setCurrentGameCodeState(null);
      setIsBYODGame(false);
      setMyPlayerID(null);
      if (isValidGameCode(normalizedCode)) {
        setJoinFormPrefill(normalizedCode, null, true);
      } else {
        setJoinFormPrefill(rawCode, INVALID_CODE_MESSAGE);
      }
      return;
    }

    // No URL join path: run normal restore current game.
    const initializeApp = async (): Promise<void> => {
      const code = storage.getCurrentGameCode();

      // If no current game or it doesn't exist, go to lobby mode
      if (!code) {
        setLobbyMode(true);
        setSelectedGame(null);
        setCurrentGameCodeState(null);
        setIsBYODGame(false);
        setMyPlayerID(null);
        console.info('[App] No current game, starting in lobby mode');
        return;
      }

      try {
        const exists = await gameExists(code, storage.storageType);
        if (!exists) {
          setLobbyMode(true);
          setSelectedGame(null);
          setCurrentGameCodeState(null);
          setIsBYODGame(false);
          setMyPlayerID(null);
          console.info('[App] Current game does not exist, starting in lobby mode');
          return;
        }

        // Game exists, load it and exit lobby mode
        const savedState = await loadGameState(code, storage.storageType);
        if (savedState?.G && savedState?.ctx) {
          // Check BYOD "device not playing" before loading state (avoids flash of Loading screen)
          const isBYOD = await storage.isBYODGame(code);
          const phase = savedState.ctx?.phase;
          const isPastWaiting = phase && phase !== 'waiting_for_players';

          if (isBYOD && isPastWaiting) {
            const playerID = await storage.getMyPlayerID(code);
            if (playerID == null) {
              storage.clearCurrentGameCode();
              setLobbyMode(true);
              setSelectedGame(null);
              setCurrentGameCodeState(null);
              setIsBYODGame(false);
              setMyPlayerID(null);
              setJoinFormPrefill(code, NOT_PLAYING_MESSAGE);
              console.info('[App] Device not playing BYOD game, returning to lobby with code:', code);
              return;
            }
          }

          // Load state into Zustand store
          useGameStore.setState({
            G: savedState.G as GameState,
            ctx: savedState.ctx as GameContext,
          });
          setSelectedGame(code);
          setLobbyMode(false);
          setCurrentGameCodeState(code);

          if (isBYOD) {
            const playerID = await storage.getMyPlayerID(code);
            setMyPlayerID(playerID);
            setIsBYODGame(true);
            console.info('[App] BYOD game detected, myPlayerID:', playerID);
          } else {
            setMyPlayerID(null);
            setIsBYODGame(false);
          }

          console.info('[App] Successfully loaded game state for:', code);
        } else {
          // Invalid state, go to lobby
          console.warn('[App] Loaded state missing required structure, going to lobby');
          setLobbyMode(true);
          setSelectedGame(null);
          setCurrentGameCodeState(null);
          setIsBYODGame(false);
          setMyPlayerID(null);
        }
      } catch (error) {
        const err = error as Error;
        console.error('[App] Error loading game state:', err.message);
        // On error, go to lobby
        setLobbyMode(true);
        setSelectedGame(null);
        setCurrentGameCodeState(null);
        setIsBYODGame(false);
        setMyPlayerID(null);
      }
    };

    initializeApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]); // Re-run when pathname changes (e.g. /g/CODE vs /); tab switches don't change pathname

  // Real-time subscription for multiplayer sync
  React.useEffect(() => {
    if (!currentGameCode || isLobbyMode) {
      return; // No subscription if no game or in lobby mode
    }

    const adapter = storage.getStorageAdapter();

    // Subscribe to real-time updates for the current game
    const unsubscribe = adapter.subscribeToGame(
      currentGameCode,
      async (
        state: { G?: unknown; ctx?: unknown } | null,
        metadata: Record<string, unknown>,
        lastModified: string | null
      ) => {
        if (state?.G && state?.ctx) {
          console.info('[App] Received real-time update for game:', currentGameCode);
          // Check if this update is stale (older than what we've already applied).
          // This prevents race conditions where old subscription notifications overwrite newer local state.
          if (lastModified && lastAppliedTimestampRef.current) {
            const incomingTime = new Date(lastModified).getTime();
            const lastAppliedTime = new Date(lastAppliedTimestampRef.current).getTime();
            if (incomingTime <= lastAppliedTime) {
              console.info(
                '[App] Ignoring stale real-time update (incoming:',
                lastModified,
                'vs applied:',
                lastAppliedTimestampRef.current,
                ')'
              );
              return; // Skip this stale update
            }
          }

          // Update Zustand store with remote state
          useGameStore.setState({
            G: state.G as GameState,
            ctx: state.ctx as GameContext,
          });

          // Update last_modified cache and our tracking ref
          if (lastModified) {
            updateLastModifiedCache(currentGameCode, lastModified);
            lastAppliedTimestampRef.current = lastModified;
          }

          // For BYOD games, check if playerID was just assigned (when game transitions from waiting)
          if (isBYODGame && !myPlayerID && (state.ctx as GameContext).phase !== 'waiting_for_players') {
            const newPlayerID = await storage.getMyPlayerID(currentGameCode);
            if (newPlayerID) {
              setMyPlayerID(newPlayerID);
              console.info('[App] PlayerID assigned via real-time update:', newPlayerID);
            }
          }

          console.info('[App] Updated game state from real-time subscription');
        } else {
          console.warn('[App] Received invalid state from real-time subscription');
        }
      }
    );

    // Cleanup subscription on unmount or when game changes
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
        console.info('[App] Unsubscribed from real-time updates for game:', currentGameCode);
      }
    };
  }, [currentGameCode, isLobbyMode, storage, isBYODGame, myPlayerID]);

  // Effect to update myPlayerID when game phase changes from waiting_for_players.
  // This catches the case when the host starts the game on this device.
  React.useEffect(() => {
    const updatePlayerID = async (): Promise<void> => {
      if (
        isBYODGame &&
        currentGameCode &&
        currentPhase !== 'waiting_for_players' &&
        !myPlayerID
      ) {
        const newPlayerID = await storage.getMyPlayerID(currentGameCode);
        if (newPlayerID) {
          setMyPlayerID(newPlayerID);
          console.info('[App] PlayerID updated after phase transition:', newPlayerID);
        }
      }
    };

    updatePlayerID();
  }, [isBYODGame, currentGameCode, currentPhase, myPlayerID, storage]);

  // Handler to enter a game
  const handleEnterGame = React.useCallback(
    async (code: string, options: { storageType?: StorageType } = {}): Promise<void> => {
      try {
        const normalizedCode = normalizeGameCode(code);
        const storageType = options.storageType ?? storage.storageType;

        if (!isValidGameCode(normalizedCode)) {
          alert(`Invalid game code: "${code}"`);
          return;
        }

        const exists = await gameExists(normalizedCode, storageType);
        if (!exists) {
          alert(`Game "${normalizedCode}" not found.`);
          return;
        }

        // Load game state
        const savedState = await loadGameState(normalizedCode, storageType);
        if (savedState?.G && savedState?.ctx) {
          // For BYOD games in play/setup, verify this device is a player before entering
          const isBYOD = await storage.isBYODGame(normalizedCode);
          const phase = savedState.ctx?.phase;
          const isPastWaiting = phase && phase !== 'waiting_for_players';

          if (isBYOD && isPastWaiting) {
            const playerID = await storage.getMyPlayerID(normalizedCode);
            if (playerID == null) {
              // Device is not playing - stay in lobby, show error in Join form (LobbyScreen effect will apply prefill)
              setJoinFormPrefill(normalizedCode, NOT_PLAYING_MESSAGE);
              console.info('[App] Device not playing BYOD game, staying in lobby with code:', normalizedCode);
              return;
            }
          }

          useGameStore.setState({
            G: savedState.G as GameState,
            ctx: savedState.ctx as GameContext,
          });
          if (storage.storageType !== storageType) {
            storage.setStorageType(storageType);
          }
          storage.setCurrentGameCodeForType(storageType, normalizedCode);
          setSelectedGame(normalizedCode);
          setLobbyMode(false);
          setCurrentGameCodeState(normalizedCode);
          setIsBYODGame(isBYOD);

          if (isBYOD) {
            const playerID = await storage.getMyPlayerID(normalizedCode);
            setMyPlayerID(playerID);
            console.info('[App] Entered BYOD game:', normalizedCode, 'myPlayerID:', playerID);
          } else {
            setMyPlayerID(null);
            console.info('[App] Entered hotseat game:', normalizedCode);
          }
        } else {
          alert(`Unable to load game "${normalizedCode}". The game state may be corrupted.`);
        }
      } catch (error) {
        const err = error as Error;
        console.error('[App] Error entering game:', err.message);
        alert(`Unable to enter game "${code}". ${err.message || 'Please try again.'}`);
      }
    },
    [setSelectedGame, setLobbyMode, setJoinFormPrefill, storage]
  );

  const handleNewGame = React.useCallback(
    async (numPlayersParam: number = 2, gameMode: 'hotseat' | 'byod' = 'hotseat'): Promise<void> => {
      const validNumPlayers = Math.max(2, Math.min(5, Math.floor(numPlayersParam) || 2));

      try {
        const isBYOD = gameMode === 'byod';
        const hostDeviceId = isBYOD ? storage.getDeviceId() : null;

        // New game is created by createNewGame with 'waiting_for_players' phase
        const newCode = await createNewGame(storage.storageType, {
          gameMode,
          hostDeviceId,
          numPlayers: validNumPlayers,
        });

        if (!isBYOD) {
          // Initialize game state to initial values with specified number of players
          useGameStore.getState().resetState(validNumPlayers);

          // Initialize independent railroads
          const { G, ctx } = useGameStore.getState();
          const independentRailroads = initializeIndependentRailroads();
          const initializedG = { ...G, independentRailroads };
          useGameStore.setState({ G: initializedG });

          // Save the properly initialized state to storage
          await saveGameState(newCode, initializedG, ctx, storage.storageType);
        } else {
          // For BYOD, load the state that was created by createNewGame
          const savedState = await loadGameState(newCode, storage.storageType);
          if (savedState?.G && savedState?.ctx) {
            useGameStore.setState({
              G: savedState.G as GameState,
              ctx: savedState.ctx as GameContext,
            });
          }
        }

        // Set as current game
        storage.setCurrentGameCode(newCode);
        setSelectedGame(newCode);
        setLobbyMode(false);
        setCurrentGameCodeState(newCode);
        setIsBYODGame(isBYOD);
        setMyPlayerID(null); // For BYOD, playerID will be assigned when game starts
        console.info(
          '[App] Created and entered new game:',
          newCode,
          'with',
          validNumPlayers,
          'players (mode:',
          gameMode + ')'
        );
      } catch (error) {
        const err = error as Error;
        console.error('[App] Error creating new game:', err.message);
        alert(
          `Unable to create a new game. ${err.message || 'Please try again or refresh the page.'}`
        );
      }
    },
    [setSelectedGame, setLobbyMode, storage]
  );

  // Handler for starting a BYOD game (host clicks "Start Game").
  // This is called after assignRandomPlayerIDs() has been called by the WaitingForPlayersScreen.
  const handleStartBYODGame = React.useCallback(
    async (assignments: Record<string, string>): Promise<void> => {
      if (!currentGameCode) {
        console.error('[App] No current game code when starting BYOD game');
        return;
      }

      try {
        // Get the current game state
        const { G, ctx } = useGameStore.getState();

        // Initialize players array if empty (BYOD games start with empty players).
        // Build players from assignments, using playerNames from metadata if available.
        let players = G.players;
        if (!players || players.length === 0) {
          // Get player names from metadata
          const metadata = await storage.getMetadata(currentGameCode);
          const playerSeats = (metadata?.playerSeats ?? {}) as Record<
            string,
            { playerName?: string }
          >;

          // Create players array indexed by playerID
          players = Array.from({ length: ctx.numPlayers }, (_, i) => {
            const playerID = String(i);
            // Find the device that was assigned this playerID
            const deviceEntry = Object.entries(assignments).find(([, pid]) => pid === playerID);
            const deviceId = deviceEntry ? deviceEntry[0] : null;
            const seat = deviceId ? playerSeats[deviceId] : null;
            const playerName = seat?.playerName ?? `Player ${i}`;

            return [playerID, { name: playerName, activeCities: [] as string[] }];
          });

          console.info('[App] Initialized players for BYOD game:', players);
        }

        // Initialize independent railroads if not already initialized.
        // This is done by the host when starting the BYOD game.
        const independentRailroads =
          G.independentRailroads && Object.keys(G.independentRailroads).length > 0
            ? G.independentRailroads
            : initializeIndependentRailroads();

        // Set the byodGameStarted flag to trigger phase transition
        const updatedG = {
          ...G,
          players,
          independentRailroads,
          byodGameStarted: true,
        };

        // Update Zustand store with the new G (including players array).
        // Don't save to storage yet - let checkPhaseTransition do it atomically.
        // This prevents intermediate state (old phase) from being broadcasted.
        useGameStore.setState({ G: updatedG });

        // Update the timestamp ref BEFORE the transition to block any stale notifications
        lastAppliedTimestampRef.current = new Date().toISOString();

        // Trigger the phase transition from waiting_for_players to setup.
        // This will:
        // 1. Check endIf (true because byodGameStarted is set)
        // 2. Update ctx.phase to 'setup' in the store
        // 3. Save the complete state (with players AND new phase) to storage
        // IMPORTANT: Pass updatedG directly instead of re-fetching from store.
        checkPhaseTransition(updatedG, ctx);

        // Update timestamp again after phase transition save
        lastAppliedTimestampRef.current = new Date().toISOString();

        // Get my player ID from the assignments
        const deviceId = storage.getDeviceId();
        const myNewPlayerID = assignments[deviceId];
        if (myNewPlayerID !== undefined) {
          setMyPlayerID(myNewPlayerID);
          console.info('[App] BYOD game started, my playerID:', myNewPlayerID);
        }

        console.info('[App] BYOD game started successfully');
      } catch (error) {
        const err = error as Error;
        console.error('[App] Error starting BYOD game:', err.message);
        alert(`Unable to start game. ${err.message || 'Please try again.'}`);
      }
    },
    [currentGameCode, storage]
  );

  // Handler for canceling a BYOD game (host clicks "Cancel")
  const handleCancelBYODGame = React.useCallback(async (): Promise<void> => {
    if (!currentGameCode) {
      console.error('[App] No current game code when canceling BYOD game');
      return;
    }

    try {
      // Delete the game
      const deleted = await deleteGame(currentGameCode, storage.storageType);

      if (deleted) {
        // Clear current game and return to lobby
        storage.clearCurrentGameCode();
        setSelectedGame(null);
        setLobbyMode(true);
        setCurrentGameCodeState(null);
        setIsBYODGame(false);
        setMyPlayerID(null);

        // Clear game store state
        useGameStore.getState().resetState(2);

        console.info('[App] BYOD game canceled and deleted:', currentGameCode);
      } else {
        console.warn('[App] Failed to delete canceled game:', currentGameCode);
        alert('Failed to cancel game. Please try again.');
      }
    } catch (error) {
      const err = error as Error;
      console.error('[App] Error canceling BYOD game:', err.message);
      alert(`Unable to cancel game. ${err.message || 'Please try again.'}`);
    }
  }, [currentGameCode, storage, setSelectedGame, setLobbyMode]);

  // Handler for returning to lobby (non-host players in waiting screen)
  const handleReturnToLobby = React.useCallback(() => {
    // Don't delete the game, just return to lobby
    storage.clearCurrentGameCode();
    setSelectedGame(null);
    setLobbyMode(true);
    setCurrentGameCodeState(null);
    setIsBYODGame(false);
    setMyPlayerID(null);

    console.info('[App] Returned to lobby from waiting screen');
  }, [storage, setSelectedGame, setLobbyMode]);

  // Pass game management functions to components
  const gameManager: AppGameManager = {
    currentGameCode,
    onNewGame: handleNewGame,
    onSwitchGame: (code: string) => {
      handleEnterGame(code);
    },
    onDeleteGame: async (code: string) => {
      try {
        const normalizedCode = normalizeGameCode(code);
        const wasCurrentGame = normalizedCode === currentGameCode;

        const deleted = await deleteGame(normalizedCode, storage.storageType);
        if (deleted) {
          // If we deleted the current game, return to lobby
          if (wasCurrentGame) {
            storage.clearCurrentGameCode();
            setSelectedGame(null);
            setLobbyMode(true);
            setCurrentGameCodeState(null);
            // Clear game store state
            useGameStore.getState().resetState(2);
          }
          return true;
        }
        return false;
      } catch (error) {
        const err = error as Error;
        console.error('[App] Error deleting game:', err.message);
        alert(`Unable to delete game "${code}". ${err.message || 'Please try again.'}`);
        return false;
      }
    },
    onListGames: async () => {
      return await listGames(storage.storageType);
    },
    isValidGameCode,
    normalizeGameCode,
  };

  // Conditional rendering: show lobby or game board
  if (isLobbyMode) {
    return (
      <LobbyScreen
        gameManager={gameManager}
        onEnterGame={handleEnterGame}
        onNewGame={handleNewGame}
      />
    );
  }

  // BYOD game in waiting_for_players phase: show waiting screen
  if (isBYODGame && currentPhase === 'waiting_for_players') {
    return (
      <WaitingForPlayersScreen
        gameCode={currentGameCode}
        numPlayers={numPlayers}
        onStartGame={handleStartBYODGame}
        onCancel={handleCancelBYODGame}
        onReturnToLobby={handleReturnToLobby}
      />
    );
  }

  // BYOD game after start: render only this player's board
  if (isBYODGame && myPlayerID !== null) {
    return (
      <div>
        <GameProvider playerID={myPlayerID}>
          <WoodAndSteelState
            gameManager={{ ...gameManager, currentGameCode: gameManager.currentGameCode ?? undefined }}
            isBYODMode={true}
          />
        </GameProvider>
      </div>
    );
  }

  // BYOD game but no playerID yet (should not reach here after fix - device not playing now returns to lobby)
  if (
    isBYODGame &&
    myPlayerID === null &&
    currentPhase !== 'waiting_for_players'
  ) {
    return (
      <div className="waitingScreen">
        <div className="waitingScreen__content">
          <p>Loading player assignment...</p>
        </div>
      </div>
    );
  }

  // Hotseat mode: render all player boards
  return (
    <div>
      {Array.from({ length: numPlayers }, (_, i) => (
        <GameProvider key={i} playerID={String(i)}>
          <WoodAndSteelState
            gameManager={{ ...gameManager, currentGameCode: gameManager.currentGameCode ?? undefined }}
          />
        </GameProvider>
      ))}
    </div>
  );
};

const App = (): React.ReactElement => {
  return (
    <StorageProvider>
      <AppContent />
    </StorageProvider>
  );
};

export default App;
