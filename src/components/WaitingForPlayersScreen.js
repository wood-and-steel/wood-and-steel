import React from "react";
import { useStorage } from "../providers/StorageProvider";

/**
 * Waiting for Players Screen Component
 * Displayed when a BYOD game is in the 'waiting_for_players' phase.
 * Shows game code, player list, and allows players to set their name.
 * Host can start the game when all players have joined.
 */
export function WaitingForPlayersScreen({ 
  gameCode, 
  numPlayers,
  onStartGame, 
  onCancel,
  onReturnToLobby 
}) {
  const storage = useStorage();
  const [playerName, setPlayerName] = React.useState("");
  const [playerSeats, setPlayerSeats] = React.useState({});
  const [isHost, setIsHost] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [mySeat, setMySeat] = React.useState(null);
  const [error, setError] = React.useState(null);
  const deviceId = storage.getDeviceId();

  // Load player seats and check host status
  const refreshData = React.useCallback(async () => {
    if (!gameCode) return;
    
    try {
      const [seats, hostStatus, seat] = await Promise.all([
        storage.getPlayerSeatsForGame(gameCode),
        storage.amIHost(gameCode),
        storage.getMySeat(gameCode),
      ]);
      
      setPlayerSeats(seats || {});
      setIsHost(hostStatus);
      setMySeat(seat);
      
      // Initialize player name input from seat data
      if (seat && seat.playerName) {
        setPlayerName(seat.playerName);
      }
      
      setError(null);
    } catch (e) {
      console.error('[WaitingForPlayersScreen] Error loading data:', e);
      setError('Failed to load game data');
    } finally {
      setIsLoading(false);
    }
  }, [gameCode, storage]);

  // Initial load
  React.useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Real-time refresh (poll every 2 seconds for simplicity)
  // In the future, this could use real-time subscriptions
  React.useEffect(() => {
    const interval = setInterval(() => {
      refreshData();
    }, 2000);
    
    return () => clearInterval(interval);
  }, [refreshData]);

  // Handle name change with debounced save
  const handleNameChange = (e) => {
    setPlayerName(e.target.value);
  };

  // Save name on blur or Enter key
  const handleNameSave = async () => {
    if (!gameCode || !mySeat) return;
    
    const trimmedName = playerName.trim();
    
    // Skip if name hasn't changed
    if (trimmedName === (mySeat.playerName || '')) return;
    
    setIsSaving(true);
    try {
      const result = await storage.updateMyPlayerName(gameCode, trimmedName || null);
      if (!result.success) {
        console.error('[WaitingForPlayersScreen] Failed to save name:', result.error);
        setError('Failed to save name');
      } else {
        // Refresh to get updated data
        await refreshData();
      }
    } catch (e) {
      console.error('[WaitingForPlayersScreen] Error saving name:', e);
      setError('Failed to save name');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur(); // This will trigger handleNameSave via onBlur
    }
  };

  // Handle start game (host only)
  const handleStartGame = async () => {
    if (!isHost || !allPlayersJoined) return;
    
    setIsLoading(true);
    try {
      // Assign random playerIDs
      const result = await storage.startBYODGame(gameCode);
      
      if (!result.success) {
        console.error('[WaitingForPlayersScreen] Failed to start game:', result.error);
        setError(`Failed to start game: ${result.error}`);
        setIsLoading(false);
        return;
      }
      
      // Callback to parent to handle phase transition
      if (onStartGame) {
        onStartGame(result.assignments);
      }
    } catch (e) {
      console.error('[WaitingForPlayersScreen] Error starting game:', e);
      setError('Failed to start game');
      setIsLoading(false);
    }
  };

  // Handle cancel (host only - deletes game)
  const handleCancel = () => {
    if (!isHost) return;
    
    if (window.confirm('Are you sure you want to cancel? This will delete the game for all players.')) {
      if (onCancel) {
        onCancel();
      }
    }
  };

  // Handle return to lobby (non-host players)
  const handleReturnToLobby = () => {
    if (onReturnToLobby) {
      onReturnToLobby();
    }
  };

  // Calculate player list
  const seatEntries = Object.entries(playerSeats);
  const joinedCount = seatEntries.length;
  const allPlayersJoined = joinedCount >= numPlayers;
  const openSeats = numPlayers - joinedCount;

  // Format device ID for display (show first 8 chars)
  const formatDeviceId = (id) => {
    return id ? id.substring(0, 8) : 'Unknown';
  };

  // Determine display name for a seat
  const getSeatDisplayName = (seatDeviceId, seat, index) => {
    const isMe = seatDeviceId === deviceId;
    
    if (seat.playerName) {
      return (
        <>
          {seat.playerName}
          {isMe && <span className="waitingScreen__playerTag"> (You)</span>}
        </>
      );
    }
    
    // No name set yet
    return (
      <>
        Player {formatDeviceId(seatDeviceId)}
        {isMe && <span className="waitingScreen__playerTag"> (You)</span>}
      </>
    );
  };

  // Copy game code to clipboard
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(gameCode);
      // Could show a toast notification here
    } catch (e) {
      console.error('[WaitingForPlayersScreen] Failed to copy code:', e);
    }
  };

  if (isLoading && Object.keys(playerSeats).length === 0 && !mySeat) {
    return (
      <div className="waitingScreen">
        <div className="waitingScreen__content">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="waitingScreen">
      <div className="waitingScreen__content">
        <h1 className="waitingScreen__title">Waiting for Players</h1>
        
        {/* Game Code Display */}
        <div className="waitingScreen__codeSection">
          <p className="waitingScreen__codeLabel">Share this code with other players:</p>
          <div className="waitingScreen__codeDisplay">
            <span className="waitingScreen__code">{gameCode}</span>
            <button 
              className="button waitingScreen__copyButton"
              onClick={handleCopyCode}
              title="Copy to clipboard"
            >
              Copy
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="waitingScreen__error">
            {error}
          </div>
        )}

        {/* Player Name Input (only if joined) */}
        {mySeat && (
          <div className="waitingScreen__nameSection">
            <label className="waitingScreen__nameLabel" htmlFor="playerName">
              Your Name:
            </label>
            <input
              id="playerName"
              type="text"
              className="waitingScreen__nameInput"
              value={playerName}
              onChange={handleNameChange}
              onBlur={handleNameSave}
              onKeyDown={handleNameKeyDown}
              placeholder="Enter your name"
              maxLength={20}
              disabled={isSaving}
            />
            {isSaving && <span className="waitingScreen__savingIndicator">Saving...</span>}
          </div>
        )}

        {/* Player List */}
        <div className="waitingScreen__playersSection">
          <h2 className="waitingScreen__playersTitle">
            Players ({joinedCount}/{numPlayers})
          </h2>
          <ul className="waitingScreen__playersList">
            {seatEntries.map(([seatDeviceId, seat], index) => (
              <li 
                key={seatDeviceId} 
                className={`waitingScreen__playerItem ${seatDeviceId === deviceId ? 'waitingScreen__playerItem--me' : ''}`}
              >
                <span className="waitingScreen__playerStatus waitingScreen__playerStatus--joined">
                  ✓
                </span>
                <span className="waitingScreen__playerName">
                  {getSeatDisplayName(seatDeviceId, seat, index)}
                </span>
              </li>
            ))}
            {/* Open seats */}
            {Array.from({ length: openSeats }, (_, i) => (
              <li 
                key={`open-${i}`} 
                className="waitingScreen__playerItem waitingScreen__playerItem--open"
              >
                <span className="waitingScreen__playerStatus waitingScreen__playerStatus--open">
                  ○
                </span>
                <span className="waitingScreen__playerName waitingScreen__playerName--open">
                  Open seat
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="waitingScreen__actions">
          {isHost ? (
            <>
              <button
                className="button waitingScreen__startButton"
                onClick={handleStartGame}
                disabled={!allPlayersJoined || isLoading}
              >
                {isLoading ? 'Starting...' : 'Start Game'}
              </button>
              <button
                className="button waitingScreen__cancelButton"
                onClick={handleCancel}
                disabled={isLoading}
              >
                Cancel Game
              </button>
            </>
          ) : (
            <button
              className="button"
              onClick={handleReturnToLobby}
            >
              Return to Lobby
            </button>
          )}
        </div>

        {/* Status Message */}
        <div className="waitingScreen__statusMessage">
          {!allPlayersJoined ? (
            <p>Waiting for {openSeats} more player{openSeats > 1 ? 's' : ''} to join...</p>
          ) : isHost ? (
            <p>All players have joined! Click "Start Game" to begin.</p>
          ) : (
            <p>All players have joined! Waiting for host to start the game...</p>
          )}
        </div>
      </div>
    </div>
  );
}
