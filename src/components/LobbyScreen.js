import React from "react";
import { useLobbyStore } from "../stores/lobbyStore";
import { useStorage } from "../providers/StorageProvider";

/**
 * User-friendly error messages for seat assignment errors
 */
const JOIN_ERROR_MESSAGES = {
  INVALID_CODE: 'Invalid game code format. Please check and try again.',
  GAME_NOT_FOUND: 'Game not found. Please check the code and try again.',
  WRONG_GAME_MODE: 'This game is not accepting join requests (hotseat mode).',
  GAME_FULL: 'This game is full. No more players can join.',
  ALREADY_JOINED: 'You have already joined this game.',
  GAME_STARTED: 'This game has already started.',
  UPDATE_FAILED: 'Unable to join game. Please try again.',
  NOT_JOINED: 'You have not joined this game.',
};

/**
 * Lobby Screen Component
 * Full-screen lobby that serves as the entry point for the application
 * Allows players to manage their games (view, enter, delete, create new)
 */
export function LobbyScreen({ gameManager, onEnterGame, onNewGame }) {
  const [games, setGames] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [showLoadingIndicator, setShowLoadingIndicator] = React.useState(false);
  const { selectedGameCode } = useLobbyStore();
  const storage = useStorage();
  
  // Join game state
  const [joinGameCode, setJoinGameCode] = React.useState('');
  const [joinError, setJoinError] = React.useState('');
  const [isJoining, setIsJoining] = React.useState(false);

  // Refresh games list when needed
  const refreshGames = React.useCallback(async (showLoading = false) => {
    const startTime = Date.now();
    
    try {
      setIsLoading(true);
      if (showLoading) {
        setShowLoadingIndicator(false);
        // Show loading indicator if operation takes >250ms
        const loadingTimeout = setTimeout(() => {
          setShowLoadingIndicator(true);
        }, 250);
        
        const gamesList = await gameManager.onListGames();
        clearTimeout(loadingTimeout);
        
        // If we're still loading and it's been >250ms, show indicator briefly
        if (Date.now() - startTime >= 250) {
          setShowLoadingIndicator(true);
          // Hide after brief delay to show completion
          setTimeout(() => setShowLoadingIndicator(false), 100);
        }
        
        setGames(gamesList || []);
      } else {
        const gamesList = await gameManager.onListGames();
        setGames(gamesList || []);
      }
    } catch (error) {
      console.error('[LobbyScreen] Error loading games:', error);
      setGames([]);
    } finally {
      setIsLoading(false);
    }
  }, [gameManager]);

  // Refresh games list on mount and when storage type changes
  React.useEffect(() => {
    refreshGames();
  }, [storage.storageType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle tab switch: only update storage type. The effect (storage.storageType dep)
  // runs after re-render and refreshes the list. Do NOT call refreshGames here:
  // React state updates are async, so the handler would fetch using the previous
  // storage type. That fetch can resolve after the effect’s (correct) fetch, and
  // overwrite the list (e.g. Local tab briefly shows local, then cloud).
  const handleTabSwitch = React.useCallback((newStorageType) => {
    if (newStorageType === storage.storageType) {
      return;
    }
    storage.setStorageType(newStorageType);
  }, [storage]);

  const handleRowClick = (gameCode) => {
    if (gameCode !== selectedGameCode && onEnterGame) {
      onEnterGame(gameCode);
    }
  };

  const handleDeleteGame = async (gameCode, event) => {
    // Stop event propagation to prevent row click
    event.stopPropagation();
    
    if (window.confirm(`Are you sure you want to delete game "${gameCode}"?`)) {
      try {
        const deleted = await gameManager.onDeleteGame(gameCode);
        if (deleted) {
          // Refresh the games list after successful deletion
          await refreshGames();
        } else {
          alert(`Failed to delete game "${gameCode}".`);
        }
      } catch (error) {
        console.error('[LobbyScreen] Error deleting game:', error);
        alert(`Failed to delete game "${gameCode}". ${error.message || 'Please try again.'}`);
      }
    }
  };

  const handleNewGame = (numPlayers) => {
    if (onNewGame) {
      onNewGame(numPlayers);
    }
  };

  // Handle joining a BYOD game
  const handleJoinGame = async (e) => {
    e.preventDefault();
    
    const code = joinGameCode.trim().toUpperCase();
    
    // Basic validation
    if (!code) {
      setJoinError('Please enter a game code.');
      return;
    }
    
    // Clear previous error
    setJoinError('');
    setIsJoining(true);
    
    try {
      // Attempt to join the game (this uses cloud storage internally)
      const result = await storage.joinGame(code);
      
      if (!result.success) {
        // Show user-friendly error message
        const errorMessage = JOIN_ERROR_MESSAGES[result.error] || 'Unable to join game. Please try again.';
        setJoinError(errorMessage);
        setIsJoining(false);
        return;
      }
      
      // Successfully joined! Switch to cloud storage (BYOD is cloud-only)
      if (storage.storageType !== 'cloud') {
        storage.setStorageType('cloud');
      }
      
      // Enter the game (this will load the game and show WaitingForPlayersScreen)
      if (onEnterGame) {
        await onEnterGame(code);
      }
      
      // Clear the form
      setJoinGameCode('');
    } catch (error) {
      console.error('[LobbyScreen] Error joining game:', error);
      setJoinError('An unexpected error occurred. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  // Clear join error when user starts typing
  const handleJoinCodeChange = (e) => {
    setJoinGameCode(e.target.value);
    if (joinError) {
      setJoinError('');
    }
  };

  // Format lastModified timestamp to readable date/time
  const formatLastModified = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString();
    } catch (e) {
      return 'Unknown';
    }
  };

  return (
    <div className="lobbyScreen">
      <div className="lobbyScreen__content">
        <h1 className="lobbyScreen__title">Wood and Steel Lobby</h1>
        
        {/* Tab Bar */}
        <div className="lobbyScreen__tabs">
          <button
            className={`lobbyScreen__tab ${storage.storageType === 'local' ? 'lobbyScreen__tab--active' : ''}`}
            onClick={() => handleTabSwitch('local')}
            disabled={isLoading}
          >
            Local
          </button>
          <button
            className={`lobbyScreen__tab ${storage.storageType === 'cloud' ? 'lobbyScreen__tab--active' : ''}`}
            onClick={() => handleTabSwitch('cloud')}
            disabled={isLoading}
          >
            Cloud
          </button>
          {showLoadingIndicator && (
            <span className="lobbyScreen__loadingIndicator" aria-label="Loading">
              <span className="lobbyScreen__spinner"></span>
            </span>
          )}
        </div>

        {/* Join Game Section
            TODO: Once the "Cloud (BYOD)" tab is implemented, this section should only
            be visible on that tab. For now, it's shown on all tabs since BYOD games
            can only be joined via cloud storage anyway. */}
        <div className="lobbyScreen__joinGame">
          <form onSubmit={handleJoinGame} className="lobbyScreen__joinForm">
            <label htmlFor="joinGameCode" className="lobbyScreen__joinLabel">
              Join a game:
            </label>
            <input
              id="joinGameCode"
              type="text"
              value={joinGameCode}
              onChange={handleJoinCodeChange}
              placeholder="Enter game code"
              className="lobbyScreen__joinInput"
              maxLength={6}
              disabled={isJoining}
              autoComplete="off"
              autoCapitalize="characters"
            />
            <button
              type="submit"
              className="button lobbyScreen__joinButton"
              disabled={isJoining || !joinGameCode.trim()}
            >
              {isJoining ? 'Joining...' : 'Join'}
            </button>
          </form>
          {joinError && (
            <p className="lobbyScreen__joinError" role="alert">
              {joinError}
            </p>
          )}
        </div>
        
        {isLoading ? (
          <div className="lobbyScreen__emptyState">
            <p>Loading games...</p>
          </div>
        ) : games.length === 0 ? (
          <div className="lobbyScreen__emptyState">
            <p>No games found.</p>
            <div className="lobbyScreen__newGame">
              <label>Start a new game:</label>
              {[2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  onClick={() => handleNewGame(num)}
                  className="button"
                >
                  {num}
                </button>
              ))}
              <label>players</label>
            </div>
          </div>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr className="table__header">
                  <th className="table__headerCell">Code</th>
                  <th className="table__headerCell">Phase</th>
                  <th className="table__headerCell">Players</th>
                  <th className="table__headerCell table__headerCell--hide-mobile">Last Turn</th>
                  <th className="table__headerCell">Delete</th>
                </tr>
              </thead>
              <tbody>
                {games.map(game => (
                  <tr 
                    key={game.code} 
                    className={`table__row ${game.code === selectedGameCode ? 'table__row--current' : ''}`}
                    onClick={() => handleRowClick(game.code)}
                  >
                    <td className={`table__cell ${game.code === selectedGameCode ? 'table__cell--bold' : ''}`}>
                      {game.code}
                      {game.code === selectedGameCode && ' (current)'}
                    </td>
                    <td className="table__cell">{game.phase}</td>
                    <td className="table__cell">{game.numPlayers}</td>
                    <td className="table__cell table__cell--hide-mobile">{formatLastModified(game.lastModified)}</td>
                    <td className="table__cell table__cell--delete">
                      <button 
                        className="button button--icon button--danger"
                        onClick={(e) => handleDeleteGame(game.code, e)}
                        aria-label={`Delete game ${game.code}`}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="lobbyScreen__actions">
              <div className="lobbyScreen__newGame">
                <label>Start a new game:</label>
                {[2, 3, 4, 5].map(num => (
                  <button
                    key={num}
                    onClick={() => handleNewGame(num)}
                    className="button"
                  >
                    {num}
                  </button>
                ))}
                <label>players</label>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
