import React from "react";
import { useNavigate } from "react-router-dom";
import { useLobbyStore } from "../stores/lobbyStore";
import { useStorage } from "../providers/StorageProvider";
import { SUPABASE_DASHBOARD_URL } from "../config/storage";
import { CloudUnavailableError, isCloudUnreachableError } from "../utils/storage/cloudErrors";
import type { GameListItem } from "../utils/storage/storageAdapter";
import { isSupportedGameMetadata } from "../utils/gameManager";

const NOT_PLAYING_MESSAGE = "This device is not playing this game.";

const JOIN_ERROR_MESSAGES: Record<string, string> = {
  INVALID_CODE: "Invalid game code format. Please check and try again.",
  GAME_NOT_FOUND: "Game not found. Please check the code and try again.",
  WRONG_GAME_MODE: "This game was created by an older version and can no longer be joined.",
  GAME_FULL: "This game is full. No more players can join.",
  ALREADY_JOINED: "You have already joined this game.",
  GAME_STARTED: NOT_PLAYING_MESSAGE,
  UPDATE_FAILED: "Unable to join game. Please try again.",
  NOT_JOINED: NOT_PLAYING_MESSAGE,
};

function isCloudUnavailable(error: unknown): boolean {
  return error instanceof CloudUnavailableError || isCloudUnreachableError(error);
}

export interface LobbyScreenGameManager {
  onListGames: () => Promise<GameListItem[] | unknown[]>;
  onDeleteGame: (code: string) => Promise<boolean>;
}

export interface LobbyScreenProps {
  gameManager: LobbyScreenGameManager;
  onEnterGame?: (gameCode: string) => Promise<void>;
  onNewGame?: (numPlayers: number) => void;
}

/**
 * Full-screen lobby that serves as the entry point for the application.
 * Allows players to manage their games (view, enter, delete, create new).
 */
export function LobbyScreen({
  gameManager,
  onEnterGame,
  onNewGame,
}: LobbyScreenProps): React.ReactElement {
  const [games, setGames] = React.useState<GameListItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [showLoadingIndicator, setShowLoadingIndicator] = React.useState(false);
  const [cloudError, setCloudError] = React.useState<"unavailable" | "generic" | null>(null);
  const { selectedGameCode, joinFormPrefill, clearJoinFormPrefill, setJoinFormPrefill } =
    useLobbyStore();
  const storage = useStorage();
  const navigate = useNavigate();

  const doJoinGame = React.useCallback(
    async (code: string): Promise<void> => {
      setJoinError("");
      setIsJoining(true);
      try {
        const result = await storage.joinGame(code);
        if (!result.success) {
          const errorMessage =
            JOIN_ERROR_MESSAGES[result.error ?? ""] ?? "Unable to join game. Please try again.";
          setJoinFormPrefill(code, errorMessage);
          return;
        }
        if (onEnterGame) {
          await onEnterGame(code);
          navigate("/", { replace: true });
        }
      } catch (error) {
        console.error("[LobbyScreen] Error joining game:", error);
        setJoinFormPrefill(code, "An unexpected error occurred. Please try again.");
      } finally {
        setIsJoining(false);
      }
    },
    [storage, onEnterGame, setJoinFormPrefill, navigate]
  );

  React.useEffect(() => {
    if (!joinFormPrefill?.code) return;

    if (joinFormPrefill.error) {
      setJoinGameCode(joinFormPrefill.code);
      setJoinError(joinFormPrefill.error);
      clearJoinFormPrefill();
      return;
    }

    if (joinFormPrefill.autoJoin) {
      const code = joinFormPrefill.code;
      clearJoinFormPrefill();
      doJoinGame(code);
    }
  }, [joinFormPrefill, clearJoinFormPrefill, setJoinFormPrefill, doJoinGame]);

  const [joinGameCode, setJoinGameCode] = React.useState("");
  const [joinError, setJoinError] = React.useState("");
  const [isJoining, setIsJoining] = React.useState(false);

  const refreshGames = React.useCallback(
    async (showLoading = false) => {
      const startTime = Date.now();

      try {
        setIsLoading(true);
        setCloudError(null);
        if (showLoading) {
          setShowLoadingIndicator(false);
          const loadingTimeout = setTimeout(() => {
            setShowLoadingIndicator(true);
          }, 250);

          const gamesList = await gameManager.onListGames();
          clearTimeout(loadingTimeout);

          if (Date.now() - startTime >= 250) {
            setShowLoadingIndicator(true);
            setTimeout(() => setShowLoadingIndicator(false), 100);
          }

          setGames((gamesList as GameListItem[]) || []);
        } else {
          const gamesList = await gameManager.onListGames();
          setGames((gamesList as GameListItem[]) || []);
        }
      } catch (error) {
        console.error("[LobbyScreen] Error loading games:", error);
        setGames([]);
        setCloudError(isCloudUnavailable(error) ? "unavailable" : "generic");
      } finally {
        setIsLoading(false);
      }
    },
    [gameManager]
  );

  React.useEffect(() => {
    refreshGames();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Rows created by older app versions can't be opened, so they aren't listed.
  const filteredGames = React.useMemo(
    () => games.filter((game: GameListItem) => isSupportedGameMetadata(game.metadata)),
    [games]
  );

  const handleRowClick = async (game: GameListItem) => {
    const gameCode = game.code;
    if (gameCode === selectedGameCode) return;

    const isWaiting = game.phase === "waiting_for_players";
    if (isWaiting) {
      setIsJoining(true);
      setJoinError("");
      try {
        const result = await storage.joinGame(gameCode);
        if (!result.success) {
          const errorMessage =
            JOIN_ERROR_MESSAGES[result.error ?? ""] ?? "Unable to join game. Please try again.";
          setJoinGameCode(gameCode);
          setJoinError(errorMessage);
          setIsJoining(false);
          return;
        }
      } catch (error) {
        console.error("[LobbyScreen] Error joining game:", error);
        setJoinGameCode(gameCode);
        setJoinError("An unexpected error occurred. Please try again.");
        setIsJoining(false);
        return;
      }
      setIsJoining(false);
    }

    if (onEnterGame) {
      await onEnterGame(gameCode);
    }
  };

  const handleDeleteGame = async (gameCode: string, event: React.MouseEvent) => {
    event.stopPropagation();

    if (window.confirm(`Are you sure you want to delete game "${gameCode}"?`)) {
      try {
        const deleted = await gameManager.onDeleteGame(gameCode);
        if (deleted) {
          await refreshGames();
        } else {
          alert(`Failed to delete game "${gameCode}".`);
        }
      } catch (error) {
        console.error("[LobbyScreen] Error deleting game:", error);
        alert(
          `Failed to delete game "${gameCode}". ${error instanceof Error ? error.message : "Please try again."}`
        );
      }
    }
  };

  const handleNewGame = (numPlayers: number) => {
    if (onNewGame) {
      onNewGame(numPlayers);
    }
  };

  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault();

    const code = joinGameCode.trim().toUpperCase();

    if (!code) {
      setJoinError("Please enter a game code.");
      return;
    }

    await doJoinGame(code);
    setJoinGameCode("");
  };

  const handleJoinCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setJoinGameCode(e.target.value);
    if (joinError) setJoinError("");
  };

  const formatLastModified = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString();
    } catch {
      return "Unknown";
    }
  };

  return (
    <div className="lobbyScreen">
      <div className="lobbyScreen__content">
        <h1 className="lobbyScreen__title">
          Wood and Steel Lobby
          {showLoadingIndicator && (
            <span className="lobbyScreen__loadingIndicator" aria-label="Loading">
              <span className="lobbyScreen__spinner" />
            </span>
          )}
        </h1>

        {cloudError && (
          <div className="lobbyScreen__cloudError" role="alert">
            {cloudError === "unavailable" ? (
              <p>
                Cloud storage is unavailable. The Supabase project is likely paused (free-tier
                projects pause after inactivity).{" "}
                <a
                  className="lobbyScreen__cloudErrorLink"
                  href={SUPABASE_DASHBOARD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open the Supabase dashboard
                </a>{" "}
                to sign in and resume the project, then retry.
              </p>
            ) : (
              <p>Unable to load cloud games. Check your connection and try again.</p>
            )}
            <button
              type="button"
              className="button lobbyScreen__cloudErrorRetry"
              onClick={() => refreshGames(true)}
              disabled={isLoading}
            >
              Retry
            </button>
          </div>
        )}

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
              disabled={isJoining || !!cloudError}
              autoComplete="off"
              autoCapitalize="characters"
            />
            <button
              type="submit"
              className="button lobbyScreen__joinButton"
              disabled={isJoining || !joinGameCode.trim() || !!cloudError}
            >
              {isJoining ? "Joining..." : "Join"}
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
        ) : cloudError ? (
          <div className="lobbyScreen__emptyState">
            <p>Cloud games cannot be listed until storage is available.</p>
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="lobbyScreen__emptyState">
            <p>No games found.</p>
            <div className="lobbyScreen__newGame">
              <label>Start a new game:</label>
              {[2, 3, 4, 5].map((num) => (
                <button key={num} onClick={() => handleNewGame(num)} className="button">
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
                {filteredGames.map((game: GameListItem) => (
                  <tr
                    key={game.code}
                    className={`table__row ${game.code === selectedGameCode ? "table__row--current" : ""}`}
                    onClick={() => handleRowClick(game)}
                  >
                    <td
                      className={`table__cell ${game.code === selectedGameCode ? "table__cell--bold" : ""}`}
                    >
                      {game.code}
                      {game.code === selectedGameCode && " (current)"}
                    </td>
                    <td className="table__cell">{game.phase}</td>
                    <td className="table__cell">{game.numPlayers}</td>
                    <td className="table__cell table__cell--hide-mobile">
                      {formatLastModified(game.lastModified)}
                    </td>
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
                {[2, 3, 4, 5].map((num) => (
                  <button key={num} onClick={() => handleNewGame(num)} className="button">
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
