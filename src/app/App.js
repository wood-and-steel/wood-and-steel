import React from 'react';
import { GameProvider } from '../providers/GameProvider';
import { StorageProvider, useStorage } from '../providers/StorageProvider';
import { WoodAndSteelState } from '../Board';
import { LobbyScreen } from '../components/LobbyScreen';
import { WaitingForPlayersScreen } from '../components/WaitingForPlayersScreen';
import { useGameStore } from '../stores/gameStore';
import { useLobbyStore } from '../stores/lobbyStore';
import { 
  createNewGame,
  gameExists,
  listGames,
  deleteGame,
  isValidGameCode,
  normalizeGameCode,
  loadGameState,
  saveGameState,
  updateLastModifiedCache
} from '../utils/gameManager';
// Import test utilities in development
if (!import.meta.env.PROD) {
  import('../utils/storage/testMigration');
}

const AppContent = () => {
  const { isLobbyMode, setLobbyMode, setSelectedGame } = useLobbyStore();
  const storage = useStorage();
  const [currentGameCode, setCurrentGameCodeState] = React.useState(null);
  // Get number of players and phase from game store (must be at top level, before conditional returns)
  const numPlayers = useGameStore((state) => state.ctx?.numPlayers || 2);
  const currentPhase = useGameStore((state) => state.ctx?.phase);
  
  // BYOD mode state
  const [isBYODGame, setIsBYODGame] = React.useState(false);
  const [myPlayerID, setMyPlayerID] = React.useState(null);

  // Initialize lobby mode on mount only. Do NOT re-run when storage type changes:
  // switching Local/Cloud tabs in the lobby must stay in lobby and show the list,
  // not load the current game for the new type and exit lobby.
  React.useEffect(() => {
    const initializeApp = async () => {
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
        if (savedState && savedState.G && savedState.ctx) {
          // Load state into Zustand store
          useGameStore.setState({
            G: savedState.G,
            ctx: savedState.ctx
          });
          setSelectedGame(code);
          setLobbyMode(false);
          setCurrentGameCodeState(code);
          
          // Check if this is a BYOD game and get player ID
          const isBYOD = await storage.isBYODGame(code);
          setIsBYODGame(isBYOD);
          
          if (isBYOD) {
            const playerID = await storage.getMyPlayerID(code);
            setMyPlayerID(playerID);
            console.info('[App] BYOD game detected, myPlayerID:', playerID);
          } else {
            setMyPlayerID(null);
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
        console.error('[App] Error loading game state:', error.message);
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
  }, []); // Mount only: tab switches must not re-initialize and exit lobby

  // Real-time subscription for multiplayer sync
  React.useEffect(() => {
    if (!currentGameCode || isLobbyMode) {
      return; // No subscription if no game or in lobby mode
    }

    const adapter = storage.getStorageAdapter();
    
    // Subscribe to real-time updates for the current game
    const unsubscribe = adapter.subscribeToGame(currentGameCode, async (state, metadata, lastModified) => {
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
        
        // For BYOD games, check if playerID was just assigned (when game transitions from waiting)
        if (isBYODGame && !myPlayerID && state.ctx.phase !== 'waiting_for_players') {
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
    });

    // Cleanup subscription on unmount or when game changes
    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
        console.info('[App] Unsubscribed from real-time updates for game:', currentGameCode);
      }
    };
  }, [currentGameCode, isLobbyMode, storage, isBYODGame, myPlayerID]);
  
  // Effect to update myPlayerID when game phase changes from waiting_for_players
  // This catches the case when the host starts the game on this device
  React.useEffect(() => {
    const updatePlayerID = async () => {
      if (isBYODGame && currentGameCode && currentPhase !== 'waiting_for_players' && !myPlayerID) {
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
  const handleEnterGame = React.useCallback(async (code) => {
    try {
      const normalizedCode = normalizeGameCode(code);
      
      if (!isValidGameCode(normalizedCode)) {
        alert(`Invalid game code: "${code}"`);
        return;
      }
      
      const exists = await gameExists(normalizedCode, storage.storageType);
      if (!exists) {
        alert(`Game "${normalizedCode}" not found.`);
        return;
      }
      
      // Load game state
      const savedState = await loadGameState(normalizedCode, storage.storageType);
      if (savedState && savedState.G && savedState.ctx) {
        // Load state into Zustand store
        useGameStore.setState({
          G: savedState.G,
          ctx: savedState.ctx
        });
        // Set as current game
        storage.setCurrentGameCode(normalizedCode);
        setSelectedGame(normalizedCode);
        setLobbyMode(false);
        setCurrentGameCodeState(normalizedCode);
        
        // Check if this is a BYOD game and get player ID
        const isBYOD = await storage.isBYODGame(normalizedCode);
        setIsBYODGame(isBYOD);
        
        if (isBYOD) {
          const playerID = await storage.getMyPlayerID(normalizedCode);
          setMyPlayerID(playerID);
          console.info('[App] Entered BYOD game:', normalizedCode, 'myPlayerID:', playerID);
        } else {
          setMyPlayerID(null);
          console.info('[App] Entered hotseat game:', normalizedCode);
        }
        
        // Real-time subscription will be set up by the useEffect hook
      } else {
        alert(`Unable to load game "${normalizedCode}". The game state may be corrupted.`);
      }
    } catch (error) {
      console.error('[App] Error entering game:', error.message);
      alert(`Unable to enter game "${code}". ${error.message || 'Please try again.'}`);
    }
  }, [setSelectedGame, setLobbyMode, storage]);

  // Handler to create a new game
  const handleNewGame = React.useCallback(async (numPlayers = 2) => {
    // Validate numPlayers is between 2 and 5
    const validNumPlayers = Math.max(2, Math.min(5, Math.floor(numPlayers) || 2));
    
    try {
      const newCode = await createNewGame(storage.storageType);
      
      // Initialize game state to initial values with specified number of players
      useGameStore.getState().resetState(validNumPlayers);
      
      // Save the properly initialized state to storage
      const { G, ctx } = useGameStore.getState();
      await saveGameState(newCode, G, ctx, storage.storageType);
      
      // Set as current game
      storage.setCurrentGameCode(newCode);
      setSelectedGame(newCode);
      setLobbyMode(false);
      setCurrentGameCodeState(newCode);
      setIsBYODGame(false);
      setMyPlayerID(null);
      console.info('[App] Created and entered new game:', newCode, 'with', validNumPlayers, 'players');
    } catch (error) {
      console.error('[App] Error creating new game:', error.message);
      alert(`Unable to create a new game. ${error.message || 'Please try again or refresh the page.'}`);
    }
  }, [setSelectedGame, setLobbyMode, storage]);

  // Handler for starting a BYOD game (host clicks "Start Game")
  // This is called after assignRandomPlayerIDs() has been called by the WaitingForPlayersScreen
  const handleStartBYODGame = React.useCallback(async (assignments) => {
    if (!currentGameCode) {
      console.error('[App] No current game code when starting BYOD game');
      return;
    }
    
    try {
      // Get the current game state
      const { G, ctx } = useGameStore.getState();
      
      // Set the byodGameStarted flag to trigger phase transition
      const updatedG = {
        ...G,
        byodGameStarted: true
      };
      
      // Update Zustand store
      useGameStore.setState({ G: updatedG });
      
      // Save the updated state to storage (this triggers the phase transition via endIf)
      await saveGameState(currentGameCode, updatedG, ctx, storage.storageType);
      
      // Get my player ID from the assignments
      const deviceId = storage.getDeviceId();
      const myNewPlayerID = assignments[deviceId];
      
      if (myNewPlayerID !== undefined) {
        setMyPlayerID(myNewPlayerID);
        console.info('[App] BYOD game started, my playerID:', myNewPlayerID);
      }
      
      console.info('[App] BYOD game started successfully');
    } catch (error) {
      console.error('[App] Error starting BYOD game:', error.message);
      alert(`Unable to start game. ${error.message || 'Please try again.'}`);
    }
  }, [currentGameCode, storage]);

  // Handler for canceling a BYOD game (host clicks "Cancel")
  const handleCancelBYODGame = React.useCallback(async () => {
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
      console.error('[App] Error canceling BYOD game:', error.message);
      alert(`Unable to cancel game. ${error.message || 'Please try again.'}`);
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
        console.error('[App] Error deleting game:', error.message);
        alert(`Unable to delete game "${code}". ${error.message || 'Please try again.'}`);
        return false;
      }
    },
    onListGames: async () => {
      return await listGames(storage.storageType);
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
          <WoodAndSteelState gameManager={gameManager} />
        </GameProvider>
      </div>
    );
  }

  // BYOD game but no playerID yet (edge case - might be loading)
  if (isBYODGame && myPlayerID === null && currentPhase !== 'waiting_for_players') {
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
          <WoodAndSteelState gameManager={gameManager} />
        </GameProvider>
      ))}
    </div>
  );
};

const App = () => {
  return (
    <StorageProvider>
      <AppContent />
    </StorageProvider>
  );
};

export default App;
