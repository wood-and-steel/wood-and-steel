/**
 * Type declarations for StorageAdapter (implementation in storageAdapter.js).
 * Used by supabaseAdapter.ts and gameManager.ts for typed adapter usage.
 */

/** Game state shape as stored/loaded by adapters. */
export interface StoredGameState {
  G: Record<string, unknown>;
  ctx: Record<string, unknown>;
}

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
  state: StoredGameState | null,
  metadata: Record<string, unknown>,
  lastModified: string | null
) => void;

export declare class StorageAdapter {
  saveGame(
    code: string,
    state: StoredGameState,
    metadata: Record<string, unknown>,
    expectedLastModified?: string | null
  ): Promise<SaveGameResult>;

  loadGame(code: string): Promise<StoredGameState | null>;

  deleteGame(code: string): Promise<boolean>;

  listGames(): Promise<GameListItem[]>;

  subscribeToGame(code: string, callback: SubscribeCallback): () => void;

  gameExists(code: string): Promise<boolean>;

  getLastModified?(code: string): Promise<string | null>;

  getGameMetadata(code: string): Promise<Record<string, unknown> | null>;

  updateGameMetadata(code: string, metadata: Record<string, unknown>): Promise<boolean>;
}
