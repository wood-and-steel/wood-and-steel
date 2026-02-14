import React from "react";
import { useLobbyStore } from "../stores/lobbyStore";
import { useStorage } from "../providers/StorageProvider";

/**
 * User-friendly error messages for seat assignment errors
 */
const NOT_PLAYING_MESSAGE = 'This device is not playing this game.';

const JOIN_ERROR_MESSAGES = {
  INVALID_CODE: 'Invalid game code format. Please check and try again.',
  GAME_NOT_FOUND: 'Game not found. Please check the code and try again.',
  WRONG_GAME_MODE: 'This game is not accepting join requests (hotseat mode).',
  GAME_FULL: 'This game is full. No more players can join.',
  ALREADY_JOINED: 'You have already joined this game.',
  GAME_STARTED: NOT_PLAYING_MESSAGE,
  UPDATE_FAILED: 'Unable to join game. Please try again.',
  NOT_JOINED: NOT_PLAYING_MESSAGE,
};

/**
 * Tab identifiers for the lobby
 * - 'local': Local storage, hotseat mode only
 * - 'cloud-hotseat': Cloud storage, hotseat mode
 * - 'cloud-byod': Cloud storage, BYOD mode
 */
const TAB_LOCAL = 'local';
const TAB_CLOUD_HOTSEAT = 'cloud-hotseat';
const TAB_CLOUD_BYOD = 'cloud-byod';

/**
 * Map tab to storage type
 */
function getStorageTypeForTab(tab) {
  return tab === TAB_LOCAL ? 'local' : 'cloud';
}

/**
 * Map tab to game mode for new games
 */
function getGameModeForTab(tab) {
  return tab === TAB_CLOUD_BYOD ? 'byod' : 'hotseat';
}

/**
 * Lobby Screen Component
 * Full-screen lobby that serves as the entry point for the application
 * Allows players to manage their games (view, enter, delete, create new)
 */
export function LobbyScreen({ gameManager, onEnterGame, onNewGame }) {
  const [games, setGames] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [showLoadingIndicator, setShowLoadingIndicator] = React.useState(false);
  const { selectedGameCode, joinFormPrefill, clearJoinFormPrefill, setJoinFormPrefill } = useLobbyStore();
  const storage = useStorage();

  // Apply join form prefill when returning from "device not playing" error
  React.useEffect(() => {
    if (joinFormPrefill?.code && joinFormPrefill?.error) {
      setJoinGameCode(joinFormPrefill.code);
      setJoinError(joinFormPrefill.error);
      setActiveTab(TAB_CLOUD_BYOD);
      clearJoinFormPrefill();
    }
  }, [joinFormPrefill]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Active tab state - tracks which tab is selected (separate from storage type since
  // both Cloud tabs use the same storage type)
  const [activeTab, setActiveTab] = React.useState(() => {
    // Initialize based on current storage type, defaulting to hotseat for cloud
    return storage.storageType === 'local' ? TAB_LOCAL : TAB_CLOUD_HOTSEAT;
  });
  
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

  // Filter games based on active tab's expected game mode
  // - Local tab: show all local games (they're always hotseat)
  // - Cloud (Hotseat) tab: show games where gameMode is 'hotseat' or undefined (backward compatibility)
  // - Cloud (BYOD) tab: show only games where gameMode is 'byod'
  const filteredGames = React.useMemo(() => {
    if (activeTab === TAB_LOCAL) {
      // Local storage only has hotseat games, show all
      return games;
    }
    
    const expectedMode = getGameModeForTab(activeTab);
    return games.filter(game => {
      const gameMode = game.metadata?.gameMode || 'hotseat'; // Default to hotseat for backward compatibility
      return gameMode === expectedMode;
    });
  }, [games, activeTab]);

  // Handle tab switch: update active tab and storage type if needed. The effect
  // (storage.storageType dep) runs after re-render and refreshes the list.
  // React state updates are async, so the handler would fetch using the previous
  // storage type. That fetch can resolve after the effect’s (correct) fetch, and
  // overwrite the list (e.g. Local tab briefly shows local, then cloud).
  const handleTabSwitch = React.useCallback((newTab) => {
    if (newTab === activeTab) {
      return;
    }
    
    setActiveTab(newTab);
    
    // Update storage type if it changed
    const newStorageType = getStorageTypeForTab(newTab);
    if (newStorageType !== storage.storageType) {
      storage.setStorageType(newStorageType);
      // The effect will refresh games when storage type changes
    }
    // Note: when switching between Cloud tabs (same storage type), no refresh needed
    // since both tabs show the same games
  }, [activeTab, storage]);

  const handleRowClick = async (game) => {
    const gameCode = game.code;
    if (gameCode === selectedGameCode) return;

    const isBYODWaiting = game.metadata?.gameMode === 'byod' && game.phase === 'waiting_for_players';
    if (isBYODWaiting) {
      // Must join first - clicking row should behave like Join form for BYOD waiting games
      if (storage.storageType !== 'cloud') {
        storage.setStorageType('cloud');
      }
      setActiveTab(TAB_CLOUD_BYOD);
      setIsJoining(true);
      setJoinError('');
      try {
        const result = await storage.joinGame(gameCode);
        if (!result.success) {
          const errorMessage = JOIN_ERROR_MESSAGES[result.error] || 'Unable to join game. Please try again.';
          setJoinGameCode(gameCode);
          setJoinError(errorMessage);
          setIsJoining(false);
          return;
        }
      } catch (error) {
        console.error('[LobbyScreen] Error joining game:', error);
        setJoinGameCode(gameCode);
        setJoinError('An unexpected error occurred. Please try again.');
        setIsJoining(false);
        return;
      }
      setIsJoining(false);
    }

    if (onEnterGame) {
      await onEnterGame(gameCode, isBYODWaiting ? { storageType: 'cloud' } : undefined);
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
      const gameMode = getGameModeForTab(activeTab);
      onNewGame(numPlayers, gameMode);
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
      
      // Successfully joined! Switch to cloud storage and BYOD tab (BYOD is cloud-only)
      if (storage.storageType !== 'cloud') {
        storage.setStorageType('cloud');
      }
      setActiveTab(TAB_CLOUD_BYOD);
      
      // Enter the game (force cloud - we just joined a cloud game, storageType may not have updated yet)
      if (onEnterGame) {
        await onEnterGame(code, { storageType: 'cloud' });
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
            className={`lobbyScreen__tab ${activeTab === TAB_LOCAL ? 'lobbyScreen__tab--active' : ''}`}
            onClick={() => handleTabSwitch(TAB_LOCAL)}
            disabled={isLoading}
          >
            Local
          </button>
          <button
            className={`lobbyScreen__tab ${activeTab === TAB_CLOUD_HOTSEAT ? 'lobbyScreen__tab--active' : ''}`}
            onClick={() => handleTabSwitch(TAB_CLOUD_HOTSEAT)}
            disabled={isLoading}
          >
            Cloud (Hotseat)
          </button>
          <button
            className={`lobbyScreen__tab ${activeTab === TAB_CLOUD_BYOD ? 'lobbyScreen__tab--active' : ''}`}
            onClick={() => handleTabSwitch(TAB_CLOUD_BYOD)}
            disabled={isLoading}
          >
            Cloud (BYOD)
          </button>
          {showLoadingIndicator && (
            <span className="lobbyScreen__loadingIndicator" aria-label="Loading">
              <span className="lobbyScreen__spinner"></span>
            </span>
          )}
        </div>

        {/* Join Game Section - only visible on Cloud (BYOD) tab */}
        {activeTab === TAB_CLOUD_BYOD && (
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
        )}
        
        {isLoading ? (
          <div className="lobbyScreen__emptyState">
            <p>Loading games...</p>
          </div>
        ) : filteredGames.length === 0 ? (
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
                {filteredGames.map(game => (
                  <tr 
                    key={game.code} 
                    className={`table__row ${game.code === selectedGameCode ? 'table__row--current' : ''}`}
                    onClick={() => handleRowClick(game)}
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
