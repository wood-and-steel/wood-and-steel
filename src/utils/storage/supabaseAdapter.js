/**
 * Supabase Storage Adapter
 * 
 * Implements the StorageAdapter interface using Supabase PostgreSQL database.
 * This adapter provides cloud storage with real-time synchronization for multiplayer games.
 * 
 * Features:
 * - Anonymous authentication (no user accounts required)
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

import { StorageAdapter } from './storageAdapter';
import { serializeState, deserializeState, isValidSerializedState } from '../stateSerialization';
import { createClient } from '@supabase/supabase-js';

/**
 * SupabaseAdapter - Implements StorageAdapter using Supabase PostgreSQL database
 */
export class SupabaseAdapter extends StorageAdapter {
  /**
   * Initialize Supabase client and authenticate anonymously
   * 
   * @param {string} supabaseUrl - Supabase project URL
   * @param {string} supabaseAnonKey - Supabase anonymous key
   */
  constructor(supabaseUrl, supabaseAnonKey) {
    super();
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('SupabaseAdapter: supabaseUrl and supabaseAnonKey are required');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
    this.initialized = false;
    this.initializationPromise = null;
    this.activeSubscriptions = new Map(); // Map of code -> channel
  }

  /**
   * Initialize anonymous authentication
   * This is called lazily on first use to avoid blocking constructor
   * 
   * @returns {Promise<void>}
   */
  async _ensureInitialized() {
    if (this.initialized) {
      return;
    }
    
    // If initialization is already in progress, wait for it
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    
    // Start initialization
    this.initializationPromise = this._initialize();
    try {
      await this.initializationPromise;
      this.initialized = true;
    } catch (error) {
      this.initializationPromise = null;
      throw error;
    }
  }

  /**
   * Perform anonymous authentication
   * Checks for existing session first to avoid unnecessary authentication calls
   * 
   * @returns {Promise<void>}
   */
  async _initialize() {
    try {
      // Check if there's already a valid session
      const { data: { session }, error: sessionError } = await this.supabase.auth.getSession();
      
      if (session && session.user) {
        // We already have a valid session, no need to authenticate again
        console.info('[SupabaseAdapter] Using existing anonymous session');
        return;
      }
      
      // No valid session found, sign in anonymously
      const { data, error } = await this.supabase.auth.signInAnonymously();
      
      if (error) {
        // If already signed in, that's okay
        if (error.message.includes('already signed in') || error.message.includes('User already registered')) {
          console.info('[SupabaseAdapter] Already authenticated anonymously');
          return;
        }
        throw new Error(`SupabaseAdapter: Failed to authenticate anonymously: ${error.message}`);
      }
      
      console.info('[SupabaseAdapter] Successfully authenticated anonymously');
    } catch (error) {
      console.error('[SupabaseAdapter] Initialization error:', error);
      throw error;
    }
  }

  /**
   * Normalize game code to uppercase for case-insensitive comparison
   * @param {string} code - Game code to normalize
   * @returns {string} - Uppercase code
   */
  _normalizeCode(code) {
    return code ? code.toUpperCase().trim() : '';
  }

  /**
   * Validate game code format
   * @param {string} code - Game code to validate
   * @returns {boolean} - True if valid format
   */
  _isValidCode(code) {
    if (!code) return false;
    const normalized = this._normalizeCode(code);
    return /^[A-Z]{4,5}$/.test(normalized);
  }

  /**
   * Save game state to Supabase with conflict resolution (last-write-wins)
   * 
   * Uses optimistic locking: checks if last_modified matches before saving.
   * If there's a conflict (last_modified mismatch), the last write wins.
   * 
   * @param {string} code - Game code
   * @param {Object} state - Game state object with structure { G: {...}, ctx: {...} }
   * @param {Object} metadata - Game metadata (e.g., { lastModified: string, playerNames: Array<string> })
   * @param {string} [expectedLastModified] - Optional: expected last_modified timestamp for optimistic locking
   * @returns {Promise<{success: boolean, conflict?: boolean, currentState?: Object}>} - Result object
   */
  async saveGame(code, state, metadata = {}, expectedLastModified = null) {
    const operation = 'saveGame';
    
    if (!this._isValidCode(code)) {
      console.error(`[SupabaseAdapter.${operation}] Invalid game code format:`, code);
      return { success: false };
    }

    const normalizedCode = this._normalizeCode(code);
    
    try {
      await this._ensureInitialized();
      
      // Validate input state
      if (!state || typeof state !== 'object') {
        console.error(`[SupabaseAdapter.${operation}] Invalid state parameter for game "${normalizedCode}": expected object, got ${typeof state}`);
        return { success: false };
      }

      const { G, ctx } = state;
      
      if (!G || typeof G !== 'object') {
        console.error(`[SupabaseAdapter.${operation}] Invalid G parameter for game "${normalizedCode}": expected object, got ${typeof G}`);
        return { success: false };
      }
      
      if (!ctx || typeof ctx !== 'object') {
        console.error(`[SupabaseAdapter.${operation}] Invalid ctx parameter for game "${normalizedCode}": expected object, got ${typeof ctx}`);
        return { success: false };
      }
      
      // Serialize state using serialization utilities
      let serialized;
      try {
        serialized = serializeState(G, ctx);
      } catch (serializeError) {
        console.error(`[SupabaseAdapter.${operation}] Serialization failed for game "${normalizedCode}":`, serializeError.message);
        return { success: false };
      }
      
      // Prepare metadata with lastModified
      const now = new Date().toISOString();
      const gameMetadata = {
        ...metadata,
        lastModified: metadata.lastModified || now
      };
      
      // Check if game exists and get current last_modified for conflict detection
      const { data: existingGame, error: fetchError } = await this.supabase
        .from('games')
        .select('code, last_modified, state')
        .eq('code', normalizedCode)
        .maybeSingle();
      
      if (fetchError) {
        console.error(`[SupabaseAdapter.${operation}] Error checking existing game "${normalizedCode}":`, fetchError.message);
        return { success: false };
      }
      
      // Conflict detection: if expectedLastModified is provided and doesn't match, there's a conflict
      // Only warn if server timestamp is actually newer (indicating someone else saved)
      // Note: We only warn if expectedLastModified is provided (from cache), not if it's null
      // This prevents false positives when the cache is empty or when we're doing the first save
      if (expectedLastModified && existingGame) {
        const serverLastModified = existingGame.last_modified;
        if (serverLastModified !== expectedLastModified) {
          // Check if server timestamp is actually newer (real conflict) or just different format
          const serverTime = new Date(serverLastModified).getTime();
          const expectedTime = new Date(expectedLastModified).getTime();
          const timeDiff = serverTime - expectedTime;
          
          // Only warn if server is significantly newer (more than 10 seconds)
          // This indicates a real conflict from another client, not just our own rapid saves
          // We use 10 seconds to account for:
          // - Network latency and replication delays in Supabase
          // - Multiple rapid saves from the same client
          // - Real-time subscription processing delays
          // - Stale cache values from previous sessions
          // If the difference is > 10 seconds, it's likely a real conflict from another client
          // For single-client scenarios, differences are usually due to stale cache or delays
          if (timeDiff > 10000) {
            console.warn(`[SupabaseAdapter.${operation}] Conflict detected for game "${normalizedCode}": expected ${expectedLastModified}, got ${serverLastModified}. Last-write-wins.`);
          }
          // For differences <= 10 seconds, silently continue (likely our own saves or timing issues)
          
          // Continue with save (last-write-wins strategy)
          // Return conflict flag so caller can handle it if needed
        }
      }
      // If expectedLastModified is null (cache miss), skip conflict detection entirely
      // This prevents false positives on first save or when cache is empty
      
      // Prepare data for upsert
      const gameData = {
        code: normalizedCode,
        state: serialized,
        metadata: gameMetadata,
        last_modified: now
      };
      
      // If game doesn't exist, set created_at
      if (!existingGame) {
        gameData.created_at = now;
      }
      
      // Upsert game (insert or update)
      const { error: upsertError } = await this.supabase
        .from('games')
        .upsert(gameData, {
          onConflict: 'code'
        });
      
      if (upsertError) {
        console.error(`[SupabaseAdapter.${operation}] Failed to save game "${normalizedCode}":`, upsertError.message);
        return { success: false };
      }
      
      const hadConflict = expectedLastModified && existingGame && existingGame.last_modified !== expectedLastModified;
      
      if (hadConflict) {
        console.info(`[SupabaseAdapter.${operation}] Saved game "${normalizedCode}" with conflict resolution (last-write-wins)`);
        return { success: true, conflict: true, lastModified: now };
      }
      
      console.info(`[SupabaseAdapter.${operation}] Successfully saved game "${normalizedCode}"`);
      return { success: true, lastModified: now };
    } catch (e) {
      console.error(`[SupabaseAdapter.${operation}] Unexpected error saving state for game "${normalizedCode}":`, e.message);
      console.error(`[SupabaseAdapter.${operation}] Error details:`, e);
      return { success: false };
    }
  }

  /**
   * Get the last_modified timestamp for a game
   * 
   * @param {string} code - Game code
   * @returns {Promise<string|null>} - Last modified timestamp or null if not found
   */
  async getLastModified(code) {
    const operation = 'getLastModified';
    
    if (!this._isValidCode(code)) {
      return null;
    }

    const normalizedCode = this._normalizeCode(code);
    
    try {
      await this._ensureInitialized();
      
      const { data, error } = await this.supabase
        .from('games')
        .select('last_modified')
        .eq('code', normalizedCode)
        .maybeSingle();
      
      if (error || !data) {
        return null;
      }
      
      return data.last_modified;
    } catch (e) {
      console.error(`[SupabaseAdapter.${operation}] Error getting last_modified for game "${normalizedCode}":`, e.message);
      return null;
    }
  }

  /**
   * Load game state from Supabase
   * 
   * @param {string} code - Game code
   * @returns {Promise<{G: Object, ctx: Object}|null>} - Game state or null if not found/invalid
   */
  async loadGame(code) {
    const operation = 'loadGame';
    
    if (!this._isValidCode(code)) {
      console.error(`[SupabaseAdapter.${operation}] Invalid game code format:`, code);
      return null;
    }

    const normalizedCode = this._normalizeCode(code);
    
    try {
      await this._ensureInitialized();
      
      const { data, error } = await this.supabase
        .from('games')
        .select('state')
        .eq('code', normalizedCode)
        .maybeSingle();
      
      if (error) {
        console.error(`[SupabaseAdapter.${operation}] Error loading game "${normalizedCode}":`, error.message);
        return null;
      }
      
      if (!data || !data.state) {
        // No row found or no state data - this is okay
        if (!data) {
          console.info(`[SupabaseAdapter.${operation}] No saved state found for game:`, normalizedCode);
        } else {
          console.warn(`[SupabaseAdapter.${operation}] Game "${normalizedCode}" has no state data`);
        }
        return null;
      }
      
      const stateData = data.state;
      
      // Validate state structure before deserializing
      if (!isValidSerializedState(stateData)) {
        console.warn(`[SupabaseAdapter.${operation}] Invalid state format for game "${normalizedCode}"`);
        return null;
      }
      
      // Deserialize state using serialization utilities
      try {
        return deserializeState(stateData);
      } catch (deserializeError) {
        console.error(`[SupabaseAdapter.${operation}] Deserialization failed for game "${normalizedCode}":`, deserializeError.message);
        return null;
      }
    } catch (e) {
      console.error(`[SupabaseAdapter.${operation}] Unexpected error loading state for game "${normalizedCode}":`, e.message);
      console.error(`[SupabaseAdapter.${operation}] Error details:`, e);
      return null;
    }
  }

  /**
   * Delete a game from Supabase
   * 
   * @param {string} code - Game code
   * @returns {Promise<boolean>} - True if deleted successfully, false if not found
   */
  async deleteGame(code) {
    const operation = 'deleteGame';
    
    if (!this._isValidCode(code)) {
      console.error(`[SupabaseAdapter.${operation}] Invalid game code format:`, code);
      return false;
    }
    
    const normalizedCode = this._normalizeCode(code);
    
    try {
      await this._ensureInitialized();
      
      // Unsubscribe from real-time updates if active
      if (this.activeSubscriptions.has(normalizedCode)) {
        this._unsubscribeFromGame(normalizedCode);
      }
      
      const { error } = await this.supabase
        .from('games')
        .delete()
        .eq('code', normalizedCode);
      
      if (error) {
        if (error.code === 'PGRST116') {
          // Not found - return false
          console.warn(`[SupabaseAdapter.${operation}] Game not found:`, normalizedCode);
          return false;
        }
        console.error(`[SupabaseAdapter.${operation}] Error deleting game "${normalizedCode}":`, error.message);
        return false;
      }
      
      console.info(`[SupabaseAdapter.${operation}] Successfully deleted game "${normalizedCode}"`);
      return true;
    } catch (e) {
      console.error(`[SupabaseAdapter.${operation}] Unexpected error deleting game "${normalizedCode}":`, e.message);
      console.error(`[SupabaseAdapter.${operation}] Error details:`, e);
      return false;
    }
  }

  /**
   * List all games with their metadata
   * 
   * @returns {Promise<Array<{code: string, phase: string, turn: number, numPlayers: number, lastModified: string, playerNames: Array<string>, metadata: Object}>>} - Array of game info, sorted by lastModified descending
   */
  async listGames() {
    const operation = 'listGames';
    
    try {
      await this._ensureInitialized();
      
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
      
      const games = [];
      
      for (const row of data) {
        // Only include valid game codes
        if (!this._isValidCode(row.code)) {
          continue;
        }
        
        try {
          const state = row.state;
          const metadata = row.metadata || {};
          
          if (state && isValidSerializedState(state)) {
            // Extract player names from the game state
            const playerNames = state.G?.players?.map(([id, player]) => player.name) || [];
            
            games.push({
              code: row.code,
              phase: state.ctx?.phase || 'unknown',
              turn: state.ctx?.turn || 0,
              numPlayers: state.ctx?.numPlayers || 0,
              lastModified: metadata.lastModified || row.last_modified || new Date(0).toISOString(),
              playerNames: playerNames,
              metadata: metadata
            });
          }
        } catch (e) {
          console.warn(`[SupabaseAdapter.${operation}] Error processing game "${row.code}":`, e.message);
          // Continue processing other games
        }
      }
      
      // Already sorted by last_modified DESC from query, but ensure lastModified sorting as well
      return games.sort((a, b) => {
        const timeA = new Date(a.lastModified).getTime();
        const timeB = new Date(b.lastModified).getTime();
        return timeB - timeA; // Descending order
      });
    } catch (e) {
      console.error(`[SupabaseAdapter.${operation}] Unexpected error listing games:`, e.message);
      console.error(`[SupabaseAdapter.${operation}] Error details:`, e);
      return [];
    }
  }

  /**
   * Subscribe to real-time updates for a game
   * 
   * Uses Supabase Realtime to listen for database changes.
   * When the game state is updated in the database, the callback is invoked.
   * 
   * @param {string} code - Game code
   * @param {Function} callback - Callback function that receives updated game state: (state, metadata, lastModified) => void
   * @returns {Function} - Unsubscribe function
   */
  subscribeToGame(code, callback) {
    const operation = 'subscribeToGame';
    
    if (!this._isValidCode(code)) {
      console.error(`[SupabaseAdapter.${operation}] Invalid game code format:`, code);
      return () => {}; // Return no-op unsubscribe
    }
    
    const normalizedCode = this._normalizeCode(code);
    
    // If already subscribed, unsubscribe first
    if (this.activeSubscriptions.has(normalizedCode)) {
      this._unsubscribeFromGame(normalizedCode);
    }
    
    // Ensure initialized before subscribing
    this._ensureInitialized().then(() => {
      const channel = this.supabase
        .channel(`game:${normalizedCode}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'games',
            filter: `code=eq.${normalizedCode}`
          },
          (payload) => {
            try {
              const newData = payload.new;
              if (newData && newData.state) {
                // Validate state before calling callback
                if (isValidSerializedState(newData.state)) {
                  const state = deserializeState(newData.state);
                  const metadata = newData.metadata || {};
                  const lastModified = newData.last_modified || null;
                  callback(state, metadata, lastModified);
                } else {
                  console.warn(`[SupabaseAdapter.${operation}] Received invalid state update for game "${normalizedCode}"`);
                }
              }
            } catch (error) {
              console.error(`[SupabaseAdapter.${operation}] Error processing real-time update for game "${normalizedCode}":`, error.message);
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.info(`[SupabaseAdapter.${operation}] Subscribed to real-time updates for game "${normalizedCode}"`);
          } else if (status === 'CHANNEL_ERROR') {
            console.error(`[SupabaseAdapter.${operation}] Error subscribing to game "${normalizedCode}"`);
          }
        });
      
      this.activeSubscriptions.set(normalizedCode, channel);
    }).catch((error) => {
      console.error(`[SupabaseAdapter.${operation}] Failed to initialize before subscribing:`, error.message);
    });
    
    // Return unsubscribe function
    return () => {
      this._unsubscribeFromGame(normalizedCode);
    };
  }

  /**
   * Unsubscribe from real-time updates for a game
   * 
   * @param {string} code - Game code
   * @private
   */
  _unsubscribeFromGame(code) {
    const normalizedCode = this._normalizeCode(code);
    const channel = this.activeSubscriptions.get(normalizedCode);
    
    if (channel) {
      this.supabase.removeChannel(channel);
      this.activeSubscriptions.delete(normalizedCode);
      console.info(`[SupabaseAdapter] Unsubscribed from real-time updates for game "${normalizedCode}"`);
    }
  }

  /**
   * Cleanup: Unsubscribe from all active subscriptions
   * Call this when the adapter is no longer needed (e.g., component unmount)
   */
  cleanup() {
    for (const [code, channel] of this.activeSubscriptions.entries()) {
      this.supabase.removeChannel(channel);
    }
    this.activeSubscriptions.clear();
    console.info('[SupabaseAdapter] Cleaned up all subscriptions');
  }
}
