/**
 * LocalStorage Storage Adapter
 *
 * Implements the StorageAdapter interface using browser localStorage.
 * Default storage for single-device game persistence.
 *
 * Uses three localStorage keys:
 * - game_state: Map of game code → {G, ctx}
 * - game_metadata: Map of game code → metadata (includes lastModified)
 * - game_initial: Map of game code → initial state (for future use)
 */

import { StorageAdapter } from './storageAdapter';
import type { StoredGameState, GameListItem } from './storageAdapter';
import { serializeState, deserializeState, isValidSerializedState } from '../stateSerialization';
import type { SerializedState } from '../stateSerialization';

const GAME_STATE_KEY = 'game_state';
const GAME_METADATA_KEY = 'game_metadata';
const GAME_INITIAL_KEY = 'game_initial';

export class LocalStorageAdapter extends StorageAdapter {
  /** Get all game storage data from localStorage. */
  _getGameData(key: string): Map<string, unknown> {
    try {
      const data = localStorage.getItem(key);
      if (!data) return new Map();

      try {
        const parsed: unknown = JSON.parse(data);
        if (!Array.isArray(parsed)) {
          console.error(`[LocalStorageAdapter] Invalid data format for key "${key}": expected array, got ${typeof parsed}`);
          localStorage.removeItem(key);
          return new Map();
        }
        return new Map(parsed as Iterable<[string, unknown]>);
      } catch (parseError) {
        const msg = parseError instanceof Error ? parseError.message : String(parseError);
        console.error(`[LocalStorageAdapter] Failed to parse JSON for key "${key}":`, msg);
        console.error(`[LocalStorageAdapter] Corrupted data (first 200 chars):`, data.substring(0, 200));
        try {
          localStorage.removeItem(key);
          console.warn(`[LocalStorageAdapter] Cleared corrupted data for key "${key}"`);
        } catch (removeError) {
          const removeMsg = removeError instanceof Error ? removeError.message : String(removeError);
          console.error(`[LocalStorageAdapter] Failed to clear corrupted data for key "${key}":`, removeMsg);
        }
        return new Map();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[LocalStorageAdapter] Unexpected error accessing localStorage for key "${key}":`, msg);
      return new Map();
    }
  }

  _setGameData(key: string, dataMap: Map<string, unknown>): boolean {
    try {
      if (!(dataMap instanceof Map)) {
        console.error(`[LocalStorageAdapter] Invalid dataMap type for key "${key}": expected Map, got ${typeof dataMap}`);
        return false;
      }

      const serialized = JSON.stringify(Array.from(dataMap.entries()));
      const currentSize = new Blob([serialized]).size;
      if (currentSize > 5 * 1024 * 1024) {
        console.warn(`[LocalStorageAdapter] Large data size for key "${key}": ${(currentSize / 1024 / 1024).toFixed(2)}MB`);
      }

      localStorage.setItem(key, serialized);
      return true;
    } catch (e) {
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        console.error(`[LocalStorageAdapter] Storage quota exceeded for key "${key}"`);
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[LocalStorageAdapter] Failed to save data for key "${key}":`, msg);
      }
      return false;
    }
  }

  _normalizeCode(code: string): string {
    return code ? code.toUpperCase().trim() : '';
  }

  _isValidCode(code: string): boolean {
    if (!code) return false;
    const normalized = this._normalizeCode(code);
    return /^[A-Z]{4,5}$/.test(normalized);
  }

  async saveGame(
    code: string,
    state: StoredGameState,
    metadata: Record<string, unknown> = {}
  ): Promise<boolean> {
    const operation = 'saveGame';

    if (!this._isValidCode(code)) {
      console.error(`[LocalStorageAdapter.${operation}] Invalid game code format:`, code);
      return false;
    }

    const normalizedCode = this._normalizeCode(code);

    try {
      if (!state || typeof state !== 'object') {
        console.error(`[LocalStorageAdapter.${operation}] Invalid state parameter for game "${normalizedCode}": expected object, got ${typeof state}`);
        return false;
      }

      const { G, ctx } = state;
      if (!G || typeof G !== 'object') {
        console.error(`[LocalStorageAdapter.${operation}] Invalid G parameter for game "${normalizedCode}": expected object, got ${typeof G}`);
        return false;
      }
      if (!ctx || typeof ctx !== 'object') {
        console.error(`[LocalStorageAdapter.${operation}] Invalid ctx parameter for game "${normalizedCode}": expected object, got ${typeof ctx}`);
        return false;
      }

      const stateMap = this._getGameData(GAME_STATE_KEY);
      let serialized: SerializedState;
      try {
        serialized = serializeState(G, ctx);
      } catch (serializeError) {
        const msg = serializeError instanceof Error ? serializeError.message : String(serializeError);
        console.error(`[LocalStorageAdapter.${operation}] Serialization failed for game "${normalizedCode}":`, msg);
        return false;
      }

      stateMap.set(normalizedCode, serialized as unknown);
      if (!this._setGameData(GAME_STATE_KEY, stateMap)) {
        console.error(`[LocalStorageAdapter.${operation}] Failed to persist state to localStorage for game "${normalizedCode}"`);
        return false;
      }

      const metadataMap = this._getGameData(GAME_METADATA_KEY);
      const existingMetadata = (metadataMap.get(normalizedCode) as Record<string, unknown>) || {};
      const updatedMetadata: Record<string, unknown> = {
        ...existingMetadata,
        ...metadata,
        lastModified: (metadata.lastModified as string) || new Date().toISOString(),
      };
      metadataMap.set(normalizedCode, updatedMetadata);
      this._setGameData(GAME_METADATA_KEY, metadataMap);

      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[LocalStorageAdapter.${operation}] Unexpected error saving state for game "${normalizedCode}":`, msg);
      return false;
    }
  }

  async loadGame(code: string): Promise<StoredGameState | null> {
    const operation = 'loadGame';

    if (!this._isValidCode(code)) {
      console.error(`[LocalStorageAdapter.${operation}] Invalid game code format:`, code);
      return null;
    }

    const normalizedCode = this._normalizeCode(code);

    try {
      const stateMap = this._getGameData(GAME_STATE_KEY);
      const stateData = stateMap.get(normalizedCode);

      if (!stateData) {
        return null;
      }

      if (!isValidSerializedState(stateData)) {
        console.warn(`[LocalStorageAdapter.${operation}] Invalid state format for game "${normalizedCode}"`);
        try {
          stateMap.delete(normalizedCode);
          this._setGameData(GAME_STATE_KEY, stateMap);
        } catch {
          // ignore
        }
        return null;
      }

      try {
        return deserializeState(stateData) as StoredGameState;
      } catch (deserializeError) {
        console.error(`[LocalStorageAdapter.${operation}] Deserialization failed for game "${normalizedCode}":`, deserializeError);
        try {
          stateMap.delete(normalizedCode);
          this._setGameData(GAME_STATE_KEY, stateMap);
        } catch {
          // ignore
        }
        return null;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[LocalStorageAdapter.${operation}] Unexpected error loading state for game "${normalizedCode}":`, msg);
      return null;
    }
  }

  async deleteGame(code: string): Promise<boolean> {
    const operation = 'deleteGame';

    if (!this._isValidCode(code)) {
      console.error(`[LocalStorageAdapter.${operation}] Invalid game code format:`, code);
      return false;
    }

    const normalizedCode = this._normalizeCode(code);

    try {
      const stateMap = this._getGameData(GAME_STATE_KEY);
      if (!stateMap.has(normalizedCode)) {
        return false;
      }

      const metadataMap = this._getGameData(GAME_METADATA_KEY);
      const initialMap = this._getGameData(GAME_INITIAL_KEY);

      stateMap.delete(normalizedCode);
      metadataMap.delete(normalizedCode);
      initialMap.delete(normalizedCode);

      this._setGameData(GAME_STATE_KEY, stateMap);
      this._setGameData(GAME_METADATA_KEY, metadataMap);
      this._setGameData(GAME_INITIAL_KEY, initialMap);

      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[LocalStorageAdapter.${operation}] Unexpected error deleting game "${normalizedCode}":`, msg);
      return false;
    }
  }

  async listGames(): Promise<GameListItem[]> {
    const operation = 'listGames';

    try {
      const stateMap = this._getGameData(GAME_STATE_KEY);
      const metadataMap = this._getGameData(GAME_METADATA_KEY);
      const games: GameListItem[] = [];

      for (const [code, state] of stateMap.entries()) {
        if (!this._isValidCode(code)) continue;

        try {
          const metadata = (metadataMap.get(code) as Record<string, unknown>) || {};
          const stateObj = state as SerializedState | undefined;

          if (stateObj?.G && stateObj?.ctx) {
            const ctx = stateObj.ctx as Record<string, unknown>;
            const players = (stateObj.G as Record<string, unknown>).players;
            const playerNames: string[] = Array.isArray(players)
              ? (players as unknown[]).map((p: unknown) => {
                  const pair = p as [string, unknown];
                  const player = Array.isArray(pair) ? pair[1] : (p as Record<string, unknown>);
                  return typeof (player as Record<string, unknown>)?.name === 'string'
                    ? (player as Record<string, unknown>).name as string
                    : '';
                })
              : [];

            games.push({
              code,
              phase: (ctx.phase as string) || 'unknown',
              turn: (ctx.turn as number) ?? 0,
              numPlayers: (ctx.numPlayers as number) ?? 0,
              lastModified: (metadata.lastModified as string) || new Date(0).toISOString(),
              playerNames,
              metadata,
            });
          }
        } catch {
          // continue processing other games
        }
      }

      return games.sort((a, b) => {
        const timeA = new Date(a.lastModified).getTime();
        const timeB = new Date(b.lastModified).getTime();
        return timeB - timeA;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[LocalStorageAdapter.${operation}] Unexpected error listing games:`, msg);
      return [];
    }
  }

  subscribeToGame(): () => void {
    return () => {};
  }

  async getGameMetadata(code: string): Promise<Record<string, unknown> | null> {
    const operation = 'getGameMetadata';

    if (!this._isValidCode(code)) {
      console.error(`[LocalStorageAdapter.${operation}] Invalid game code format:`, code);
      return null;
    }

    const normalizedCode = this._normalizeCode(code);

    try {
      const metadataMap = this._getGameData(GAME_METADATA_KEY);
      const metadata = metadataMap.get(normalizedCode);
      return (metadata as Record<string, unknown>) ?? null;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[LocalStorageAdapter.${operation}] Error getting metadata for game "${normalizedCode}":`, msg);
      return null;
    }
  }

  async updateGameMetadata(code: string, metadata: Record<string, unknown>): Promise<boolean> {
    const operation = 'updateGameMetadata';

    if (!this._isValidCode(code)) {
      console.error(`[LocalStorageAdapter.${operation}] Invalid game code format:`, code);
      return false;
    }

    const normalizedCode = this._normalizeCode(code);

    try {
      const stateMap = this._getGameData(GAME_STATE_KEY);
      if (!stateMap.has(normalizedCode)) {
        return false;
      }

      const metadataMap = this._getGameData(GAME_METADATA_KEY);
      const existingMetadata = (metadataMap.get(normalizedCode) as Record<string, unknown>) || {};
      const updatedMetadata: Record<string, unknown> = {
        ...existingMetadata,
        ...metadata,
        lastModified: new Date().toISOString(),
      };
      metadataMap.set(normalizedCode, updatedMetadata);
      return this._setGameData(GAME_METADATA_KEY, metadataMap);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[LocalStorageAdapter.${operation}] Error updating metadata for game "${normalizedCode}":`, msg);
      return false;
    }
  }
}
