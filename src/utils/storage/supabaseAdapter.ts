/**
 * Supabase Storage Adapter
 *
 * Implements the StorageAdapter interface using Supabase PostgreSQL database.
 * This adapter provides cloud storage with real-time synchronization for multiplayer games.
 *
 * Features:
 * - Anon key only (no auth); game code-based access
 * - PostgreSQL database storage
 * - Real-time subscriptions via Supabase Realtime
 * - Game code-based access (5-letter codes)
 *
 * Database Schema:
 * - Table: games
 *   - code VARCHAR(5) PRIMARY KEY
 *   - state JSONB NOT NULL (contains {G: {...}, ctx: {...}})
 *   - metadata JSONB (contains {lastModified, playerNames, ...})
 *   - created_at TIMESTAMPTZ DEFAULT NOW()
 *   - last_modified TIMESTAMPTZ DEFAULT NOW()
 */

import {
  StorageAdapter,
  type GameListItem,
  type SaveGameResultObject,
  type SubscribeCallback,
} from './storageAdapter';
import { serializeState, deserializeState, isValidSerializedState } from '../stateSerialization';
import type { SerializedState } from '../stateSerialization';
import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';

/** Row shape from games table (state is serialized). */
interface GamesRow {
  code: string;
  state?: unknown;
  metadata?: Record<string, unknown>;
  last_modified?: string;
  created_at?: string;
}

/** Payload.new from postgres_changes for games table. */
interface GamesRowPayload {
  new: GamesRow;
}

export class SupabaseAdapter extends StorageAdapter {
  private supabase: SupabaseClient;
  /** Map of normalized code -> RealtimeChannel (one subscription per game). */
  private activeSubscriptions: Map<string, RealtimeChannel> = new Map();

  constructor(supabaseUrl: string, supabaseAnonKey: string) {
    super();

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('SupabaseAdapter: supabaseUrl and supabaseAnonKey are required');
    }

    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
  }

  _normalizeCode(code: string): string {
    return code ? code.toUpperCase().trim() : '';
  }

  _isValidCode(code: string): boolean {
    if (!code) return false;
    const normalized = this._normalizeCode(code);
    return /^[A-Z]{4,5}$/.test(normalized);
  }

  /** Save with optimistic locking: if expectedLastModified provided and server is >10s newer, flag conflict (last-write-wins). */
  async saveGame(
    code: string,
    state: SerializedState,
    metadata: Record<string, unknown> = {},
    expectedLastModified: string | null = null
  ): Promise<boolean | SaveGameResultObject> {
    const operation = 'saveGame';

    if (!this._isValidCode(code)) {
      console.error(`[SupabaseAdapter.${operation}] Invalid game code format:`, code);
      return { success: false };
    }

    const normalizedCode = this._normalizeCode(code);

    try {
      if (!state || typeof state !== 'object') {
        console.error(
          `[SupabaseAdapter.${operation}] Invalid state parameter for game "${normalizedCode}": expected object, got ${typeof state}`
        );
        return { success: false };
      }

      const { G, ctx } = state;

      if (!G || typeof G !== 'object') {
        console.error(
          `[SupabaseAdapter.${operation}] Invalid G parameter for game "${normalizedCode}": expected object, got ${typeof G}`
        );
        return { success: false };
      }

      if (!ctx || typeof ctx !== 'object') {
        console.error(
          `[SupabaseAdapter.${operation}] Invalid ctx parameter for game "${normalizedCode}": expected object, got ${typeof ctx}`
        );
        return { success: false };
      }

      // Serialize state using stateSerialization utilities
      let serialized: unknown;
      try {
        serialized = serializeState(G, ctx);
      } catch (serializeError) {
        const err = serializeError as Error;
        console.error(
          `[SupabaseAdapter.${operation}] Serialization failed for game "${normalizedCode}":`,
          err.message
        );
        return { success: false };
      }

      const now = new Date().toISOString();
      const gameMetadata = {
        ...metadata,
        lastModified: (metadata.lastModified as string) || now,
      };

      // Check existing game for conflict detection (expectedLastModified vs server last_modified)
      const { data: existingGame, error: fetchError } = await this.supabase
        .from('games')
        .select('code, last_modified, state')
        .eq('code', normalizedCode)
        .maybeSingle();

      if (fetchError) {
        console.error(
          `[SupabaseAdapter.${operation}] Error checking existing game "${normalizedCode}":`,
          fetchError.message
        );
        return { success: false };
      }

      const existing = existingGame as GamesRow | null;
      // Only flag significant conflict if server is >10s newer (avoids false positives from same-client rapid saves, stale cache, or replication delay)
      let hasSignificantConflict = false;
      if (expectedLastModified && existing) {
        const serverLastModified = existing.last_modified;
        if (serverLastModified !== expectedLastModified) {
          const serverTime = new Date(serverLastModified ?? 0).getTime();
          const expectedTime = new Date(expectedLastModified).getTime();
          const timeDiff = serverTime - expectedTime;

          if (timeDiff > 10000) {
            hasSignificantConflict = true;
            console.warn(
              `[SupabaseAdapter.${operation}] Conflict detected for game "${normalizedCode}": expected ${expectedLastModified}, got ${serverLastModified}. Last-write-wins.`
            );
          }
        }
      }
      // When expectedLastModified is null (cache miss), skip conflict detection to avoid false positives on first save

      const gameData: Record<string, unknown> = {
        code: normalizedCode,
        state: serialized,
        metadata: gameMetadata,
        last_modified: now,
      };

      if (!existing) {
        gameData.created_at = now;
      }

      // Supabase client has no typed schema for 'games' table; shape is correct at runtime
      const gamesTable = this.supabase.from('games') as unknown as {
        upsert: (data: Record<string, unknown>, options: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
      };
      const { error: upsertError } = await gamesTable.upsert(gameData, {
        onConflict: 'code',
      });

      if (upsertError) {
        console.error(
          `[SupabaseAdapter.${operation}] Failed to save game "${normalizedCode}":`,
          upsertError.message
        );
        return { success: false };
      }

      if (hasSignificantConflict) {
        console.info(
          `[SupabaseAdapter.${operation}] Saved game "${normalizedCode}" with conflict resolution (last-write-wins)`
        );
        return { success: true, conflict: true, lastModified: now };
      }

      console.info(`[SupabaseAdapter.${operation}] Successfully saved game "${normalizedCode}"`);
      return { success: true, lastModified: now };
    } catch (e) {
      const err = e as Error;
      console.error(
        `[SupabaseAdapter.${operation}] Unexpected error saving state for game "${normalizedCode}":`,
        err.message
      );
      console.error(`[SupabaseAdapter.${operation}] Error details:`, e);
      return { success: false };
    }
  }

  /** Last_modified timestamp for the game row (used for optimistic concurrency). */
  async getLastModified(code: string): Promise<string | null> {
    const operation = 'getLastModified';

    if (!this._isValidCode(code)) {
      return null;
    }

    const normalizedCode = this._normalizeCode(code);

    try {
      const { data, error } = await this.supabase
        .from('games')
        .select('last_modified')
        .eq('code', normalizedCode)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return (data as GamesRow).last_modified ?? null;
    } catch (e) {
      const err = e as Error;
      console.error(
        `[SupabaseAdapter.${operation}] Error getting last_modified for game "${normalizedCode}":`,
        err.message
      );
      return null;
    }
  }

  async loadGame(code: string): Promise<SerializedState | null> {
    const operation = 'loadGame';

    if (!this._isValidCode(code)) {
      console.error(`[SupabaseAdapter.${operation}] Invalid game code format:`, code);
      return null;
    }

    const normalizedCode = this._normalizeCode(code);

    try {
      const { data, error } = await this.supabase
        .from('games')
        .select('state')
        .eq('code', normalizedCode)
        .maybeSingle();

      if (error) {
        console.error(
          `[SupabaseAdapter.${operation}] Error loading game "${normalizedCode}":`,
          error.message
        );
        return null;
      }

      const row = data as GamesRow | null;
      if (!row || !row.state) {
        if (!row) {
          console.info(`[SupabaseAdapter.${operation}] No saved state found for game:`, normalizedCode);
        } else {
          console.warn(`[SupabaseAdapter.${operation}] Game "${normalizedCode}" has no state data`);
        }
        return null;
      }

      const stateData = row.state;

      if (!isValidSerializedState(stateData)) {
        console.warn(`[SupabaseAdapter.${operation}] Invalid state format for game "${normalizedCode}"`);
        return null;
      }

      try {
        return deserializeState(stateData);
      } catch (deserializeError) {
        const err = deserializeError as Error;
        console.error(
          `[SupabaseAdapter.${operation}] Deserialization failed for game "${normalizedCode}":`,
          err.message
        );
        return null;
      }
    } catch (e) {
      const err = e as Error;
      console.error(
        `[SupabaseAdapter.${operation}] Unexpected error loading state for game "${normalizedCode}":`,
        err.message
      );
      console.error(`[SupabaseAdapter.${operation}] Error details:`, e);
      return null;
    }
  }

  async deleteGame(code: string): Promise<boolean> {
    const operation = 'deleteGame';

    if (!this._isValidCode(code)) {
      console.error(`[SupabaseAdapter.${operation}] Invalid game code format:`, code);
      return false;
    }

    const normalizedCode = this._normalizeCode(code);

    try {
      if (this.activeSubscriptions.has(normalizedCode)) {
        this._unsubscribeFromGame(normalizedCode);
      }

      const { error } = await this.supabase.from('games').delete().eq('code', normalizedCode);

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found (PostgREST 116)
          console.warn(`[SupabaseAdapter.${operation}] Game not found:`, normalizedCode);
          return false;
        }
        console.error(
          `[SupabaseAdapter.${operation}] Error deleting game "${normalizedCode}":`,
          error.message
        );
        return false;
      }

      console.info(`[SupabaseAdapter.${operation}] Successfully deleted game "${normalizedCode}"`);
      return true;
    } catch (e) {
      const err = e as Error;
      console.error(
        `[SupabaseAdapter.${operation}] Unexpected error deleting game "${normalizedCode}":`,
        err.message
      );
      console.error(`[SupabaseAdapter.${operation}] Error details:`, e);
      return false;
    }
  }

  async listGames(): Promise<GameListItem[]> {
    const operation = 'listGames';

    try {
      const { data, error } = await this.supabase
        .from('games')
        .select('code, state, metadata, last_modified')
        .order('last_modified', { ascending: false });

      if (error) {
        console.error(`[SupabaseAdapter.${operation}] Error listing games:`, error.message);
        return [];
      }

      if (!data || !Array.isArray(data)) {
        return [];
      }

      const games: GameListItem[] = [];

      for (const row of data as GamesRow[]) {
        if (!this._isValidCode(row.code)) {
          continue; // Skip invalid game codes
        }

        try {
          const state = row.state;
          const metadata = row.metadata ?? {};

          if (state && isValidSerializedState(state)) {
            const stateObj = state as { G?: { players?: [string, { name?: string }][] }; ctx?: { phase?: string; turn?: number; numPlayers?: number } };
            // Extract player names from game state for list item
            const playerNames =
              stateObj.G?.players?.map(([, player]) => player?.name ?? '') ?? [];

            games.push({
              code: row.code,
              phase: stateObj.ctx?.phase ?? 'unknown',
              turn: stateObj.ctx?.turn ?? 0,
              numPlayers: stateObj.ctx?.numPlayers ?? 0,
              lastModified:
                (metadata.lastModified as string) ?? row.last_modified ?? new Date(0).toISOString(),
              playerNames,
              metadata,
            });
          }
        } catch (e) {
          const err = e as Error;
          console.warn(`[SupabaseAdapter.${operation}] Error processing game "${row.code}":`, err.message);
        }
      }

      // Sort by lastModified descending (query already orders by last_modified DESC; ensure list shape is consistent)
      return games.sort((a, b) => {
        const timeA = new Date(a.lastModified).getTime();
        const timeB = new Date(b.lastModified).getTime();
        return timeB - timeA;
      });
    } catch (e) {
      const err = e as Error;
      console.error(`[SupabaseAdapter.${operation}] Unexpected error listing games:`, err.message);
      console.error(`[SupabaseAdapter.${operation}] Error details:`, e);
      return [];
    }
  }

  /** Supabase Realtime postgres_changes for games table; callback(state, metadata, lastModified). Returns unsubscribe. */
  subscribeToGame(code: string, callback: SubscribeCallback): () => void {
    const operation = 'subscribeToGame';

    if (!this._isValidCode(code)) {
      console.error(`[SupabaseAdapter.${operation}] Invalid game code format:`, code);
      return () => {}; // No-op unsubscribe
    }

    const normalizedCode = this._normalizeCode(code);

    if (this.activeSubscriptions.has(normalizedCode)) {
      this._unsubscribeFromGame(normalizedCode); // One subscription per game
    }

    const channel = this.supabase
      .channel(`game:${normalizedCode}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `code=eq.${normalizedCode}`,
        },
        (payload: GamesRowPayload) => {
          try {
            const newData = payload.new;
            if (newData?.state) {
              if (isValidSerializedState(newData.state)) {
                const state = deserializeState(newData.state);
                const metadata = (newData.metadata ?? {}) as Record<string, unknown>;
                const lastModified = newData.last_modified ?? null;
                callback(state, metadata, lastModified);
              } else {
                console.warn(
                  `[SupabaseAdapter.${operation}] Received invalid state update for game "${normalizedCode}"`
                );
              }
            }
          } catch (error) {
            const err = error as Error;
            console.error(
              `[SupabaseAdapter.${operation}] Error processing real-time update for game "${normalizedCode}":`,
              err.message
            );
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.info(
            `[SupabaseAdapter.${operation}] Subscribed to real-time updates for game "${normalizedCode}"`
          );
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`[SupabaseAdapter.${operation}] Error subscribing to game "${normalizedCode}"`);
        }
      });

    this.activeSubscriptions.set(normalizedCode, channel as RealtimeChannel);

    return () => this._unsubscribeFromGame(normalizedCode);
  }

  _unsubscribeFromGame(code: string): void {
    const normalizedCode = this._normalizeCode(code);
    const channel = this.activeSubscriptions.get(normalizedCode);

    if (channel) {
      this.supabase.removeChannel(channel);
      this.activeSubscriptions.delete(normalizedCode);
      console.info(`[SupabaseAdapter] Unsubscribed from real-time updates for game "${normalizedCode}"`);
    }
  }

  /** Unsubscribe from all active channels; call when adapter is no longer needed (e.g. component unmount). */
  cleanup(): void {
    for (const [, channel] of this.activeSubscriptions.entries()) {
      this.supabase.removeChannel(channel);
    }
    this.activeSubscriptions.clear();
    console.info('[SupabaseAdapter] Cleaned up all subscriptions');
  }

  /** Game metadata only (no full state load). */
  async getGameMetadata(code: string): Promise<Record<string, unknown> | null> {
    const operation = 'getGameMetadata';

    if (!this._isValidCode(code)) {
      console.error(`[SupabaseAdapter.${operation}] Invalid game code format:`, code);
      return null;
    }

    const normalizedCode = this._normalizeCode(code);

    try {
      const { data, error } = await this.supabase
        .from('games')
        .select('metadata')
        .eq('code', normalizedCode)
        .maybeSingle();

      if (error) {
        console.error(
          `[SupabaseAdapter.${operation}] Error getting metadata for game "${normalizedCode}":`,
          error.message
        );
        return null;
      }

      if (!data) {
        console.info(`[SupabaseAdapter.${operation}] No game found with code:`, normalizedCode);
        return null;
      }

      return ((data as GamesRow).metadata ?? {}) as Record<string, unknown>;
    } catch (e) {
      const err = e as Error;
      console.error(
        `[SupabaseAdapter.${operation}] Unexpected error getting metadata for game "${normalizedCode}":`,
        err.message
      );
      return null;
    }
  }

  /** Update metadata only; merges with existing and sets lastModified / last_modified. */
  async updateGameMetadata(code: string, metadata: Record<string, unknown>): Promise<boolean> {
    const operation = 'updateGameMetadata';

    if (!this._isValidCode(code)) {
      console.error(`[SupabaseAdapter.${operation}] Invalid game code format:`, code);
      return false;
    }

    const normalizedCode = this._normalizeCode(code);

    try {
      const { data: existingGame, error: fetchError } = await this.supabase
        .from('games')
        .select('metadata')
        .eq('code', normalizedCode)
        .maybeSingle();

      if (fetchError) {
        console.error(
          `[SupabaseAdapter.${operation}] Error fetching existing metadata for game "${normalizedCode}":`,
          fetchError.message
        );
        return false;
      }

      if (!existingGame) {
        console.error(`[SupabaseAdapter.${operation}] Game not found:`, normalizedCode);
        return false;
      }

      const now = new Date().toISOString();
      const existingMetadata = ((existingGame as GamesRow).metadata ?? {}) as Record<string, unknown>;
      const updatedMetadata = {
        ...existingMetadata,
        ...metadata,
        lastModified: now,
      };

      // Update metadata and last_modified (state unchanged)
      const { error: updateError } = await this.supabase
        .from('games')
        .update({
          metadata: updatedMetadata,
          last_modified: now,
        })
        .eq('code', normalizedCode);

      if (updateError) {
        console.error(
          `[SupabaseAdapter.${operation}] Error updating metadata for game "${normalizedCode}":`,
          updateError.message
        );
        return false;
      }

      console.info(
        `[SupabaseAdapter.${operation}] Successfully updated metadata for game "${normalizedCode}"`
      );
      return true;
    } catch (e) {
      const err = e as Error;
      console.error(
        `[SupabaseAdapter.${operation}] Unexpected error updating metadata for game "${normalizedCode}":`,
        err.message
      );
      return false;
    }
  }
}
