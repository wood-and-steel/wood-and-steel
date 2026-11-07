/**
 * In-memory StorageAdapter for tests only. Not imported by app code.
 * Mirrors the Supabase adapter's observable behavior closely enough for gameManager tests:
 * state is serialized on save and deserialized on load, metadata merges on update.
 */

import { StorageAdapter } from './storageAdapter';
import type { GameListItem } from './storageAdapter';
import { serializeState, deserializeState, isValidSerializedState } from '../stateSerialization';
import type { SerializedState } from '../stateSerialization';

interface StoredGame {
  state: SerializedState;
  metadata: Record<string, unknown>;
}

export class MemoryStorageAdapter extends StorageAdapter {
  private games = new Map<string, StoredGame>();

  clear(): void {
    this.games.clear();
  }

  async saveGame(
    code: string,
    state: SerializedState,
    metadata: Record<string, unknown> = {}
  ): Promise<boolean> {
    if (!state?.G || !state?.ctx) return false;
    const serialized = structuredClone(serializeState(state.G, state.ctx));
    const existing = this.games.get(code)?.metadata ?? {};
    this.games.set(code, {
      state: serialized,
      metadata: {
        ...existing,
        ...metadata,
        lastModified: (metadata.lastModified as string) || new Date().toISOString(),
      },
    });
    return true;
  }

  /** Raw stored state, for tests that corrupt it on purpose. */
  setRawState(code: string, state: unknown): void {
    const game = this.games.get(code);
    if (game) game.state = state as SerializedState;
  }

  async loadGame(code: string): Promise<SerializedState | null> {
    // Yield a macrotask, like a network read, so fire-and-forget saves started by
    // store actions finish before a test reads the game back.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const game = this.games.get(code);
    if (!game) return null;
    if (!isValidSerializedState(game.state)) return null;
    return deserializeState(structuredClone(game.state));
  }

  async deleteGame(code: string): Promise<boolean> {
    return this.games.delete(code);
  }

  async listGames(): Promise<GameListItem[]> {
    return [...this.games.entries()]
      .map(([code, { state, metadata }]) => {
        const ctx = state.ctx as Record<string, unknown>;
        return {
          code,
          phase: (ctx.phase as string) || 'unknown',
          turn: (ctx.turn as number) ?? 0,
          numPlayers: (ctx.numPlayers as number) ?? 0,
          lastModified: (metadata.lastModified as string) || new Date(0).toISOString(),
          playerNames: [],
          metadata,
        };
      })
      .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
  }

  async getGameMetadata(code: string): Promise<Record<string, unknown> | null> {
    const game = this.games.get(code);
    return game ? structuredClone(game.metadata) : null;
  }

  async updateGameMetadata(code: string, metadata: Record<string, unknown>): Promise<boolean> {
    const game = this.games.get(code);
    if (!game) return false;
    game.metadata = { ...game.metadata, ...metadata, lastModified: new Date().toISOString() };
    return true;
  }
}
