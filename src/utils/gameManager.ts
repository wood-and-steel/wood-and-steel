/**
 * Game Manager - Handles multiple game instances with unique four-letter codes
 * Works with Zustand store state persistence
 * Games are stored in Supabase via the storage adapter (see ./storage).
 */

import { getStorageAdapter } from './storage/index';
import type { StorageAdapter, GameListItem } from './storage/storageAdapter';
import { serializeState } from './stateSerialization';
import type { SerializedState } from './stateSerialization';
import { shuffleArray } from './random';
import type { GameState, GameContext } from '../stores/gameStore';

/** localStorage key for this device's current game code. */
const CURRENT_GAME_KEY = 'current_game_cloud';

/**
 * Metadata stored per game. `gameMode` is always 'byod' for games this app creates;
 * rows created by older app versions may have another value and are rejected.
 */
export interface GameMetadata {
  lastModified: string;
  gameMode: string;
  hostDeviceId?: string;
  playerSeats?: Record<string, PlayerSeat>;
}

export interface PlayerSeat {
  joinedAt: string;
  playerName: string;
  playerID?: string;
  /** Present only on bot seats (playtest-only, docs/BOT_PLAN.md). Bot seats are keyed by BOT_SEAT_PREFIX, not a device ID. */
  bot?: BotSeatInfo;
}

/** A bot's base name ("Avery", shown as "Avery (bot)") and strategy ID. */
export interface BotSeatInfo {
  name: string;
  strategy: string;
}

/** Seat-key prefix for bot seats. Bots have no device, so their seats use `bot:<uuid>` keys. */
export const BOT_SEAT_PREFIX = 'bot:';

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

function getAdapter(): StorageAdapter {
  return getStorageAdapter();
}

/** True for games created by this app (BYOD). Rows from older app versions return false. */
export function isSupportedGameMetadata(metadata: Record<string, unknown> | null | undefined): boolean {
  return metadata?.gameMode === 'byod';
}

export async function switchToGame(
  code: string
): Promise<boolean> {
  const operation = 'switchToGame';

  if (!isValidGameCode(code)) {
    console.error(`[${operation}] Invalid game code format:`, code);
    return false;
  }

  const normalizedCode = normalizeGameCode(code);

  try {
    const adapter = getAdapter();
    const exists = await adapter.gameExists(normalizedCode);
    if (!exists) {
      console.warn(`[${operation}] Game not found:`, normalizedCode);
      return false;
    }

    setCurrentGameCode(normalizedCode);
    return true;
  } catch (e) {
    const err = e as Error;
    console.error(`[${operation}] Unexpected error switching to game "${normalizedCode}":`, err.message);
    console.error(`[${operation}] Error details:`, e);
    return false;
  }
}

export async function deleteGame(
  code: string
): Promise<boolean> {
  const operation = 'deleteGame';

  if (!isValidGameCode(code)) {
    console.error(`[${operation}] Invalid game code format:`, code);
    return false;
  }

  const normalizedCode = normalizeGameCode(code);

  try {
    return await getAdapter().deleteGame(normalizedCode);
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

export async function gameExists(code: string): Promise<boolean> {
  if (!isValidGameCode(code)) {
    return false;
  }

  const normalizedCode = normalizeGameCode(code);
  const adapter = getAdapter();
  return await adapter.gameExists(normalizedCode);
}

export function getCurrentGameCode(): string | null {
  return localStorage.getItem(CURRENT_GAME_KEY);
}

export function setCurrentGameCode(code: string): void {
  const operation = 'setCurrentGameCode';

  if (!isValidGameCode(code)) {
    const error = new Error(`Invalid game code format: ${code}`);
    console.error(`[${operation}]`, error.message);
    throw error;
  }

  try {
    localStorage.setItem(CURRENT_GAME_KEY, normalizeGameCode(code));
  } catch (e) {
    const err = e as Error;
    const error = new Error(`Failed to set current game code: ${err.message}`);
    console.error(`[${operation}]`, error.message);
    console.error(`[${operation}] Error details:`, e);
    throw error;
  }
}

export function clearCurrentGameCode(): void {
  localStorage.removeItem(CURRENT_GAME_KEY);
}

/** Games with codes and basic info; sorted by lastModified descending (most recent first). */
export async function listGames(): Promise<GameListItem[]> {
  const operation = 'listGames';

  try {
    const adapter = getAdapter();
    return await adapter.listGames();
  } catch (e) {
    const err = e as Error;
    console.error(`[${operation}] Unexpected error listing games:`, err.message);
    console.error(`[${operation}] Error details:`, e);
    // Re-throw so callers (e.g. lobby) can surface cloud outages such as a paused Supabase project.
    throw e;
  }
}

export interface CreateNewGameOptions {
  hostDeviceId: string;
  numPlayers?: number;
  hostPlayerName?: string;
}

/** Create a new game hosted by `hostDeviceId`. It starts in waiting_for_players. */
export async function createNewGame(options: CreateNewGameOptions): Promise<string> {
  const operation = 'createNewGame';

  const { hostDeviceId, numPlayers = 3, hostPlayerName } = options;

  if (!hostDeviceId) {
    throw new Error('New games require a hostDeviceId');
  }

  try {
    const adapter = getAdapter();
    const code = await generateUniqueGameCode();
    setCurrentGameCode(code);

    const initialHostName =
      hostPlayerName && hostPlayerName.trim() ? hostPlayerName.trim() : 'Host';
    const metadata: GameMetadata = {
      lastModified: new Date().toISOString(),
      gameMode: 'byod',
      hostDeviceId,
      playerSeats: {
        [hostDeviceId]: {
          joinedAt: new Date().toISOString(),
          playerName: initialHostName,
        },
      },
    };

    const initialState: SerializedState = {
      G: { contracts: [], players: [], independentRailroads: {} },
      ctx: {
        phase: 'waiting_for_players',
        currentPlayer: '0',
        numPlayers,
        playOrder: Array.from({ length: numPlayers }, (_, i) => String(i)),
        playOrderPos: 0,
        turn: 0,
      },
    };

    const saveResult = await adapter.saveGame(code, initialState, metadata as unknown as Record<string, unknown>);
    const saveOk = saveResult === true || (typeof saveResult === 'object' && saveResult !== null && (saveResult as { success?: boolean }).success === true);
    if (!saveOk) {
      throw new Error('Failed to save new game to storage. Please check your connection and try again.');
    }

    console.info(
      `[${operation}] Created new game with code:`,
      code,
      `(numPlayers: ${numPlayers})`
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
  ctx: GameContext
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

    const adapter = getAdapter();
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
  code: string
): Promise<{ G: GameState; ctx: GameContext } | null> {
  const operation = 'loadGameState';

  if (!isValidGameCode(code)) {
    console.error(`[${operation}] Invalid game code format:`, code);
    return null;
  }

  const normalizedCode = normalizeGameCode(code);

  try {
    const adapter = getAdapter();
    const state = await adapter.loadGame(normalizedCode);

    if (state && adapter.getLastModified && typeof adapter.getLastModified === 'function') {
      const lastModified = await adapter.getLastModified(normalizedCode);
      if (lastModified) {
        lastModifiedCache.set(normalizedCode, lastModified);
      }
    }

    return state as { G: GameState; ctx: GameContext } | null;
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
  NOT_A_BOT: 'NOT_A_BOT',
  INVALID_BOT: 'INVALID_BOT',
  UPDATE_FAILED: 'UPDATE_FAILED',
} as const;

export async function getGameMetadata(
  code: string
): Promise<Record<string, unknown> | null> {
  const operation = 'getGameMetadata';

  if (!isValidGameCode(code)) {
    console.error(`[${operation}] Invalid game code format:`, code);
    return null;
  }

  const normalizedCode = normalizeGameCode(code);

  try {
    const adapter = getAdapter();
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
  metadata: Record<string, unknown>
): Promise<boolean> {
  const operation = 'updateGameMetadata';

  if (!isValidGameCode(code)) {
    console.error(`[${operation}] Invalid game code format:`, code);
    return false;
  }

  const normalizedCode = normalizeGameCode(code);

  try {
    const adapter = getAdapter();
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
  deviceId: string
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
    const adapter = getAdapter();

    const metadata = (await adapter.getGameMetadata(normalizedCode)) as unknown as GameMetadata | null;

    if (!metadata) {
      console.error(`[${operation}] Game not found:`, normalizedCode);
      return { success: false, error: SeatAssignmentError.GAME_NOT_FOUND };
    }

    if (!isSupportedGameMetadata(metadata as unknown as Record<string, unknown>)) {
      console.error(
        `[${operation}] Game "${normalizedCode}" uses an unsupported mode (${metadata.gameMode})`
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
  playerName: string
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
    const adapter = getAdapter();

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

/** True for a bot seat (see addBotSeat). */
export function isBotSeat(seat: PlayerSeat | null | undefined): boolean {
  return seat?.bot != null;
}

/** Display name for a bot seat: "Avery (bot)". */
export function botSeatName(name: string): string {
  return `${name} (bot)`;
}

function newBotSeatKey(): string {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${BOT_SEAT_PREFIX}${id}`;
}

/** Shared host-and-waiting checks for bot seat changes. Returns the metadata and numPlayers, or an error. */
async function loadForBotSeatChange(
  normalizedCode: string,
  hostDeviceId: string
): Promise<
  | { ok: true; metadata: GameMetadata; playerSeats: Record<string, PlayerSeat>; numPlayers: number }
  | { ok: false; error: string }
> {
  const adapter = getAdapter();
  const metadata = (await adapter.getGameMetadata(normalizedCode)) as unknown as GameMetadata | null;
  if (!metadata) return { ok: false, error: SeatAssignmentError.GAME_NOT_FOUND };
  if (!isSupportedGameMetadata(metadata as unknown as Record<string, unknown>)) {
    return { ok: false, error: SeatAssignmentError.WRONG_GAME_MODE };
  }
  if (metadata.hostDeviceId !== hostDeviceId) return { ok: false, error: SeatAssignmentError.NOT_HOST };

  const playerSeats = metadata.playerSeats ?? {};
  if (Object.values(playerSeats).some((seat) => seat.playerID !== undefined)) {
    return { ok: false, error: SeatAssignmentError.GAME_STARTED };
  }

  const state = await adapter.loadGame(normalizedCode);
  if (!state || !state.ctx) return { ok: false, error: SeatAssignmentError.GAME_NOT_FOUND };
  const ctx = state.ctx as unknown as GameContext;
  if (ctx.phase !== 'waiting_for_players') return { ok: false, error: SeatAssignmentError.GAME_STARTED };

  return { ok: true, metadata, playerSeats, numPlayers: ctx.numPlayers ?? 3 };
}

/**
 * Host only, before the game starts: fill an open seat with a bot (playtest-only, docs/BOT_PLAN.md).
 * The caller chooses the bot's name and strategy; the seat is named "Name (bot)".
 */
export async function addBotSeat(
  code: string,
  hostDeviceId: string,
  bot: BotSeatInfo
): Promise<SeatAssignmentResult & { seatKey?: string }> {
  const operation = 'addBotSeat';

  if (!isValidGameCode(code) || !hostDeviceId) {
    return { success: false, error: SeatAssignmentError.INVALID_CODE };
  }
  const name = bot?.name?.trim();
  const strategy = bot?.strategy?.trim();
  if (!name || !strategy) {
    return { success: false, error: SeatAssignmentError.INVALID_BOT };
  }

  const normalizedCode = normalizeGameCode(code);

  try {
    const loaded = await loadForBotSeatChange(normalizedCode, hostDeviceId);
    if (!loaded.ok) {
      console.error(`[${operation}] Cannot add bot to game "${normalizedCode}": ${loaded.error}`);
      return { success: false, error: loaded.error };
    }

    const { playerSeats, numPlayers } = loaded;
    if (Object.keys(playerSeats).length >= numPlayers) {
      return { success: false, error: SeatAssignmentError.GAME_FULL };
    }

    const seatKey = newBotSeatKey();
    const seat: PlayerSeat = {
      joinedAt: new Date().toISOString(),
      playerName: botSeatName(name),
      bot: { name, strategy },
    };

    const updated = await getAdapter().updateGameMetadata(normalizedCode, {
      playerSeats: { ...playerSeats, [seatKey]: seat } as Record<string, unknown>,
    });
    if (!updated) {
      return { success: false, error: SeatAssignmentError.UPDATE_FAILED };
    }

    console.info(`[${operation}] Added bot "${name}" (${strategy}) to game "${normalizedCode}"`);
    return { success: true, seat, seatKey };
  } catch (e) {
    const err = e as Error;
    console.error(`[${operation}] Unexpected error adding bot:`, err.message);
    return { success: false, error: SeatAssignmentError.UPDATE_FAILED };
  }
}

/** Host only, before the game starts: remove a bot seat. Human seats can't be removed this way. */
export async function removeBotSeat(
  code: string,
  hostDeviceId: string,
  seatKey: string
): Promise<{ success: boolean; error?: string }> {
  const operation = 'removeBotSeat';

  if (!isValidGameCode(code) || !hostDeviceId || !seatKey) {
    return { success: false, error: SeatAssignmentError.INVALID_CODE };
  }

  const normalizedCode = normalizeGameCode(code);

  try {
    const loaded = await loadForBotSeatChange(normalizedCode, hostDeviceId);
    if (!loaded.ok) {
      console.error(`[${operation}] Cannot remove bot from game "${normalizedCode}": ${loaded.error}`);
      return { success: false, error: loaded.error };
    }

    const { playerSeats } = loaded;
    const seat = playerSeats[seatKey];
    if (!seat) return { success: false, error: SeatAssignmentError.NOT_JOINED };
    if (!isBotSeat(seat)) return { success: false, error: SeatAssignmentError.NOT_A_BOT };

    const remaining = { ...playerSeats };
    delete remaining[seatKey];

    const updated = await getAdapter().updateGameMetadata(normalizedCode, {
      playerSeats: remaining as Record<string, unknown>,
    });
    if (!updated) {
      return { success: false, error: SeatAssignmentError.UPDATE_FAILED };
    }

    console.info(`[${operation}] Removed bot "${seat.bot?.name}" from game "${normalizedCode}"`);
    return { success: true };
  } catch (e) {
    const err = e as Error;
    console.error(`[${operation}] Unexpected error removing bot:`, err.message);
    return { success: false, error: SeatAssignmentError.UPDATE_FAILED };
  }
}

export async function isHost(
  code: string,
  deviceId: string
): Promise<boolean> {
  const operation = 'isHost';

  if (!isValidGameCode(code) || !deviceId) {
    return false;
  }

  const normalizedCode = normalizeGameCode(code);

  try {
    const adapter = getAdapter();
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
  code: string
): Promise<{ joined: number; total: number } | null> {
  const operation = 'getNumPlayersJoined';

  if (!isValidGameCode(code)) {
    return null;
  }

  const normalizedCode = normalizeGameCode(code);

  try {
    const adapter = getAdapter();

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
  code: string
): Promise<boolean> {
  const counts = await getNumPlayersJoined(code);
  if (!counts) {
    return false;
  }
  return counts.joined >= counts.total;
}

/** Call when transitioning from waiting_for_players to setup. Shuffles playerIDs and assigns to joined devices (host only). */
export async function assignRandomPlayerIDs(
  code: string,
  deviceId: string
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
    const adapter = getAdapter();

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

    if (!isSupportedGameMetadata(metadata as unknown as Record<string, unknown>)) {
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
  deviceId: string
): Promise<string | null> {
  const operation = 'getDevicePlayerID';

  if (!isValidGameCode(code) || !deviceId) {
    return null;
  }

  const normalizedCode = normalizeGameCode(code);

  try {
    const adapter = getAdapter();
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
  deviceId: string
): Promise<PlayerSeat | null> {
  const operation = 'getDeviceSeat';

  if (!isValidGameCode(code) || !deviceId) {
    return null;
  }

  const normalizedCode = normalizeGameCode(code);

  try {
    const adapter = getAdapter();
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
  code: string
): Promise<Record<string, PlayerSeat> | null> {
  const operation = 'getPlayerSeats';

  if (!isValidGameCode(code)) {
    return null;
  }

  const normalizedCode = normalizeGameCode(code);

  try {
    const adapter = getAdapter();
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
