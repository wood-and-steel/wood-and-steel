/**
 * StorageProvider: storage type (Local vs Cloud), current game tracking, device ID,
 * and BYOD seat/assignment API. Storage types: 'local' (localStorage), 'cloud' (Supabase).
 */
import React from 'react';
import type { ReactNode } from 'react';
const { createContext, useContext, useState, useCallback, useMemo } = React;
import { getStorageAdapter } from '../utils/storage';
import { isSupabaseConfigured } from '../config/storage';
import type { StorageAdapter } from '../utils/storage/storageAdapter';
import type { StorageType } from '../utils/gameManager';
import {
  isValidGameCode,
  normalizeGameCode,
  getDevicePlayerID,
  getDeviceSeat,
  getPlayerSeats as getPlayerSeatsFromManager,
  assignPlayerSeat as assignPlayerSeatInManager,
  updatePlayerName as updatePlayerNameInManager,
  assignRandomPlayerIDs as assignRandomPlayerIDsInManager,
  isHost as isHostInManager,
  getNumPlayersJoined as getNumPlayersJoinedFromManager,
  allPlayersJoined as allPlayersJoinedFromManager,
  getGameMetadata as getGameMetadataFromManager,
  SeatAssignmentError,
} from '../utils/gameManager';

export interface StorageContextValue {
  storageType: StorageType;
  setStorageType: (type: StorageType) => void;
  getStorageAdapter: () => StorageAdapter;
  getCurrentGameCode: () => string | null;
  setCurrentGameCode: (code: string) => void;
  clearCurrentGameCode: () => void;
  getCurrentGameCodeForType: (type: StorageType) => string | null;
  setCurrentGameCodeForType: (type: StorageType, code: string) => void;
  getDeviceId: () => string;
  getPlayerSeat: (gameCode: string) => string | null;
  setPlayerSeat: (gameCode: string, playerID: string) => void;
  clearPlayerSeat: (gameCode: string) => void;
  getGameMode: (gameCode: string) => Promise<'hotseat' | 'byod'>;
  isBYODGame: (gameCode: string) => Promise<boolean>;
  getMyPlayerID: (gameCode: string) => Promise<string | null>;
  joinGame: (gameCode: string) => Promise<{ success: boolean; error?: string; seat?: unknown }>;
  updateMyPlayerName: (
    gameCode: string,
    playerName: string
  ) => Promise<{ success: boolean; error?: string }>;
  getPlayerSeatsForGame: (gameCode: string) => Promise<Record<string, unknown> | null>;
  getMySeat: (gameCode: string) => Promise<unknown>;
  amIHost: (gameCode: string) => Promise<boolean>;
  getPlayerCounts: (gameCode: string) => Promise<{ joined: number; total: number } | null>;
  areAllPlayersJoined: (gameCode: string) => Promise<boolean>;
  startBYODGame: (gameCode: string) => Promise<{
    success: boolean;
    error?: string;
    assignments?: Record<string, string>;
  }>;
  getMetadata: (gameCode: string) => Promise<Record<string, unknown> | null>;
  SeatAssignmentError: typeof SeatAssignmentError;
}

const StorageContext = createContext<StorageContextValue | null>(null);

// localStorage keys
const STORAGE_PREFERENCE_KEY = 'storage_preference';
const CURRENT_GAME_LOCAL_KEY = 'current_game_local';
const CURRENT_GAME_CLOUD_KEY = 'current_game_cloud';
const DEVICE_ID_KEY = 'device_id';

/** UUID v4. Uses crypto.randomUUID() when available; fallback for older browsers. */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Manual UUID v4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (y is 8|9|a|b)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Device ID for this browser; persisted across sessions, used to identify this device in BYOD games. */
function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);

  if (!deviceId) {
    deviceId = generateUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    console.log('[StorageProvider] Generated new device ID:', deviceId);
  }

  return deviceId;
}

export function StorageProvider({ children }: { children: ReactNode }): JSX.Element {
  // Initialize storage type from localStorage, default to 'local'
  const [storageType, setStorageTypeState] = useState<StorageType>(() => {
    const saved = localStorage.getItem(STORAGE_PREFERENCE_KEY);
    return saved === 'local' || saved === 'cloud' ? saved : 'local';
  });

  // Cached adapter per type. Never create new Supabase clients on tab switch—multiple
  // GoTrueClient instances cause Supabase warnings; getStorageAdapter(type) is a singleton per type.
  const adapter = useMemo((): StorageAdapter => {
    const type =
      storageType === 'cloud' && !isSupabaseConfigured() ? 'local' : storageType;
    if (type === 'local' && storageType === 'cloud') {
      console.warn('[StorageProvider] Supabase not configured, falling back to localStorage');
    }
    return getStorageAdapter(type) as StorageAdapter;
  }, [storageType]);

  const setStorageType = useCallback<(type: StorageType) => void>((type: StorageType) => {
    if (type !== 'local' && type !== 'cloud') {
      console.error('[StorageProvider] Invalid storage type:', type);
      return;
    }
    if (type === 'cloud' && !isSupabaseConfigured()) {
      console.warn('[StorageProvider] Cannot switch to cloud: Supabase not configured');
      return;
    }
    setStorageTypeState(type);
    localStorage.setItem(STORAGE_PREFERENCE_KEY, type);
  }, []);

  // Current game code for active storage type
  const getCurrentGameCode = useCallback(() => {
    const key = storageType === 'local' ? CURRENT_GAME_LOCAL_KEY : CURRENT_GAME_CLOUD_KEY;
    return localStorage.getItem(key);
  }, [storageType]);

  const setCurrentGameCode = useCallback<(code: string) => void>(
    (code: string) => {
      if (!isValidGameCode(code)) {
        throw new Error(`Invalid game code format: ${code}`);
      }
      const normalizedCode = normalizeGameCode(code);
      const key = storageType === 'local' ? CURRENT_GAME_LOCAL_KEY : CURRENT_GAME_CLOUD_KEY;
      localStorage.setItem(key, normalizedCode);
    },
    [storageType]
  );

  // Clear current game code for active storage type
  const clearCurrentGameCode = useCallback(() => {
    const key = storageType === 'local' ? CURRENT_GAME_LOCAL_KEY : CURRENT_GAME_CLOUD_KEY;
    localStorage.removeItem(key);
  }, [storageType]);

  // Current game code for a specific storage type (for cross-storage operations, e.g. entering a cloud game from lobby)
  const getCurrentGameCodeForType = useCallback<(type: StorageType) => string | null>((type: StorageType) => {
    const key = type === 'local' ? CURRENT_GAME_LOCAL_KEY : CURRENT_GAME_CLOUD_KEY;
    return localStorage.getItem(key);
  }, []);

  const setCurrentGameCodeForType = useCallback<(type: StorageType, code: string) => void>((type: StorageType, code: string) => {
    if (!isValidGameCode(code)) {
      throw new Error(`Invalid game code format: ${code}`);
    }
    const normalizedCode = normalizeGameCode(code);
    const key = type === 'local' ? CURRENT_GAME_LOCAL_KEY : CURRENT_GAME_CLOUD_KEY;
    localStorage.setItem(key, normalizedCode);
  }, []);

  // Player seat (playerID) per game in localStorage; key byod_player_seat_<code>
  const getPlayerSeat = useCallback<(gameCode: string) => string | null>((gameCode: string) => {
    if (!isValidGameCode(gameCode)) {
      return null;
    }
    const normalizedCode = normalizeGameCode(gameCode);
    const key = `byod_player_seat_${normalizedCode}`;
    return localStorage.getItem(key);
  }, []);

  const setPlayerSeat = useCallback<(gameCode: string, playerID: string) => void>((gameCode: string, playerID: string) => {
    if (!isValidGameCode(gameCode)) {
      throw new Error(`Invalid game code format: ${gameCode}`);
    }
    if (typeof playerID !== 'string' || !/^\d+$/.test(playerID)) {
      throw new Error(`Invalid playerID format: ${playerID}`);
    }
    const normalizedCode = normalizeGameCode(gameCode);
    const key = `byod_player_seat_${normalizedCode}`;
    localStorage.setItem(key, playerID);
  }, []);

  const clearPlayerSeat = useCallback<(gameCode: string) => void>((gameCode: string) => {
    if (!isValidGameCode(gameCode)) {
      return;
    }
    const normalizedCode = normalizeGameCode(gameCode);
    const key = `byod_player_seat_${normalizedCode}`;
    localStorage.removeItem(key);
  }, []);

  // Game mode from adapter listGames() metadata; defaults to 'hotseat' when missing (backward compatibility).
  const getGameMode = useCallback<(gameCode: string) => Promise<'hotseat' | 'byod'>>(
    async (gameCode: string) => {
      if (!isValidGameCode(gameCode)) {
        return 'hotseat';
      }

      try {
        const games = await adapter.listGames();
        const normalizedCode = normalizeGameCode(gameCode);
        const game = games.find((g: { code: string; metadata?: Record<string, unknown> }) => g.code === normalizedCode);

        if (game?.metadata?.gameMode) {
          return game.metadata.gameMode as 'hotseat' | 'byod';
        }

        return 'hotseat';
      } catch (e) {
        const err = e as Error;
        console.error('[StorageProvider] Error getting game mode:', err.message);
        return 'hotseat';
      }
    },
    [adapter]
  );

  const isBYODGame = useCallback<(gameCode: string) => Promise<boolean>>(
    async (gameCode: string) => {
      const mode = await getGameMode(gameCode);
      return mode === 'byod';
    },
    [getGameMode]
  );

  // For BYOD: playerID from game metadata (gameManager). For hotseat: null (all players on same device).
  const getMyPlayerID = useCallback<(gameCode: string) => Promise<string | null>>(
    async (gameCode: string) => {
      const isBYOD = await isBYODGame(gameCode);
      if (isBYOD) {
        const deviceId = getDeviceId();
        return await getDevicePlayerID(gameCode, deviceId, storageType);
      }
      return null;
    },
    [isBYODGame, storageType]
  );

  // Seat assignment API: delegates to gameManager; state stored in cloud metadata (not localStorage).
  const joinGame = useCallback<(gameCode: string) => Promise<{ success: boolean; error?: string; seat?: unknown }>>(async (gameCode: string) => {
    const deviceId = getDeviceId();
    return await assignPlayerSeatInManager(gameCode, deviceId, 'cloud');
  }, []);

  const updateMyPlayerName = useCallback<(gameCode: string, playerName: string) => Promise<{ success: boolean; error?: string }>>(
    async (gameCode: string, playerName: string) => {
      const deviceId = getDeviceId();
      return await updatePlayerNameInManager(gameCode, deviceId, playerName, 'cloud');
    },
    []
  );

  const getPlayerSeatsForGame = useCallback<(gameCode: string) => Promise<Record<string, unknown> | null>>(async (gameCode: string) => {
    return await getPlayerSeatsFromManager(gameCode, 'cloud');
  }, []);

  const getMySeat = useCallback<(gameCode: string) => Promise<unknown>>(async (gameCode: string) => {
    const deviceId = getDeviceId();
    return await getDeviceSeat(gameCode, deviceId, 'cloud');
  }, []);

  const amIHost = useCallback<(gameCode: string) => Promise<boolean>>(async (gameCode: string) => {
    const deviceId = getDeviceId();
    return await isHostInManager(gameCode, deviceId, 'cloud');
  }, []);

  const getPlayerCounts = useCallback<(gameCode: string) => Promise<{ joined: number; total: number } | null>>(async (gameCode: string) => {
    return await getNumPlayersJoinedFromManager(gameCode, 'cloud');
  }, []);

  const areAllPlayersJoined = useCallback<(gameCode: string) => Promise<boolean>>(async (gameCode: string) => {
    return await allPlayersJoinedFromManager(gameCode, 'cloud');
  }, []);

  const startBYODGame = useCallback<(gameCode: string) => Promise<{ success: boolean; error?: string; assignments?: Record<string, string> }>>(async (gameCode: string) => {
    const deviceId = getDeviceId();
    return await assignRandomPlayerIDsInManager(gameCode, deviceId, 'cloud');
  }, []);

  // Game metadata (e.g. playerSeats, gameMode) via gameManager; uses current storageType.
  const getMetadata = useCallback<(gameCode: string) => Promise<Record<string, unknown> | null>>(
    async (gameCode: string) => {
      return await getGameMetadataFromManager(gameCode, storageType);
    },
    [storageType]
  );

  const value = useMemo(
    () => ({
      storageType,
      setStorageType,
      getStorageAdapter: () => adapter,
      getCurrentGameCode,
      setCurrentGameCode,
      clearCurrentGameCode,
      getCurrentGameCodeForType,
      setCurrentGameCodeForType,
      getDeviceId,
      getPlayerSeat,
      setPlayerSeat,
      clearPlayerSeat,
      getGameMode,
      isBYODGame,
      getMyPlayerID,
      joinGame,
      updateMyPlayerName,
      getPlayerSeatsForGame,
      getMySeat,
      amIHost,
      getPlayerCounts,
      areAllPlayersJoined,
      startBYODGame,
      getMetadata,
      SeatAssignmentError,
    }),
    [
      storageType,
      setStorageType,
      adapter,
      getCurrentGameCode,
      setCurrentGameCode,
      clearCurrentGameCode,
      getCurrentGameCodeForType,
      setCurrentGameCodeForType,
      getPlayerSeat,
      setPlayerSeat,
      clearPlayerSeat,
      getGameMode,
      isBYODGame,
      getMyPlayerID,
      joinGame,
      updateMyPlayerName,
      getPlayerSeatsForGame,
      getMySeat,
      amIHost,
      getPlayerCounts,
      areAllPlayersJoined,
      startBYODGame,
      getMetadata,
    ]
  ) as StorageContextValue;

  return (
    <StorageContext.Provider value={value}>
      {children}
    </StorageContext.Provider>
  );
}

/** Hook to access StorageProvider context; throws if used outside StorageProvider. */
export function useStorage(): StorageContextValue {
  const context = useContext(StorageContext);
  if (!context) {
    throw new Error('useStorage must be used within StorageProvider');
  }
  return context;
}
