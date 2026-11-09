/**
 * StorageProvider: current game tracking, device ID, and the BYOD seat/assignment API.
 * Games are stored in Supabase; seats live in each game's cloud metadata.
 */
import React from 'react';
import type { ReactNode } from 'react';
const { createContext, useContext, useCallback, useMemo } = React;
import { getStorageAdapter } from '../utils/storage';
import type { StorageAdapter } from '../utils/storage/storageAdapter';
import {
  getCurrentGameCode,
  setCurrentGameCode,
  clearCurrentGameCode,
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
  addBotSeat as addBotSeatInManager,
  removeBotSeat as removeBotSeatInManager,
  SeatAssignmentError,
} from '../utils/gameManager';
import type { BotSeatInfo } from '../utils/gameManager';

export interface StorageContextValue {
  getStorageAdapter: () => StorageAdapter;
  getCurrentGameCode: () => string | null;
  setCurrentGameCode: (code: string) => void;
  clearCurrentGameCode: () => void;
  getDeviceId: () => string;
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
  /** Host only, waiting phase: seat a bot (playtest-only, docs/BOT_PLAN.md). */
  addBotSeat: (
    gameCode: string,
    bot: BotSeatInfo
  ) => Promise<{ success: boolean; error?: string; seatKey?: string }>;
  /** Host only, waiting phase: remove a bot seat. */
  removeBotSeat: (gameCode: string, seatKey: string) => Promise<{ success: boolean; error?: string }>;
  SeatAssignmentError: typeof SeatAssignmentError;
}

const StorageContext = createContext<StorageContextValue | null>(null);

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
  // PlayerID for this device: null until the host starts the game (or if not joined).
  const getMyPlayerID = useCallback<(gameCode: string) => Promise<string | null>>(
    async (gameCode: string) => getDevicePlayerID(gameCode, getDeviceId()),
    []
  );

  const joinGame = useCallback<(gameCode: string) => Promise<{ success: boolean; error?: string; seat?: unknown }>>(
    async (gameCode: string) => assignPlayerSeatInManager(gameCode, getDeviceId()),
    []
  );

  const updateMyPlayerName = useCallback<(gameCode: string, playerName: string) => Promise<{ success: boolean; error?: string }>>(
    async (gameCode: string, playerName: string) =>
      updatePlayerNameInManager(gameCode, getDeviceId(), playerName),
    []
  );

  const getPlayerSeatsForGame = useCallback<(gameCode: string) => Promise<Record<string, unknown> | null>>(
    async (gameCode: string) => getPlayerSeatsFromManager(gameCode),
    []
  );

  const getMySeat = useCallback<(gameCode: string) => Promise<unknown>>(
    async (gameCode: string) => getDeviceSeat(gameCode, getDeviceId()),
    []
  );

  const amIHost = useCallback<(gameCode: string) => Promise<boolean>>(
    async (gameCode: string) => isHostInManager(gameCode, getDeviceId()),
    []
  );

  const getPlayerCounts = useCallback<(gameCode: string) => Promise<{ joined: number; total: number } | null>>(
    async (gameCode: string) => getNumPlayersJoinedFromManager(gameCode),
    []
  );

  const areAllPlayersJoined = useCallback<(gameCode: string) => Promise<boolean>>(
    async (gameCode: string) => allPlayersJoinedFromManager(gameCode),
    []
  );

  const startBYODGame = useCallback<(gameCode: string) => Promise<{ success: boolean; error?: string; assignments?: Record<string, string> }>>(
    async (gameCode: string) => assignRandomPlayerIDsInManager(gameCode, getDeviceId()),
    []
  );

  const getMetadata = useCallback<(gameCode: string) => Promise<Record<string, unknown> | null>>(
    async (gameCode: string) => getGameMetadataFromManager(gameCode),
    []
  );

  const addBotSeat = useCallback<StorageContextValue['addBotSeat']>(
    async (gameCode: string, bot: BotSeatInfo) => addBotSeatInManager(gameCode, getDeviceId(), bot),
    []
  );

  const removeBotSeat = useCallback<StorageContextValue['removeBotSeat']>(
    async (gameCode: string, seatKey: string) => removeBotSeatInManager(gameCode, getDeviceId(), seatKey),
    []
  );

  const value = useMemo<StorageContextValue>(
    () => ({
      getStorageAdapter,
      getCurrentGameCode,
      setCurrentGameCode,
      clearCurrentGameCode,
      getDeviceId,
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
      addBotSeat,
      removeBotSeat,
      SeatAssignmentError,
    }),
    [
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
      addBotSeat,
      removeBotSeat,
    ]
  );

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
