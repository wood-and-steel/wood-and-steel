import React from 'react';
import { GameProvider } from '../providers/GameProvider';
import { WoodAndSteelState } from '../Board';
import { 
  getCurrentGameCode, 
  createNewGame,
  gameExists,
  listGames,
  deleteGame,
  switchToGame,
  isValidGameCode,
  normalizeGameCode
} from '../utils/gameManager';

const App = () => {
  // Get or create game code
  const [currentGameCode, setCurrentGameCodeState] = React.useState(() => {
    let code = getCurrentGameCode();
    
    // If no current game or it doesn't exist, create a new one
    if (!code || !gameExists(code)) {
      code = createNewGame();
    }
    
    return code;
  });

  // Pass game management functions to the board through context
  const gameManager = {
    currentGameCode,
    onNewGame: () => {
      const newCode = createNewGame();
      setCurrentGameCodeState(newCode);
      // Force page reload to reset the game state
      window.location.reload();
    },
    onSwitchGame: (code) => {
      if (switchToGame(code)) {
        setCurrentGameCodeState(normalizeGameCode(code));
        // Force page reload to switch the game
        window.location.reload();
      } else {
        alert(`Game "${code}" not found. Please check the code and try again.`);
      }
    },
    onDeleteGame: (code) => {
      if (deleteGame(code)) {
        // If we deleted the current game, create a new one
        if (normalizeGameCode(code) === currentGameCode) {
          const newCode = createNewGame();
          setCurrentGameCodeState(newCode);
          window.location.reload();
        }
        return true;
      }
      return false;
    },
    onListGames: () => {
      return listGames();
    },
    isValidGameCode,
    normalizeGameCode
  };

  return (
    <div>
      <GameProvider playerID="0">
        <WoodAndSteelState gameManager={gameManager} />
      </GameProvider>
      <GameProvider playerID="1">
        <WoodAndSteelState gameManager={gameManager} />
      </GameProvider>
    </div>
  );
};

export default App;
