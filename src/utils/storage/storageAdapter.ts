/**
 * Storage Adapter Interface
 *
 * Abstract base class defining the interface for game storage adapters.
 * All storage implementations (localStorage, Supabase, etc.) must implement this interface.
 * This abstraction allows the game manager to work with different storage backends
 * without changing its core logic.
 *
 * Stored state is the serialized shape (SerializedState from stateSerialization).
 */

import type { SerializedState } from '../stateSerialization';

/** Game list item returned by listGames(). */
export interface GameListItem {
  code: string;
  phase: string;
  turn: number;
  numPlayers: number;
  lastModified: string;
  playerNames: string[];
  metadata: Record<string, unknown>;
}

/** Result of saveGame for adapters that return an object (e.g. Supabase). */
export interface SaveGameResultObject {
  success: boolean;
  conflict?: boolean;
  lastModified?: string;
}

export type SaveGameResult = boolean | SaveGameResultObject;

/** Callback for subscribeToGame: (state, metadata, lastModified) => void */
export type SubscribeCallback = (
  state: SerializedState | null,
  metadata: Record<string, unknown>,
  lastModified: string | null
) => void;

/**
 * Base StorageAdapter class.
 * All storage adapters must implement: saveGame, loadGame, deleteGame, listGames,
 * getGameMetadata, updateGameMetadata. subscribeToGame and getLastModified are optional.
 */
export class StorageAdapter {
  async saveGame(
    _code: string,
    _state: SerializedState,
    _metadata: Record<string, unknown>,
    _expectedLastModified?: string | null
  ): Promise<SaveGameResult> {
    throw new Error('saveGame must be implemented by storage adapter');
  }

  async loadGame(_code: string): Promise<SerializedState | null> {
    throw new Error('loadGame must be implemented by storage adapter');
  }

  async deleteGame(_code: string): Promise<boolean> {
    throw new Error('deleteGame must be implemented by storage adapter');
  }

  async listGames(): Promise<GameListItem[]> {
    throw new Error('listGames must be implemented by storage adapter');
  }

  /**
   * Subscribe to real-time updates for a game.
   * Default: no-op (localStorage doesn't support real-time). Cloud adapters override.
   */
  subscribeToGame(
    _code: string,
    _callback: SubscribeCallback
  ): () => void {
    return () => {};
  }

  async gameExists(code: string): Promise<boolean> {
    const game = await this.loadGame(code);
    return game !== null;
  }

  /**
   * Get the last modified timestamp. Optional; cloud adapters override.
   * Default: timestamps not supported.
   */
  async getLastModified(_code: string): Promise<string | null> {
    return null;
  }

  async getGameMetadata(_code: string): Promise<Record<string, unknown> | null> {
    throw new Error('getGameMetadata must be implemented by storage adapter');
  }

  async updateGameMetadata(
    _code: string,
    _metadata: Record<string, unknown>
  ): Promise<boolean> {
    throw new Error('updateGameMetadata must be implemented by storage adapter');
  }
}
