/**
 * Game Manager - Handles multiple game instances with unique four-letter codes
 * Works with Zustand store state persistence
 * Uses storage adapter pattern to support multiple storage backends (localStorage, Supabase, etc.)
 */

import { getStorageAdapter } from './storage/index';
import type { StorageAdapter, GameListItem } from './storage/storageAdapter';
import { serializeState } from './stateSerialization';
import type { SerializedState } from './stateSerialization';
import { shuffleArray } from './random';
import type { GameState, GameContext } from '../stores/gameStore';

export type StorageType = 'local' | 'cloud';

// Storage keys for current game (separate for local and cloud)
const CURRENT_GAME_LOCAL_KEY = 'current_game_local';
const CURRENT_GAME_CLOUD_KEY = 'current_game_cloud';

/** Metadata stored per game (BYOD fields optional). */
export interface GameMetadata {
  lastModified: string;
  gameMode: 'hotseat' | 'byod';
  hostDeviceId?: string;
  playerSeats?: Record<string, PlayerSeat>;
}

export interface PlayerSeat {
  joinedAt: string;
  playerName: string;
  playerID?: string;
}

/** Result of assignPlayerSeat / updatePlayerName. */
export interface SeatAssignmentResult {
  success: boolean;
  error?: string;
  seat?: PlayerSeat;
}

/** Result of assignRandomPlayerIDs. */
export interface AssignPlayerIDsResult {
  success: boolean;
  error?: string;
  assignments?: Record<string, string>;
}

/** Five-letter code, consonants only (avoids accidental words). */
export function generateGameCode(): string {
  const letters = 'BCDFGHJKLMNPQRSTVWXYZ';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return code;
}

/** Unique code not present in listGameCodes(); throws if unable after max attempts. */
export async function generateUniqueGameCode(): Promise<string> {
  const existingCodes = await listGameCodes();
  let code: string;
  let attempts = 0;
  const maxAttempts = 100; // Prevent infinite loop

  do {
    code = generateGameCode();
    attempts++;
  } while (existingCodes.includes(code) && attempts < maxAttempts);

  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique game code after multiple attempts');
  }

  return code;
}

export function normalizeGameCode(code: string): string {
  return code ? code.toUpperCase().trim() : '';
}

/** Valid format: 4 or 5 letters A–Z (case-insensitive). */
export function isValidGameCode(code: string): boolean {
  if (!code) return false;
  const normalized = normalizeGameCode(code);
  return /^[A-Z]{4,5}$/.test(normalized);
}

function getAdapter(storageType: StorageType | null): StorageAdapter {
  return getStorageAdapter(storageType ?? undefined) as StorageAdapter;
}

export async function switchToGame(
  code: string,
  storageType: StorageType = 'local'
): Promise<boolean> {
  const operation = 'switchToGame';

  if (!isValidGameCode(code)) {
    console.error(`[${operation}] Invalid game code format:`, code);
    return false;
  }

  const normalizedCode = normalizeGameCode(code);

  try {
    const adapter = getAdapter(storageType);
    const exists = await adapter.gameExists(normalizedCode);
    if (!exists) {
      console.warn(`[${operation}] Game not found:`, normalizedCode);
      return false;
    }

    setCurrentGameCode(normalizedCode, storageType);
    return true;
  } catch (e) {
    const err = e as Error;
    console.error(`[${operation}] Unexpected error switching to game "${normalizedCode}":`, err.message);
    console.error(`[${operation}] Error details:`, e);
    return false;
  }
}

export async function deleteGame(
  code: string,
  storageType: StorageType | null = null
): Promise<boolean> {
  const operation = 'deleteGame';

  if (!isValidGameCode(code)) {
    console.error(`[${operation}] Invalid game code format:`, code);
    return false;
  }

  const normalizedCode = normalizeGameCode(code);

  try {
    if (storageType) {
      const adapter = getAdapter(storageType);
      return await adapter.deleteGame(normalizedCode);
    } else {
      // Try both storage types (backward compatibility)
      const localAdapter = getAdapter('local');
      const cloudAdapter = getAdapter('cloud');
      const localResult = await localAdapter.deleteGame(normalizedCode);
      const cloudResult = await cloudAdapter.deleteGame(normalizedCode);
      return localResult || cloudResult;
    }
  } catch (e) {
    const err = e as Error;
    console.error(`[${operation}] Unexpected error deleting game "${normalizedCode}":`, err.message);
    console.error(`[${operation}] Error details:`, e);
    return false;
  }
}

export async function listGameCodes(): Promise<string[]> {
  const games = await listGames();
  return games.map((game) => game.code).sort();
}

export async function gameExists(code: string, storageType: StorageType): Promise<boolean> {
  if (!isValidGameCode(code)) {
    return false;
  }

  const normalizedCode = normalizeGameCode(code);
  const adapter = getAdapter(storageType);
  return await adapter.gameExists(normalizedCode);
}

/** When storageType is null, uses storage_preference from localStorage. */
export function getCurrentGameCode(storageType: StorageType | null = null): string | null {
  if (storageType === 'local') {
    return localStorage.getItem(CURRENT_GAME_LOCAL_KEY);
  }
  if (storageType === 'cloud') {
    return localStorage.getItem(CURRENT_GAME_CLOUD_KEY);
  }

  const storagePreference = localStorage.getItem('storage_preference');
  const currentStorageType: StorageType =
    storagePreference === 'local' || storagePreference === 'cloud' ? storagePreference : 'local';

  const key = currentStorageType === 'cloud' ? CURRENT_GAME_CLOUD_KEY : CURRENT_GAME_LOCAL_KEY;
  return localStorage.getItem(key);
}

export function setCurrentGameCode(code: string, storageType: StorageType | null = null): void {
  const operation = 'setCurrentGameCode';

  if (!isValidGameCode(code)) {
    const error = new Error(`Invalid game code format: ${code}`);
    console.error(`[${operation}]`, error.message);
    throw error;
  }

  const normalizedCode = normalizeGameCode(code);

  let typeToUse: StorageType = storageType ?? 'local';
  if (!typeToUse) {
    const storagePreference = localStorage.getItem('storage_preference');
    typeToUse =
      storagePreference === 'local' || storagePreference === 'cloud' ? storagePreference : 'local';
  }

  const key = typeToUse === 'cloud' ? CURRENT_GAME_CLOUD_KEY : CURRENT_GAME_LOCAL_KEY;

  try {
    localStorage.setItem(key, normalizedCode);
  } catch (e) {
    const err = e as Error;
    const error = new Error(`Failed to set current game code: ${err.message}`);
    console.error(`[${operation}]`, error.message);
    console.error(`[${operation}] Error details:`, e);
    throw error;
  }
}

export function clearCurrentGameCode(storageType: StorageType | null = null): void {
  let typeToUse: StorageType = storageType ?? 'local';
  if (!typeToUse) {
    const storagePreference = localStorage.getItem('storage_preference');
    typeToUse =
      storagePreference === 'local' || storagePreference === 'cloud' ? storagePreference : 'local';
  }

  const key = typeToUse === 'cloud' ? CURRENT_GAME_CLOUD_KEY : CURRENT_GAME_LOCAL_KEY;
  localStorage.removeItem(key);
}

/** Games with codes and basic info; sorted by lastModified descending (most recent first). */
export async function listGames(storageType: StorageType = 'local'): Promise<GameListItem[]> {
  const operation = 'listGames';

  try {
    const adapter = getAdapter(storageType);
    return await adapter.listGames();
  } catch (e) {
    const err = e as Error;
    console.error(`[${operation}] Unexpected error listing games:`, err.message);
    console.error(`[${operation}] Error details:`, e);
    return [];
  }
}

interface CreateNewGameOptions {
  gameMode?: 'hotseat' | 'byod';
  hostDeviceId?: string | null;
  numPlayers?: number;
}

export async function createNewGame(
  storageType: StorageType = 'local',
  options: CreateNewGameOptions = {}
): Promise<string> {
  const operation = 'createNewGame';

  const { gameMode = 'hotseat', hostDeviceId = null, numPlayers = 3 } = options;

  if (gameMode !== 'hotseat' && gameMode !== 'byod') {
    throw new Error(`Invalid gameMode: ${gameMode}. Must be 'hotseat' or 'byod'.`);
  }

  if (gameMode === 'byod' && !hostDeviceId) {
    throw new Error('BYOD games require a hostDeviceId');
  }

  if (gameMode === 'byod' && storageType !== 'cloud') {
    throw new Error('BYOD games require cloud storage');
  }

  try {
    const adapter = getAdapter(storageType);
    const code = await generateUniqueGameCode();
    setCurrentGameCode(code, storageType);

    const metadata: GameMetadata = {
      lastModified: new Date().toISOString(),
      gameMode,
    };

    if (gameMode === 'byod' && hostDeviceId) {
      metadata.hostDeviceId = hostDeviceId;
      metadata.playerSeats = {
        [hostDeviceId]: {
          joinedAt: new Date().toISOString(),
          playerName: 'Host',
        },
      };
    }

    // BYOD: initial phase is waiting_for_players; hotseat: setup
    const initialPhase = gameMode === 'byod' ? 'waiting_for_players' : 'setup';
    const initialState: SerializedState = {
      G: { contracts: [], players: [], independentRailroads: {} },
      ctx: {
        phase: initialPhase,
        currentPlayer: '0',
        numPlayers,
        playOrder: Array.from({ length: numPlayers }, (_, i) => String(i)),
        playOrderPos: 0,
        turn: 0,
      },
    };

    await adapter.saveGame(code, initialState, metadata as unknown as Record<string, unknown>);

    console.info(
      `[${operation}] Created new game with code:`,
      code,
      `(storage: ${storageType}, mode: ${gameMode}, numPlayers: ${numPlayers})`
    );
    return code;
  } catch (e) {
    const err = e as Error;
    console.error(`[${operation}] Failed to create new game:`, err.message);
    console.error(`[${operation}] Error details:`, e);
    throw e;
  }
}

// Cache used for optimistic concurrency: expected lastModified when saving (avoids overwriting newer state).
const lastModifiedCache = new Map<string, string>();

export async function saveGameState(
  code: string,
  G: GameState,
  ctx: GameContext,
  storageType: StorageType | null = null
): Promise<boolean> {
  const operation = 'saveGameState';

  if (!isValidGameCode(code)) {
    console.error(`[${operation}] Invalid game code format:`, code);
    return false;
  }

  const normalizedCode = normalizeGameCode(code);

  try {
    if (!G || typeof G !== 'object') {
      console.error(
        `[${operation}] Invalid G parameter for game "${normalizedCode}": expected object, got ${typeof G}`
      );
      return false;
    }

    if (!ctx || typeof ctx !== 'object') {
      console.error(
        `[${operation}] Invalid ctx parameter for game "${normalizedCode}": expected object, got ${typeof ctx}`
      );
      return false;
    }

    const state: SerializedState = serializeState(
      G as unknown as Record<string, unknown>,
      ctx as unknown as Record<string, unknown>
    );

    // Resolve adapter: use storageType when provided; otherwise which current-game key has this code (BYOD saves must go to cloud)
    let adapterStorageType: StorageType;
    if (storageType === 'local' || storageType === 'cloud') {
      adapterStorageType = storageType;
    } else {
      const localCode = localStorage.getItem(CURRENT_GAME_LOCAL_KEY);
      const cloudCode = localStorage.getItem(CURRENT_GAME_CLOUD_KEY);
      if (cloudCode === normalizedCode) {
        adapterStorageType = 'cloud';
      } else if (localCode === normalizedCode) {
        adapterStorageType = 'local';
      } else {
        adapterStorageType = 'local';
      }
    }

    const adapter = getAdapter(adapterStorageType);
    let existingMetadata: Record<string, unknown> = {};
    try {
      const meta = await adapter.getGameMetadata(normalizedCode);
      existingMetadata = meta ?? {};
    } catch (e) {
      const err = e as Error;
      console.warn(`[${operation}] Could not fetch existing metadata for "${normalizedCode}":`, err.message);
    }

    const metadata: Record<string, unknown> = {
      ...existingMetadata,
      lastModified: new Date().toISOString(),
    } as Record<string, unknown>;

    // Optimistic concurrency: pass expected lastModified when cache is fresh (< 30s)
    let expectedLastModified: string | null = null;
    if (adapter.getLastModified && typeof adapter.getLastModified === 'function') {
      const cachedTimestamp = lastModifiedCache.get(normalizedCode);
      if (cachedTimestamp) {
        const cacheAge = Date.now() - new Date(cachedTimestamp).getTime();
        if (cacheAge < 30000) {
          expectedLastModified = cachedTimestamp;
        }
      }
    }

    const result = await adapter.saveGame(normalizedCode, state, metadata, expectedLastModified);

    let success = false;

    if (typeof result === 'boolean') {
      success = result;
    } else if (result && typeof result === 'object') {
      success = result.success === true;
      if (success && result.lastModified) {
        lastModifiedCache.set(normalizedCode, result.lastModified);
      } else if (success && adapter.getLastModified) {
        const newLastModified = await adapter.getLastModified(normalizedCode);
        if (newLastModified) {
          lastModifiedCache.set(normalizedCode, newLastModified);
        }
      }
    }

    return success;
  } catch (e) {
    const err = e as Error;
    console.error(
      `[${operation}] Unexpected error saving state for game "${normalizedCode}":`,
      err.message
    );
    console.error(`[${operation}] Error details:`, e);
    console.error(`[${operation}] Stack trace:`, (e as Error).stack);
    return false;
  }
}

export function clearLastModifiedCache(code: string): void {
  if (isValidGameCode(code)) {
    const normalizedCode = normalizeGameCode(code);
    lastModifiedCache.delete(normalizedCode);
  }
}

export function updateLastModifiedCache(code: string, lastModified: string): void {
  if (isValidGameCode(code) && lastModified) {
    const normalizedCode = normalizeGameCode(code);
    lastModifiedCache.set(normalizedCode, lastModified);
  }
}

export async function loadGameState(
  code: string,
  storageType: StorageType | null = null
): Promise<{ G: GameState; ctx: GameContext } | null> {
  const operation = 'loadGameState';

  if (!isValidGameCode(code)) {
    console.error(`[${operation}] Invalid game code format:`, code);
    return null;
  }

  const normalizedCode = normalizeGameCode(code);

  try {
    if (storageType) {
      const adapter = getAdapter(storageType);
      const state = await adapter.loadGame(normalizedCode);

      if (state && adapter.getLastModified && typeof adapter.getLastModified === 'function') {
        const lastModified = await adapter.getLastModified(normalizedCode);
        if (lastModified) {
          lastModifiedCache.set(normalizedCode, lastModified);
        }
      }

      return state as { G: GameState; ctx: GameContext } | null;
    } else {
      // No storageType: try cloud first, then local
      const localAdapter = getAdapter('local');
      const cloudAdapter = getAdapter('cloud');

      let state = await cloudAdapter.loadGame(normalizedCode);
      if (state) {
        if (
          cloudAdapter.getLastModified &&
          typeof cloudAdapter.getLastModified === 'function'
        ) {
          const lastModified = await cloudAdapter.getLastModified(normalizedCode);
          if (lastModified) {
            lastModifiedCache.set(normalizedCode, lastModified);
          }
        }
        return state as unknown as { G: GameState; ctx: GameContext };
      }

      state = await localAdapter.loadGame(normalizedCode);
      return state as unknown as { G: GameState; ctx: GameContext } | null;
    }
  } catch (e) {
    const err = e as Error;
    console.error(
      `[${operation}] Unexpected error loading state for game "${normalizedCode}":`,
      err.message
    );
    console.error(`[${operation}] Error details:`, e);
    console.error(`[${operation}] Stack trace:`, (e as Error).stack);
    return null;
  }
}

export const SeatAssignmentError = {
  INVALID_CODE: 'INVALID_CODE',
  GAME_NOT_FOUND: 'GAME_NOT_FOUND',
  WRONG_GAME_MODE: 'WRONG_GAME_MODE',
  GAME_FULL: 'GAME_FULL',
  ALREADY_JOINED: 'ALREADY_JOINED',
  GAME_STARTED: 'GAME_STARTED',
  NOT_JOINED: 'NOT_JOINED',
  NOT_HOST: 'NOT_HOST',
  UPDATE_FAILED: 'UPDATE_FAILED',
} as const;

export async function getGameMetadata(
  code: string,
  storageType: StorageType = 'cloud'
): Promise<Record<string, unknown> | null> {
  const operation = 'getGameMetadata';

  if (!isValidGameCode(code)) {
    console.error(`[${operation}] Invalid game code format:`, code);
    return null;
  }

  const normalizedCode = normalizeGameCode(code);

  try {
    const adapter = getAdapter(storageType);
    return await adapter.getGameMetadata(normalizedCode);
  } catch (e) {
    const err = e as Error;
    console.error(
      `[${operation}] Error getting metadata for game "${normalizedCode}":`,
      err.message
    );
    return null;
  }
}

export async function updateGameMetadata(
  code: string,
  metadata: Record<string, unknown>,
  storageType: StorageType = 'cloud'
): Promise<boolean> {
  const operation = 'updateGameMetadata';

  if (!isValidGameCode(code)) {
    console.error(`[${operation}] Invalid game code format:`, code);
    return false;
  }

  const normalizedCode = normalizeGameCode(code);

  try {
    const adapter = getAdapter(storageType);
    return await adapter.updateGameMetadata(normalizedCode, metadata);
  } catch (e) {
    const err = e as Error;
    console.error(
      `[${operation}] Error updating metadata for game "${normalizedCode}":`,
      err.message
    );
    return false;
  }
}

export async function assignPlayerSeat(
  code: string,
  deviceId: string,
  storageType: StorageType = 'cloud'
): Promise<SeatAssignmentResult> {
  const operation = 'assignPlayerSeat';

  if (!isValidGameCode(code)) {
    console.error(`[${operation}] Invalid game code format:`, code);
    return { success: false, error: SeatAssignmentError.INVALID_CODE };
  }

  if (!deviceId || typeof deviceId !== 'string') {
    console.error(`[${operation}] Invalid deviceId:`, deviceId);
    return { success: false, error: SeatAssignmentError.INVALID_CODE };
  }

  const normalizedCode = normalizeGameCode(code);

  try {
    const adapter = getAdapter(storageType);

    const metadata = (await adapter.getGameMetadata(normalizedCode)) as unknown as GameMetadata | null;

    if (!metadata) {
      console.error(`[${operation}] Game not found:`, normalizedCode);
      return { success: false, error: SeatAssignmentError.GAME_NOT_FOUND };
    }

    if (metadata.gameMode !== 'byod') {
      console.error(
        `[${operation}] Game "${normalizedCode}" is not a BYOD game (mode: ${metadata.gameMode})`
      );
      return { success: false, error: SeatAssignmentError.WRONG_GAME_MODE };
    }

    const playerSeats = metadata.playerSeats ?? {};

    if (playerSeats[deviceId]) {
      // Reconnection: device already has a seat
      console.info(
        `[${operation}] Device ${deviceId} already has a seat in game "${normalizedCode}" (reconnection)`
      );
      return { success: true, seat: playerSeats[deviceId] };
    }

    // Cannot join after playerIDs have been assigned (game started)
    const hasStarted = Object.values(playerSeats).some((seat) => seat.playerID !== undefined);
    if (hasStarted) {
      console.error(
        `[${operation}] Game "${normalizedCode}" has already started (playerIDs assigned)`
      );
      return { success: false, error: SeatAssignmentError.GAME_STARTED };
    }

    const state = await adapter.loadGame(normalizedCode);
    if (!state || !state.ctx) {
      console.error(`[${operation}] Could not load game state for "${normalizedCode}"`);
      return { success: false, error: SeatAssignmentError.GAME_NOT_FOUND };
    }

    const ctx = state.ctx as unknown as GameContext;
    const numPlayers = ctx.numPlayers ?? 3;
    const currentJoined = Object.keys(playerSeats).length;

    if (currentJoined >= numPlayers) {
      console.error(
        `[${operation}] Game "${normalizedCode}" is full (${currentJoined}/${numPlayers})`
      );
      return { success: false, error: SeatAssignmentError.GAME_FULL };
    }

    const guestNumber = currentJoined;
    const defaultGuestName = numPlayers === 2 ? 'Guest' : `Guest ${guestNumber}`;

    const newSeat: PlayerSeat = {
      joinedAt: new Date().toISOString(),
      playerName: defaultGuestName,
    };

    const updatedPlayerSeats: Record<string, PlayerSeat> = {
      ...playerSeats,
      [deviceId]: newSeat,
    };

    const updated = await adapter.updateGameMetadata(normalizedCode, {
      playerSeats: updatedPlayerSeats as Record<string, unknown>,
    });

    if (!updated) {
      console.error(
        `[${operation}] Failed to update metadata for game "${normalizedCode}"`
      );
      return { success: false, error: SeatAssignmentError.UPDATE_FAILED };
    }

    console.info(
      `[${operation}] Successfully assigned seat to device ${deviceId} in game "${normalizedCode}" (${currentJoined + 1}/${numPlayers})`
    );
    return { success: true, seat: newSeat };
  } catch (e) {
    const err = e as Error;
    console.error(
      `[${operation}] Unexpected error assigning seat for game "${normalizedCode}":`,
      err.message
    );
    return { success: false, error: SeatAssignmentError.UPDATE_FAILED };
  }
}

export async function updatePlayerName(
  code: string,
  deviceId: string,
  playerName: string,
  storageType: StorageType = 'cloud'
): Promise<{ success: boolean; error?: string }> {
  const operation = 'updatePlayerName';

  if (!isValidGameCode(code)) {
    return { success: false, error: SeatAssignmentError.INVALID_CODE };
  }

  if (!deviceId || typeof deviceId !== 'string') {
    return { success: false, error: SeatAssignmentError.INVALID_CODE };
  }

  const normalizedCode = normalizeGameCode(code);

  try {
    const adapter = getAdapter(storageType);

    const metadata = (await adapter.getGameMetadata(normalizedCode)) as unknown as GameMetadata | null;

    if (!metadata) {
      return { success: false, error: SeatAssignmentError.GAME_NOT_FOUND };
    }

    const playerSeats = metadata.playerSeats ?? {};

    if (!playerSeats[deviceId]) {
      console.error(
        `[${operation}] Device ${deviceId} does not have a seat in game "${normalizedCode}"`
      );
      return { success: false, error: SeatAssignmentError.NOT_JOINED };
    }

    const updatedPlayerSeats: Record<string, PlayerSeat> = {
      ...playerSeats,
      [deviceId]: {
        ...playerSeats[deviceId],
        playerName: playerName || '',
      },
    };

    const updated = await adapter.updateGameMetadata(normalizedCode, {
      playerSeats: updatedPlayerSeats as Record<string, unknown>,
    });

    if (!updated) {
      return { success: false, error: SeatAssignmentError.UPDATE_FAILED };
    }

    console.info(
      `[${operation}] Updated player name for device ${deviceId} in game "${normalizedCode}" to "${playerName}"`
    );
    return { success: true };
  } catch (e) {
    const err = e as Error;
    console.error(
      `[${operation}] Unexpected error updating player name:`,
      err.message
    );
    return { success: false, error: SeatAssignmentError.UPDATE_FAILED };
  }
}

export async function isHost(
  code: string,
  deviceId: string,
  storageType: StorageType = 'cloud'
): Promise<boolean> {
  const operation = 'isHost';

  if (!isValidGameCode(code) || !deviceId) {
    return false;
  }

  const normalizedCode = normalizeGameCode(code);

  try {
    const adapter = getAdapter(storageType);
    const metadata = (await adapter.getGameMetadata(normalizedCode)) as unknown as GameMetadata | null;

    if (!metadata) {
      return false;
    }

    return metadata.hostDeviceId === deviceId;
  } catch (e) {
    const err = e as Error;
    console.error(`[${operation}] Error checking host status:`, err.message);
    return false;
  }
}

export async function getNumPlayersJoined(
  code: string,
  storageType: StorageType = 'cloud'
): Promise<{ joined: number; total: number } | null> {
  const operation = 'getNumPlayersJoined';

  if (!isValidGameCode(code)) {
    return null;
  }

  const normalizedCode = normalizeGameCode(code);

  try {
    const adapter = getAdapter(storageType);

    const metadata = await adapter.getGameMetadata(normalizedCode);
    if (!metadata) {
      return null;
    }

    const state = await adapter.loadGame(normalizedCode);
    if (!state || !state.ctx) {
      return null;
    }

    const ctx = state.ctx as unknown as GameContext;
    const playerSeats = metadata.playerSeats ?? {};
    const joined = Object.keys(playerSeats).length;
    const total = ctx.numPlayers ?? 3; // joined from metadata, total from state

    return { joined, total };
  } catch (e) {
    const err = e as Error;
    console.error(`[${operation}] Error getting player count:`, err.message);
    return null;
  }
}

export async function allPlayersJoined(
  code: string,
  storageType: StorageType = 'cloud'
): Promise<boolean> {
  const counts = await getNumPlayersJoined(code, storageType);
  if (!counts) {
    return false;
  }
  return counts.joined >= counts.total;
}

/** Call when transitioning from waiting_for_players to setup. Shuffles playerIDs and assigns to joined devices (host only). */
export async function assignRandomPlayerIDs(
  code: string,
  deviceId: string,
  storageType: StorageType = 'cloud'
): Promise<AssignPlayerIDsResult> {
  const operation = 'assignRandomPlayerIDs';

  if (!isValidGameCode(code)) {
    return { success: false, error: SeatAssignmentError.INVALID_CODE };
  }

  if (!deviceId || typeof deviceId !== 'string') {
    return { success: false, error: SeatAssignmentError.INVALID_CODE };
  }

  const normalizedCode = normalizeGameCode(code);

  try {
    const adapter = getAdapter(storageType);

    const metadata = (await adapter.getGameMetadata(normalizedCode)) as unknown as GameMetadata | null;

    if (!metadata) {
      return { success: false, error: SeatAssignmentError.GAME_NOT_FOUND };
    }

    if (metadata.hostDeviceId !== deviceId) {
      console.error(
        `[${operation}] Device ${deviceId} is not the host of game "${normalizedCode}"`
      );
      return { success: false, error: SeatAssignmentError.NOT_HOST };
    }

    if (metadata.gameMode !== 'byod') {
      return { success: false, error: SeatAssignmentError.WRONG_GAME_MODE };
    }

    const playerSeats = metadata.playerSeats ?? {};
    const deviceIds = Object.keys(playerSeats);

    const state = await adapter.loadGame(normalizedCode);
    if (!state || !state.ctx) {
      return { success: false, error: SeatAssignmentError.GAME_NOT_FOUND };
    }

    const ctx = state.ctx as unknown as GameContext;
    const numPlayers = ctx.numPlayers ?? 3;

    if (deviceIds.length < numPlayers) {
      console.error(
        `[${operation}] Not all players have joined game "${normalizedCode}" (${deviceIds.length}/${numPlayers})`
      );
      return { success: false, error: SeatAssignmentError.GAME_FULL };
    }

    const alreadyAssigned = Object.values(playerSeats).some((seat) => seat.playerID !== undefined);
    if (alreadyAssigned) {
      console.error(
        `[${operation}] PlayerIDs already assigned for game "${normalizedCode}"`
      );
      return { success: false, error: SeatAssignmentError.GAME_STARTED };
    }

    // Shuffle playerIDs then assign to devices in existing join order
    const playerIDs = Array.from({ length: numPlayers }, (_, i) => String(i));
    shuffleArray(playerIDs);

    const updatedPlayerSeats: Record<string, PlayerSeat> = {};
    const assignments: Record<string, string> = {};

    deviceIds.forEach((did, index) => {
      const playerID = playerIDs[index];
      updatedPlayerSeats[did] = {
        ...playerSeats[did],
        playerID,
      };
      assignments[did] = playerID;
    });

    const updated = await adapter.updateGameMetadata(normalizedCode, {
      playerSeats: updatedPlayerSeats as Record<string, unknown>,
    });

    if (!updated) {
      return { success: false, error: SeatAssignmentError.UPDATE_FAILED };
    }

    console.info(`[${operation}] Assigned random playerIDs for game "${normalizedCode}":`, assignments);
    return { success: true, assignments };
  } catch (e) {
    const err = e as Error;
    console.error(
      `[${operation}] Unexpected error assigning playerIDs:`,
      err.message
    );
    return { success: false, error: SeatAssignmentError.UPDATE_FAILED };
  }
}

/** PlayerID for device in BYOD game; null if device not joined or playerIDs not yet assigned. */
export async function getDevicePlayerID(
  code: string,
  deviceId: string,
  storageType: StorageType = 'cloud'
): Promise<string | null> {
  const operation = 'getDevicePlayerID';

  if (!isValidGameCode(code) || !deviceId) {
    return null;
  }

  const normalizedCode = normalizeGameCode(code);

  try {
    const adapter = getAdapter(storageType);
    const metadata = (await adapter.getGameMetadata(normalizedCode)) as unknown as GameMetadata | null;

    if (!metadata?.playerSeats) {
      return null;
    }

    const seat = metadata.playerSeats[deviceId];
    if (!seat) {
      return null;
    }

    return seat.playerID ?? null;
  } catch (e) {
    const err = e as Error;
    console.error(`[${operation}] Error getting playerID:`, err.message);
    return null;
  }
}

export async function getDeviceSeat(
  code: string,
  deviceId: string,
  storageType: StorageType = 'cloud'
): Promise<PlayerSeat | null> {
  const operation = 'getDeviceSeat';

  if (!isValidGameCode(code) || !deviceId) {
    return null;
  }

  const normalizedCode = normalizeGameCode(code);

  try {
    const adapter = getAdapter(storageType);
    const metadata = (await adapter.getGameMetadata(normalizedCode)) as unknown as GameMetadata | null;

    if (!metadata?.playerSeats) {
      return null;
    }

    return metadata.playerSeats[deviceId] ?? null;
  } catch (e) {
    const err = e as Error;
    console.error(`[${operation}] Error getting device seat:`, err.message);
    return null;
  }
}

export async function getPlayerSeats(
  code: string,
  storageType: StorageType = 'cloud'
): Promise<Record<string, PlayerSeat> | null> {
  const operation = 'getPlayerSeats';

  if (!isValidGameCode(code)) {
    return null;
  }

  const normalizedCode = normalizeGameCode(code);

  try {
    const adapter = getAdapter(storageType);
    const metadata = (await adapter.getGameMetadata(normalizedCode)) as unknown as GameMetadata | null;

    if (!metadata) {
      return null;
    }

    return metadata.playerSeats ?? {};
  } catch (e) {
    const err = e as Error;
    console.error(`[${operation}] Error getting player seats:`, err.message);
    return null;
  }
}
