import React from "react";
import { useStorage } from "../providers/StorageProvider";

export interface PlayerSeatDisplay {
  playerName?: string | null;
}

export interface WaitingForPlayersScreenProps {
  gameCode: string;
  numPlayers: number;
  onStartGame?: (assignments: Record<string, string>) => void;
  onCancel?: () => void;
  onReturnToLobby?: () => void;
}

/**
 * Displayed when a BYOD game is in the 'waiting_for_players' phase.
 * Shows game code, player list, and allows players to set their name.
 * Host can start the game when all players have joined.
 */
export function WaitingForPlayersScreen({
  gameCode,
  numPlayers,
  onStartGame,
  onCancel,
  onReturnToLobby,
}: WaitingForPlayersScreenProps): React.ReactElement {
  const storage = useStorage();
  const [playerName, setPlayerName] = React.useState("");
  const [playerSeats, setPlayerSeats] = React.useState<Record<string, PlayerSeatDisplay>>({});
  const [isHost, setIsHost] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [mySeat, setMySeat] = React.useState<PlayerSeatDisplay | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const deviceId = storage.getDeviceId();

  const isFirstRefresh = React.useRef(true);

  const refreshData = React.useCallback(async () => {
    if (!gameCode) return;

    try {
      const [seats, hostStatus, seat] = await Promise.all([
        storage.getPlayerSeatsForGame(gameCode),
        storage.amIHost(gameCode),
        storage.getMySeat(gameCode),
      ]);

      setPlayerSeats((seats as Record<string, PlayerSeatDisplay>) || {});
      setIsHost(hostStatus);
      setMySeat((seat as PlayerSeatDisplay) ?? null);

      if (isFirstRefresh.current && seat && typeof seat === "object" && "playerName" in seat) {
        setPlayerName(String((seat as PlayerSeatDisplay).playerName ?? ""));
      }
      isFirstRefresh.current = false;

      setError(null);
    } catch (e) {
      console.error("[WaitingForPlayersScreen] Error loading data:", e);
      setError("Failed to load game data");
    } finally {
      setIsLoading(false);
    }
  }, [gameCode, storage]);

  React.useEffect(() => {
    refreshData();
  }, [refreshData]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      refreshData();
    }, 2000);

    return () => clearInterval(interval);
  }, [refreshData]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlayerName(e.target.value);
  };

  const handleNameSave = async () => {
    if (!gameCode || !mySeat) return;

    const trimmedName = playerName.trim();

    if (trimmedName === (mySeat.playerName ?? "")) return;

    setIsSaving(true);
    try {
      const result = await storage.updateMyPlayerName(gameCode, trimmedName || "");
      if (!result.success) {
        console.error("[WaitingForPlayersScreen] Failed to save name:", result.error);
        setError("Failed to save name");
      } else {
        await refreshData();
      }
    } catch (e) {
      console.error("[WaitingForPlayersScreen] Error saving name:", e);
      setError("Failed to save name");
    } finally {
      setIsSaving(false);
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleStartGame = async () => {
    if (!isHost) return;

    const seatEntries = Object.entries(playerSeats);
    const joinedCount = seatEntries.length;
    const allPlayersJoined = joinedCount >= numPlayers;
    if (!allPlayersJoined) return;

    setIsLoading(true);
    try {
      const result = await storage.startBYODGame(gameCode);

      if (!result.success) {
        console.error("[WaitingForPlayersScreen] Failed to start game:", result.error);
        setError(`Failed to start game: ${result.error}`);
        setIsLoading(false);
        return;
      }

      if (onStartGame && result.assignments) {
        onStartGame(result.assignments);
      }
    } catch (e) {
      console.error("[WaitingForPlayersScreen] Error starting game:", e);
      setError("Failed to start game");
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (!isHost) return;

    if (
      window.confirm("Are you sure you want to cancel? This will delete the game for all players.")
    ) {
      onCancel?.();
    }
  };

  const handleReturnToLobby = () => {
    onReturnToLobby?.();
  };

  const seatEntries = Object.entries(playerSeats);
  const joinedCount = seatEntries.length;
  const allPlayersJoined = joinedCount >= numPlayers;
  const openSeats = numPlayers - joinedCount;

  const formatDeviceId = (id: string): string => {
    return id ? id.substring(0, 8) : "Unknown";
  };

  const getSeatDisplayName = (
    seatDeviceId: string,
    seat: PlayerSeatDisplay,
    _index: number
  ): React.ReactNode => {
    const isMe = seatDeviceId === deviceId;

    if (seat.playerName) {
      return (
        <>
          {seat.playerName}
          {isMe && <span className="waitingScreen__playerTag"> (You)</span>}
        </>
      );
    }

    return (
      <>
        Player {formatDeviceId(seatDeviceId)}
        {isMe && <span className="waitingScreen__playerTag"> (You)</span>}
      </>
    );
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(gameCode);
    } catch (e) {
      console.error("[WaitingForPlayersScreen] Failed to copy code:", e);
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

        {error && <div className="waitingScreen__error">{error}</div>}

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

        <div className="waitingScreen__playersSection">
          <h2 className="waitingScreen__playersTitle">
            Players ({joinedCount}/{numPlayers})
          </h2>
          <ul className="waitingScreen__playersList">
            {seatEntries.map(([seatDeviceId, seat], index) => (
              <li
                key={seatDeviceId}
                className={`waitingScreen__playerItem ${seatDeviceId === deviceId ? "waitingScreen__playerItem--me" : ""}`}
              >
                <span className="waitingScreen__playerStatus waitingScreen__playerStatus--joined">
                  ✓
                </span>
                <span className="waitingScreen__playerName">
                  {getSeatDisplayName(seatDeviceId, seat as PlayerSeatDisplay, index)}
                </span>
              </li>
            ))}
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

        <div className="waitingScreen__actions">
          {isHost ? (
            <>
              <button
                className="button waitingScreen__startButton"
                onClick={handleStartGame}
                disabled={!allPlayersJoined || isLoading}
              >
                {isLoading ? "Starting..." : "Start Game"}
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
            <button className="button" onClick={handleReturnToLobby}>
              Return to Lobby
            </button>
          )}
        </div>

        <div className="waitingScreen__statusMessage">
          {!allPlayersJoined ? (
            <p>
              Waiting for {openSeats} more player{openSeats > 1 ? "s" : ""} to join...
            </p>
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
