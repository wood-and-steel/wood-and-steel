import React from "react";
import { useLobbyStore } from "../stores/lobbyStore";

/**
 * Lobby Screen Component
 * Full-screen lobby that serves as the entry point for the application
 * Allows players to manage their games (view, enter, delete, create new)
 */
export function LobbyScreen({ gameManager, onEnterGame, onNewGame }) {
  const [games, setGames] = React.useState(() => gameManager.onListGames());
  const { selectedGameCode } = useLobbyStore();

  // Refresh games list when needed
  const refreshGames = React.useCallback(() => {
    setGames(gameManager.onListGames());
  }, [gameManager]);

  // Refresh games list on mount and when gameManager changes
  React.useEffect(() => {
    refreshGames();
  }, [refreshGames]);

  const handleRowClick = (gameCode) => {
    if (gameCode !== selectedGameCode && onEnterGame) {
      onEnterGame(gameCode);
    }
  };

  const handleDeleteGame = (gameCode, event) => {
    // Stop event propagation to prevent row click
    event.stopPropagation();
    
    if (window.confirm(`Are you sure you want to delete game "${gameCode}"?`)) {
      if (gameManager.onDeleteGame(gameCode)) {
        // Refresh the games list after successful deletion
        refreshGames();
      } else {
        alert(`Failed to delete game "${gameCode}".`);
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
        
        {games.length === 0 ? (
          <div className="lobbyScreen__emptyState">
            <p>No games found.</p>
            <div className="lobbyScreen__newGame">
              <label>Start a new game:</label>
              {[2, 3, 4, 5, 6].map(num => (
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
                {[2, 3, 4, 5, 6].map(num => (
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
