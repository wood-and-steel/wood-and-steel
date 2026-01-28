import React from 'react';
import { GameProvider } from '../providers/GameProvider';
import { WoodAndSteelState } from '../Board';
import { LobbyScreen } from '../components/LobbyScreen';
import { useGameStore } from '../stores/gameStore';
import { useLobbyStore } from '../stores/lobbyStore';
import { 
  getCurrentGameCode, 
  createNewGame,
  gameExists,
  listGames,
  deleteGame,
  isValidGameCode,
  normalizeGameCode,
  loadGameState,
  clearCurrentGameCode,
  setCurrentGameCode,
  updateLastModifiedCache
} from '../utils/gameManager';
import { getStorageAdapter } from '../utils/storage';
// Import test utilities in development
if (!import.meta.env.PROD) {
  import('../utils/storage/testMigration');
}

const App = () => {
  const { isLobbyMode, setLobbyMode, setSelectedGame } = useLobbyStore();
  const [currentGameCode, setCurrentGameCodeState] = React.useState(null);
  // Get number of players from game store (must be at top level, before conditional returns)
  const numPlayers = useGameStore((state) => state.ctx?.numPlayers || 2);

  // Initialize lobby mode on mount
  React.useEffect(() => {
    const initializeApp = async () => {
      const code = getCurrentGameCode();
      
      // If no current game or it doesn't exist, go to lobby mode
      if (!code) {
        setLobbyMode(true);
        setSelectedGame(null);
        setCurrentGameCodeState(null);
        console.info('[App] No current game, starting in lobby mode');
        return;
      }
      
      try {
        const exists = await gameExists(code);
        if (!exists) {
          setLobbyMode(true);
          setSelectedGame(null);
          setCurrentGameCodeState(null);
          console.info('[App] Current game does not exist, starting in lobby mode');
          return;
        }
        
        // Game exists, load it and exit lobby mode
        const savedState = await loadGameState(code);
        if (savedState && savedState.G && savedState.ctx) {
          // Load state into Zustand store
          useGameStore.setState({
            G: savedState.G,
            ctx: savedState.ctx
          });
          setSelectedGame(code);
          setLobbyMode(false);
          setCurrentGameCodeState(code);
          console.info('[App] Successfully loaded game state for:', code);
        } else {
          // Invalid state, go to lobby
          console.warn('[App] Loaded state missing required structure, going to lobby');
          setLobbyMode(true);
          setSelectedGame(null);
          setCurrentGameCodeState(null);
        }
      } catch (error) {
        console.error('[App] Error loading game state:', error.message);
        // On error, go to lobby
        setLobbyMode(true);
        setSelectedGame(null);
        setCurrentGameCodeState(null);
      }
    };
    
    initializeApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only on mount

  // Real-time subscription for multiplayer sync
  React.useEffect(() => {
    if (!currentGameCode || isLobbyMode) {
      return; // No subscription if no game or in lobby mode
    }

    const adapter = getStorageAdapter();
    
    // Subscribe to real-time updates for the current game
    const unsubscribe = adapter.subscribeToGame(currentGameCode, (state, metadata, lastModified) => {
      if (state && state.G && state.ctx) {
        console.info('[App] Received real-time update for game:', currentGameCode);
        
        // Update Zustand store with remote state
        useGameStore.setState({
          G: state.G,
          ctx: state.ctx
        });
        
        // Update last_modified cache with the new timestamp from the database
        // This prevents false conflict warnings when we save after receiving our own updates
        if (lastModified) {
          updateLastModifiedCache(currentGameCode, lastModified);
        }
        
        console.info('[App] Updated game state from real-time subscription');
      } else {
        console.warn('[App] Received invalid state from real-time subscription');
      }
    });

    // Cleanup subscription on unmount or when game changes
    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
        console.info('[App] Unsubscribed from real-time updates for game:', currentGameCode);
      }
    };
  }, [currentGameCode, isLobbyMode]);

  // Handler to enter a game
  const handleEnterGame = React.useCallback(async (code) => {
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
      if (savedState && savedState.G && savedState.ctx) {
        // Load state into Zustand store
        useGameStore.setState({
          G: savedState.G,
          ctx: savedState.ctx
        });
        // Set as current game
        setCurrentGameCode(normalizedCode);
        setSelectedGame(normalizedCode);
        setLobbyMode(false);
        setCurrentGameCodeState(normalizedCode);
        console.info('[App] Entered game:', normalizedCode);
        // Real-time subscription will be set up by the useEffect hook
      } else {
        alert(`Unable to load game "${normalizedCode}". The game state may be corrupted.`);
      }
    } catch (error) {
      console.error('[App] Error entering game:', error.message);
      alert(`Unable to enter game "${code}". ${error.message || 'Please try again.'}`);
    }
  }, [setSelectedGame, setLobbyMode]);

  // Handler to create a new game
  const handleNewGame = React.useCallback(async (numPlayers = 2) => {
    // Validate numPlayers is between 2 and 5
    const validNumPlayers = Math.max(2, Math.min(5, Math.floor(numPlayers) || 2));
    
    try {
      const newCode = await createNewGame();
      
      // Initialize game state to initial values with specified number of players
      useGameStore.getState().resetState(validNumPlayers);
      
      // Set as current game
      setCurrentGameCode(newCode);
      setSelectedGame(newCode);
      setLobbyMode(false);
      setCurrentGameCodeState(newCode);
      console.info('[App] Created and entered new game:', newCode, 'with', validNumPlayers, 'players');
    } catch (error) {
      console.error('[App] Error creating new game:', error.message);
      alert(`Unable to create a new game. ${error.message || 'Please try again or refresh the page.'}`);
    }
  }, [setSelectedGame, setLobbyMode]);

  // Pass game management functions to components
  const gameManager = {
    currentGameCode,
    onNewGame: handleNewGame,
    onSwitchGame: (code) => {
      handleEnterGame(code);
    },
    onDeleteGame: async (code) => {
      try {
        const normalizedCode = normalizeGameCode(code);
        const wasCurrentGame = normalizedCode === currentGameCode;
        
        const deleted = await deleteGame(normalizedCode);
        if (deleted) {
          // If we deleted the current game, return to lobby
          if (wasCurrentGame) {
            clearCurrentGameCode();
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
        console.error('[App] Error deleting game:', error.message);
        alert(`Unable to delete game "${code}". ${error.message || 'Please try again.'}`);
        return false;
      }
    },
    onListGames: async () => {
      return await listGames();
    },
    isValidGameCode,
    normalizeGameCode
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

  // Render game board when not in lobby mode
  return (
    <div>
      {Array.from({ length: numPlayers }, (_, i) => (
        <GameProvider key={i} playerID={String(i)}>
          <WoodAndSteelState gameManager={gameManager} />
        </GameProvider>
      ))}
    </div>
  );
};

export default App;
