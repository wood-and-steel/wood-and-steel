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
  switchToGame,
  isValidGameCode,
  normalizeGameCode,
  loadGameState,
  clearCurrentGameCode,
  setCurrentGameCode
} from '../utils/gameManager';

const App = () => {
  const { isLobbyMode, setLobbyMode, setSelectedGame } = useLobbyStore();
  const [currentGameCode, setCurrentGameCodeState] = React.useState(null);

  // Initialize lobby mode on mount
  React.useEffect(() => {
    const code = getCurrentGameCode();
    
    // If no current game or it doesn't exist, go to lobby mode
    if (!code || !gameExists(code)) {
      setLobbyMode(true);
      setSelectedGame(null);
      setCurrentGameCodeState(null);
      console.info('[App] No current game, starting in lobby mode');
    } else {
      // Game exists, load it and exit lobby mode
      try {
        const savedState = loadGameState(code);
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only on mount

  // Handler to enter a game
  const handleEnterGame = React.useCallback((code) => {
    try {
      const normalizedCode = normalizeGameCode(code);
      
      if (!isValidGameCode(normalizedCode)) {
        alert(`Invalid game code: "${code}"`);
        return;
      }
      
      if (!gameExists(normalizedCode)) {
        alert(`Game "${normalizedCode}" not found.`);
        return;
      }
      
      // Load game state
      const savedState = loadGameState(normalizedCode);
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
      } else {
        alert(`Unable to load game "${normalizedCode}". The game state may be corrupted.`);
      }
    } catch (error) {
      console.error('[App] Error entering game:', error.message);
      alert(`Unable to enter game "${code}". ${error.message || 'Please try again.'}`);
    }
  }, [setSelectedGame, setLobbyMode]);

  // Handler to create a new game
  const handleNewGame = React.useCallback(() => {
    try {
      const newCode = createNewGame();
      
      // Initialize game state to initial values
      useGameStore.getState().resetState(3);
      
      // Set as current game
      setCurrentGameCode(newCode);
      setSelectedGame(newCode);
      setLobbyMode(false);
      setCurrentGameCodeState(newCode);
      console.info('[App] Created and entered new game:', newCode);
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
    onDeleteGame: (code) => {
      try {
        const normalizedCode = normalizeGameCode(code);
        const wasCurrentGame = normalizedCode === currentGameCode;
        
        if (deleteGame(normalizedCode)) {
          // If we deleted the current game, return to lobby
          if (wasCurrentGame) {
            clearCurrentGameCode();
            setSelectedGame(null);
            setLobbyMode(true);
            setCurrentGameCodeState(null);
            // Clear game store state
            useGameStore.getState().resetState(3);
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
    onListGames: () => {
      return listGames();
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
      <GameProvider playerID="0">
        <WoodAndSteelState gameManager={gameManager} />
      </GameProvider>
      <GameProvider playerID="1">
        <WoodAndSteelState gameManager={gameManager} />
      </GameProvider>
      <GameProvider playerID="2">
        <WoodAndSteelState gameManager={gameManager} />
      </GameProvider>
    </div>
  );
};

export default App;
