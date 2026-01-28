import React from "react";
import { useLobbyStore } from "../stores/lobbyStore";
import { useStorage } from "../providers/StorageProvider";

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

  // Handle tab switch
  const handleTabSwitch = React.useCallback(async (newStorageType) => {
    if (newStorageType === storage.storageType) {
      return; // Already on this tab
    }
    
    // Switch storage type
    storage.setStorageType(newStorageType);
    
    // Refresh games list with loading indicator
    await refreshGames(true);
  }, [storage, refreshGames]);

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
