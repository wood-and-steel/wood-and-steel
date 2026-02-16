import React from "react";
import { useLobbyStore } from "../stores/lobbyStore";
import { useStorage } from "../providers/StorageProvider";
import type { GameListItem } from "../utils/storage/storageAdapter";

const NOT_PLAYING_MESSAGE = "This device is not playing this game.";

const JOIN_ERROR_MESSAGES: Record<string, string> = {
  INVALID_CODE: "Invalid game code format. Please check and try again.",
  GAME_NOT_FOUND: "Game not found. Please check the code and try again.",
  WRONG_GAME_MODE: "This game is not accepting join requests (hotseat mode).",
  GAME_FULL: "This game is full. No more players can join.",
  ALREADY_JOINED: "You have already joined this game.",
  GAME_STARTED: NOT_PLAYING_MESSAGE,
  UPDATE_FAILED: "Unable to join game. Please try again.",
  NOT_JOINED: NOT_PLAYING_MESSAGE,
};

const TAB_LOCAL = "local";
const TAB_CLOUD_HOTSEAT = "cloud-hotseat";
const TAB_CLOUD_BYOD = "cloud-byod";

type LobbyTab = typeof TAB_LOCAL | typeof TAB_CLOUD_HOTSEAT | typeof TAB_CLOUD_BYOD;

function getStorageTypeForTab(tab: LobbyTab): "local" | "cloud" {
  return tab === TAB_LOCAL ? "local" : "cloud";
}

function getGameModeForTab(tab: LobbyTab): "hotseat" | "byod" {
  return tab === TAB_CLOUD_BYOD ? "byod" : "hotseat";
}

export interface LobbyScreenGameManager {
  onListGames: () => Promise<GameListItem[] | unknown[]>;
  onDeleteGame: (code: string) => Promise<boolean>;
}

export interface LobbyScreenProps {
  gameManager: LobbyScreenGameManager;
  onEnterGame?: (gameCode: string, options?: { storageType?: "cloud" }) => Promise<void>;
  onNewGame?: (numPlayers: number, gameMode: "hotseat" | "byod") => void;
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
  const { selectedGameCode, joinFormPrefill, clearJoinFormPrefill, setJoinFormPrefill } =
    useLobbyStore();
  const storage = useStorage();

  React.useEffect(() => {
    if (joinFormPrefill?.code && joinFormPrefill?.error) {
      setJoinGameCode(joinFormPrefill.code);
      setJoinError(joinFormPrefill.error);
      setActiveTab(TAB_CLOUD_BYOD);
      clearJoinFormPrefill();
    }
  }, [joinFormPrefill, clearJoinFormPrefill, setJoinFormPrefill]);

  const [activeTab, setActiveTab] = React.useState<LobbyTab>(() =>
    storage.storageType === "local" ? TAB_LOCAL : TAB_CLOUD_HOTSEAT
  );

  const [joinGameCode, setJoinGameCode] = React.useState("");
  const [joinError, setJoinError] = React.useState("");
  const [isJoining, setIsJoining] = React.useState(false);

  const refreshGames = React.useCallback(
    async (showLoading = false) => {
      const startTime = Date.now();

      try {
        setIsLoading(true);
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
      } finally {
        setIsLoading(false);
      }
    },
    [gameManager]
  );

  React.useEffect(() => {
    refreshGames();
  }, [storage.storageType]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredGames = React.useMemo(() => {
    if (activeTab === TAB_LOCAL) return games;

    const expectedMode = getGameModeForTab(activeTab);
    return games.filter((game: GameListItem) => {
      const gameMode = (game.metadata?.gameMode as string) || "hotseat";
      return gameMode === expectedMode;
    });
  }, [games, activeTab]);

  const handleTabSwitch = React.useCallback(
    (newTab: LobbyTab) => {
      if (newTab === activeTab) return;

      setActiveTab(newTab);

      const newStorageType = getStorageTypeForTab(newTab);
      if (newStorageType !== storage.storageType) {
        storage.setStorageType(newStorageType);
      }
    },
    [activeTab, storage]
  );

  const handleRowClick = async (game: GameListItem) => {
    const gameCode = game.code;
    if (gameCode === selectedGameCode) return;

    const isBYODWaiting =
      (game.metadata?.gameMode as string) === "byod" && game.phase === "waiting_for_players";
    if (isBYODWaiting) {
      if (storage.storageType !== "cloud") {
        storage.setStorageType("cloud");
      }
      setActiveTab(TAB_CLOUD_BYOD);
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
      await onEnterGame(gameCode, isBYODWaiting ? { storageType: "cloud" } : undefined);
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
      const gameMode = getGameModeForTab(activeTab);
      onNewGame(numPlayers, gameMode);
    }
  };

  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault();

    const code = joinGameCode.trim().toUpperCase();

    if (!code) {
      setJoinError("Please enter a game code.");
      return;
    }

    setJoinError("");
    setIsJoining(true);

    try {
      const result = await storage.joinGame(code);

      if (!result.success) {
        const errorMessage =
          JOIN_ERROR_MESSAGES[result.error ?? ""] ?? "Unable to join game. Please try again.";
        setJoinError(errorMessage);
        setIsJoining(false);
        return;
      }

      if (storage.storageType !== "cloud") {
        storage.setStorageType("cloud");
      }
      setActiveTab(TAB_CLOUD_BYOD);

      if (onEnterGame) {
        await onEnterGame(code, { storageType: "cloud" });
      }

      setJoinGameCode("");
    } catch (error) {
      console.error("[LobbyScreen] Error joining game:", error);
      setJoinError("An unexpected error occurred. Please try again.");
    } finally {
      setIsJoining(false);
    }
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
        <h1 className="lobbyScreen__title">Wood and Steel Lobby</h1>

        <div className="lobbyScreen__tabs">
          <button
            className={`lobbyScreen__tab ${activeTab === TAB_LOCAL ? "lobbyScreen__tab--active" : ""}`}
            onClick={() => handleTabSwitch(TAB_LOCAL)}
            disabled={isLoading}
          >
            Local
          </button>
          <button
            className={`lobbyScreen__tab ${activeTab === TAB_CLOUD_HOTSEAT ? "lobbyScreen__tab--active" : ""}`}
            onClick={() => handleTabSwitch(TAB_CLOUD_HOTSEAT)}
            disabled={isLoading}
          >
            Cloud (Hotseat)
          </button>
          <button
            className={`lobbyScreen__tab ${activeTab === TAB_CLOUD_BYOD ? "lobbyScreen__tab--active" : ""}`}
            onClick={() => handleTabSwitch(TAB_CLOUD_BYOD)}
            disabled={isLoading}
          >
            Cloud (BYOD)
          </button>
          {showLoadingIndicator && (
            <span className="lobbyScreen__loadingIndicator" aria-label="Loading">
              <span className="lobbyScreen__spinner" />
            </span>
          )}
        </div>

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
                {isJoining ? "Joining..." : "Join"}
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
