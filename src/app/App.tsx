import React, { Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { GameProvider } from '../providers/GameProvider';
import { StorageProvider, useStorage } from '../providers/StorageProvider';
import { WoodAndSteelState } from '../Board';
import { LobbyScreen } from '../components/LobbyScreen';
import { WaitingForPlayersScreen } from '../components/WaitingForPlayersScreen';
import { useGameStore } from '../stores/gameStore';
import { useLobbyStore } from '../stores/lobbyStore';
import type { GameState, GameContext } from '../stores/gameStore';
import {
  createNewGame,
  gameExists,
  listGames,
  deleteGame,
  isValidGameCode,
  normalizeGameCode,
  loadGameState,
  updateLastModifiedCache,
  isSupportedGameMetadata,
} from '../utils/gameManager';
import { checkPhaseTransition } from '../stores/phaseManager';
import { initializeIndependentRailroads } from '../independentRailroads';
import { getPlayerAvatarColorForIndex } from '../utils/playerAvatar';

const NOT_PLAYING_MESSAGE = 'This device is not playing this game.';
const UNSUPPORTED_GAME_MESSAGE = 'This game was created by an older version and can no longer be opened.';

const DevSimulatorPage = __INCLUDE_SIM__
  ? React.lazy(() =>
      import('../sim/SimulatorPage').then((mod) => ({ default: mod.SimulatorPage }))
    )
  : null;

const DevCoordPickerPage = __INCLUDE_SIM__
  ? React.lazy(() =>
      import('../sim/coord-picker/CoordPickerPage').then((mod) => ({
        default: mod.CoordPickerPage,
      }))
    )
  : null;

const DevEditPathsPage = import.meta.env.DEV
  ? React.lazy(() =>
      import('../board/edit-paths/EditPathsPage').then((mod) => ({ default: mod.EditPathsPage }))
    )
  : null;

const BoardApp = __INCLUDE_BOARD__
  ? React.lazy(() => import('../board/BoardApp').then((mod) => ({ default: mod.BoardApp })))
  : null;

// Playtest bots (docs/BOT_PLAN.md): host's add/remove controls on the waiting screen.
const BotSeatControls = __INCLUDE_BOARD__
  ? React.lazy(() =>
      import('../bots/host/BotSeatControls').then((mod) => ({ default: mod.BotSeatControls }))
    )
  : null;

// Playtest bots: runs bot turns from the host's device while a game is open.
const BotRunner = __INCLUDE_BOARD__
  ? React.lazy(() => import('../bots/host/BotRunner').then((mod) => ({ default: mod.BotRunner })))
  : null;

export interface AppGameManager {
  currentGameCode: string | null;
  onNewGame: (numPlayers?: number) => Promise<void>;
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

  // This device's playerID; null until the host starts the game
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
        setMyPlayerID(null);
        console.info('[App] No current game, starting in lobby mode');
        return;
      }

      try {
        const exists = await gameExists(code);
        if (!exists) {
          setLobbyMode(true);
          setSelectedGame(null);
          setCurrentGameCodeState(null);
          setMyPlayerID(null);
          console.info('[App] Current game does not exist, starting in lobby mode');
          return;
        }

        // Game exists, load it and exit lobby mode
        const savedState = await loadGameState(code);
        if (savedState?.G && savedState?.ctx) {
          const metadata = await storage.getMetadata(code);
          if (!isSupportedGameMetadata(metadata)) {
            storage.clearCurrentGameCode();
            setLobbyMode(true);
            setSelectedGame(null);
            setCurrentGameCodeState(null);
            setMyPlayerID(null);
            setJoinFormPrefill(code, UNSUPPORTED_GAME_MESSAGE);
            console.info('[App] Current game uses an unsupported mode, returning to lobby:', code);
            return;
          }

          // Check "device not playing" before loading state (avoids flash of Loading screen)
          const phase = savedState.ctx?.phase;
          const isPastWaiting = phase && phase !== 'waiting_for_players';

          if (isPastWaiting) {
            const playerID = await storage.getMyPlayerID(code);
            if (playerID == null) {
              storage.clearCurrentGameCode();
              setLobbyMode(true);
              setSelectedGame(null);
              setCurrentGameCodeState(null);
              setMyPlayerID(null);
              setJoinFormPrefill(code, NOT_PLAYING_MESSAGE);
              console.info('[App] Device not playing this game, returning to lobby with code:', code);
              return;
            }
          }

          // Load state into Zustand store; set turn-start snapshot so current player can undo after load
          const loadedG = savedState.G as GameState;
          const loadedCtx = savedState.ctx as GameContext;
          useGameStore.setState({
            G: loadedG,
            ctx: loadedCtx,
            turnStartSnapshot: structuredClone({ G: loadedG, ctx: loadedCtx }),
            hasMovedThisTurn: false,
          });
          setSelectedGame(code);
          setLobbyMode(false);
          setCurrentGameCodeState(code);

          const playerID = await storage.getMyPlayerID(code);
          setMyPlayerID(playerID);
          console.info('[App] Loaded game, myPlayerID:', playerID);

          console.info('[App] Successfully loaded game state for:', code);
        } else {
          // Invalid state, go to lobby
          console.warn('[App] Loaded state missing required structure, going to lobby');
          setLobbyMode(true);
          setSelectedGame(null);
          setCurrentGameCodeState(null);
          setMyPlayerID(null);
        }
      } catch (error) {
        const err = error as Error;
        console.error('[App] Error loading game state:', err.message);
        // On error, go to lobby
        setLobbyMode(true);
        setSelectedGame(null);
        setCurrentGameCodeState(null);
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

          // Update Zustand store with remote state.
          // Preserve transient UI fields (e.g. lastRoundRoutesAdded) so subscription doesn't clear the routes-added hint.
          // Preserve hasMovedThisTurn when the update is for the same turn (e.g. our own save echoed back), so Undo stays enabled.
          useGameStore.setState((current) => {
            const incomingG = state.G as GameState;
            const preserved =
              current.G.lastRoundRoutesAdded !== undefined
                ? { lastRoundRoutesAdded: current.G.lastRoundRoutesAdded }
                : {};
            const newG = { ...incomingG, ...preserved };
            const newCtx = state.ctx as GameContext;
            const turnChanged = newCtx.currentPlayer !== current.ctx.currentPlayer;
            return {
              G: newG,
              ctx: newCtx,
              turnStartSnapshot: turnChanged ? structuredClone({ G: newG, ctx: newCtx }) : current.turnStartSnapshot,
              hasMovedThisTurn: turnChanged ? false : current.hasMovedThisTurn,
            };
          });

          // Update last_modified cache and our tracking ref
          if (lastModified) {
            updateLastModifiedCache(currentGameCode, lastModified);
            lastAppliedTimestampRef.current = lastModified;
          }

          // Check if playerID was just assigned (when game transitions from waiting)
          if (!myPlayerID && (state.ctx as GameContext).phase !== 'waiting_for_players') {
            const newPlayerID = await storage.getMyPlayerID(currentGameCode);
            if (newPlayerID) {
              setMyPlayerID(newPlayerID);
              console.info('[App] PlayerID assigned via real-time update:', newPlayerID);
            }
          }
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
  }, [currentGameCode, isLobbyMode, storage, myPlayerID]);

  // Effect to update myPlayerID when game phase changes from waiting_for_players.
  // This catches the case when the host starts the game on this device.
  React.useEffect(() => {
    const updatePlayerID = async (): Promise<void> => {
      if (currentGameCode && currentPhase !== 'waiting_for_players' && !myPlayerID) {
        const newPlayerID = await storage.getMyPlayerID(currentGameCode);
        if (newPlayerID) {
          setMyPlayerID(newPlayerID);
          console.info('[App] PlayerID updated after phase transition:', newPlayerID);
        }
      }
    };

    updatePlayerID();
  }, [currentGameCode, currentPhase, myPlayerID, storage]);

  // Handler to enter a game
  const handleEnterGame = React.useCallback(
    async (code: string): Promise<void> => {
      try {
        const normalizedCode = normalizeGameCode(code);

        if (!isValidGameCode(normalizedCode)) {
          alert(`Invalid game code: "${code}"`);
          return;
        }

        const exists = await gameExists(normalizedCode);
        if (!exists) {
          alert(`Game "${normalizedCode}" not found.`);
          return;
        }

        // Load game state
        const savedState = await loadGameState(normalizedCode);
        if (savedState?.G && savedState?.ctx) {
          const metadata = await storage.getMetadata(normalizedCode);
          if (!isSupportedGameMetadata(metadata)) {
            setJoinFormPrefill(normalizedCode, UNSUPPORTED_GAME_MESSAGE);
            return;
          }

          // For games in play/setup, verify this device is a player before entering
          const phase = savedState.ctx?.phase;
          const isPastWaiting = phase && phase !== 'waiting_for_players';

          if (isPastWaiting) {
            const playerID = await storage.getMyPlayerID(normalizedCode);
            if (playerID == null) {
              // Device is not playing - stay in lobby, show error in Join form (LobbyScreen effect will apply prefill)
              setJoinFormPrefill(normalizedCode, NOT_PLAYING_MESSAGE);
              console.info('[App] Device not playing this game, staying in lobby with code:', normalizedCode);
              return;
            }
          }

          const loadedG = savedState.G as GameState;
          const loadedCtx = savedState.ctx as GameContext;
          useGameStore.setState({
            G: loadedG,
            ctx: loadedCtx,
            turnStartSnapshot: structuredClone({ G: loadedG, ctx: loadedCtx }),
            hasMovedThisTurn: false,
          });
          storage.setCurrentGameCode(normalizedCode);
          setSelectedGame(normalizedCode);
          setLobbyMode(false);
          setCurrentGameCodeState(normalizedCode);

          const playerID = await storage.getMyPlayerID(normalizedCode);
          setMyPlayerID(playerID);
          console.info('[App] Entered game:', normalizedCode, 'myPlayerID:', playerID);
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
    async (numPlayersParam: number = 2): Promise<void> => {
      const validNumPlayers = Math.max(2, Math.min(5, Math.floor(numPlayersParam) || 2));

      try {
        const savedByName =
          typeof localStorage !== 'undefined'
            ? (localStorage.getItem('byod_player_name') ?? '').trim()
            : '';
        const hostPlayerName = savedByName || undefined;

        // New games start in 'waiting_for_players'
        const newCode = await createNewGame({
          hostDeviceId: storage.getDeviceId(),
          numPlayers: validNumPlayers,
          ...(hostPlayerName && { hostPlayerName }),
        });

        const savedState = await loadGameState(newCode);
        if (savedState?.G && savedState?.ctx) {
          const loadedG = savedState.G as GameState;
          const loadedCtx = savedState.ctx as GameContext;
          useGameStore.setState({
            G: loadedG,
            ctx: loadedCtx,
            turnStartSnapshot: structuredClone({ G: loadedG, ctx: loadedCtx }),
            hasMovedThisTurn: false,
          });
        }

        // Set as current game
        storage.setCurrentGameCode(newCode);
        setSelectedGame(newCode);
        setLobbyMode(false);
        setCurrentGameCodeState(newCode);
        setMyPlayerID(null); // playerID is assigned when the host starts the game
        console.info('[App] Created and entered new game:', newCode, 'with', validNumPlayers, 'players');
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

            return [playerID, {
              name: playerName,
              activeCities: [] as string[],
              hubCity: null,
              regionalOffice: null,
              avatarColor: getPlayerAvatarColorForIndex(i),
            }];
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
      const deleted = await deleteGame(currentGameCode);

      if (deleted) {
        // Clear current game and return to lobby
        storage.clearCurrentGameCode();
        setSelectedGame(null);
        setLobbyMode(true);
        setCurrentGameCodeState(null);
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

        const deleted = await deleteGame(normalizedCode);
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
      return await listGames();
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

  // Waiting for players to join: show waiting screen
  if (currentPhase === 'waiting_for_players') {
    return (
      <WaitingForPlayersScreen
        gameCode={currentGameCode}
        numPlayers={numPlayers}
        onStartGame={handleStartBYODGame}
        onCancel={handleCancelBYODGame}
        onReturnToLobby={handleReturnToLobby}
        botSeatControls={BotSeatControls}
      />
    );
  }

  // Game started: render only this device's player board
  if (myPlayerID !== null) {
    return (
      <div>
        <GameProvider playerID={myPlayerID}>
          <WoodAndSteelState
            gameManager={{ ...gameManager, currentGameCode: gameManager.currentGameCode ?? undefined }}
          />
        </GameProvider>
        {BotRunner && currentGameCode && (
          <Suspense fallback={null}>
            <BotRunner gameCode={currentGameCode} />
          </Suspense>
        )}
      </div>
    );
  }

  // Started but no playerID yet (device not playing returns to lobby before reaching here)
  return (
    <div className="waitingScreen">
      <div className="waitingScreen__content">
        <p>Loading player assignment...</p>
      </div>
    </div>
  );
};

const App = (): React.ReactElement => {
  const location = useLocation();
  if (__INCLUDE_SIM__ && location.pathname === '/sim' && DevSimulatorPage) {
    return (
      <Suspense fallback={<p>Loading simulator…</p>}>
        <DevSimulatorPage />
      </Suspense>
    );
  }
  if (__INCLUDE_SIM__ && location.pathname === '/pick-coords' && DevCoordPickerPage) {
    return (
      <Suspense fallback={<p>Loading coordinate picker…</p>}>
        <DevCoordPickerPage />
      </Suspense>
    );
  }
  if (import.meta.env.DEV && location.pathname === '/board/edit-paths' && DevEditPathsPage) {
    return (
      <Suspense fallback={<p>Loading route path editor…</p>}>
        <DevEditPathsPage />
      </Suspense>
    );
  }
  // Playtest board (docs/archived/BOARD_APP_PLAN.md): read-only view of G/ctx, no AppContent.
  if (__INCLUDE_BOARD__ && location.pathname.startsWith('/board') && BoardApp) {
    return (
      <StorageProvider>
        <Suspense fallback={<p>Loading board…</p>}>
          <BoardApp />
        </Suspense>
      </StorageProvider>
    );
  }
  return (
    <StorageProvider>
      <AppContent />
    </StorageProvider>
  );
};

export default App;
