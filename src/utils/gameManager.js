/**
 * Game Manager - Handles multiple game instances with unique four-letter codes
 * Works with Zustand store state persistence
 * Uses storage adapter pattern to support multiple storage backends (localStorage, Supabase, etc.)
 */

import { getStorageAdapter } from './storage/index';

// Storage keys for current game (separate for local and cloud storage)
const CURRENT_GAME_LOCAL_KEY = 'current_game_local';
const CURRENT_GAME_CLOUD_KEY = 'current_game_cloud';

/**
 * Generate a random five-letter code (no vowels to avoid making words)
 * @returns {string} - Five-letter uppercase code
 */
export function generateGameCode() {
  const letters = 'BCDFGHJKLMNPQRSTVWXYZ';
  let code = '';

  code = '';
  for (let i = 0; i < 5; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }

  return code;
}

/**
 * Generate a unique code that doesn't exist in current games
 * @returns {Promise<string>} - Unique game code
 */
export async function generateUniqueGameCode() {
  const existingCodes = await listGameCodes();
  let code;
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

/**
 * Normalize game code to uppercase for case-insensitive comparison
 * @param {string} code - Game code to normalize
 * @returns {string} - Uppercase code
 */
export function normalizeGameCode(code) {
  return code ? code.toUpperCase().trim() : '';
}

/**
 * Validate game code format (4 or 5 letters A-Z, case-insensitive)
 * @param {string} code - Game code to validate
 * @returns {boolean} - True if valid format
 */
export function isValidGameCode(code) {
  if (!code) return false;
  const normalized = normalizeGameCode(code);
  return /^[A-Z]{4,5}$/.test(normalized);
}

/**
 * Get the storage adapter instance
 * @param {string} [storageType] - Optional storage type ('local' or 'cloud')
 * @returns {StorageAdapter} The storage adapter
 */
function getAdapter(storageType = null) {
  return getStorageAdapter(storageType);
}

/**
 * Switch to a different game by updating the active game code
 * @param {string} code - Game code to switch to
 * @param {string} [storageType] - Optional storage type ('local' or 'cloud'). Defaults to 'local'.
 * @returns {Promise<boolean>} - True if switched successfully
 */
export async function switchToGame(code, storageType = 'local') {
  const operation = 'switchToGame';
  
  if (!isValidGameCode(code)) {
    console.error(`[${operation}] Invalid game code format:`, code);
    return false;
  }
  
  const normalizedCode = normalizeGameCode(code);
  
  try {
    // Check if game exists (using the appropriate adapter)
    const adapter = getAdapter(storageType);
    const exists = await adapter.gameExists(normalizedCode);
    if (!exists) {
      console.warn(`[${operation}] Game not found:`, normalizedCode);
      return false;
    }
    
    // Set as current game for the specified storage type
    setCurrentGameCode(normalizedCode, storageType);
    return true;
  } catch (e) {
    console.error(`[${operation}] Unexpected error switching to game "${normalizedCode}":`, e.message);
    console.error(`[${operation}] Error details:`, e);
    return false;
  }
}

/**
 * Delete a game from storage
 * Removes all game data for this game code
 * @param {string} code - Game code
 * @param {string} [storageType] - Optional storage type ('local' or 'cloud'). If not provided, tries both.
 * @returns {Promise<boolean>} - True if deleted, false if not found
 */
export async function deleteGame(code, storageType = null) {
  const operation = 'deleteGame';
  
  if (!isValidGameCode(code)) {
    console.error(`[${operation}] Invalid game code format:`, code);
    return false;
  }
  
  const normalizedCode = normalizeGameCode(code);
  
  try {
    if (storageType) {
      // Delete from specific storage type
      const adapter = getAdapter(storageType);
      return await adapter.deleteGame(normalizedCode);
    } else {
      // Try both storage types (for backward compatibility)
      const localAdapter = getAdapter('local');
      const cloudAdapter = getAdapter('cloud');
      const localResult = await localAdapter.deleteGame(normalizedCode);
      const cloudResult = await cloudAdapter.deleteGame(normalizedCode);
      return localResult || cloudResult;
    }
  } catch (e) {
    console.error(`[${operation}] Unexpected error deleting game "${normalizedCode}":`, e.message);
    console.error(`[${operation}] Error details:`, e);
    return false;
  }
}

/**
 * List all game codes
 * @returns {Promise<string[]>} - Array of game codes
 */
export async function listGameCodes() {
  const games = await listGames();
  return games.map(game => game.code).sort();
}

/**
 * Check if a game exists
 * @param {string} code - Game code
 * @param {string} storageType - Storage type ('local' or 'cloud')
 * @returns {Promise<boolean>} - True if game exists
 */
export async function gameExists(code, storageType) {
  if (!isValidGameCode(code)) {
    return false;
  }
  
  const normalizedCode = normalizeGameCode(code);
  const adapter = getAdapter(storageType);
  return await adapter.gameExists(normalizedCode);
}

/**
 * Get the current active game code
 * @param {string} [storageType] - Optional storage type ('local' or 'cloud'). If not provided, uses current storage preference.
 * @returns {string|null} - Current game code or null
 */
export function getCurrentGameCode(storageType = null) {
  // If storageType is provided, use it
  if (storageType === 'local') {
    return localStorage.getItem(CURRENT_GAME_LOCAL_KEY);
  }
  if (storageType === 'cloud') {
    return localStorage.getItem(CURRENT_GAME_CLOUD_KEY);
  }
  
  // If not provided, use the current storage preference from StorageProvider
  const storagePreference = localStorage.getItem('storage_preference');
  const currentStorageType = (storagePreference === 'local' || storagePreference === 'cloud') 
    ? storagePreference 
    : 'local'; // Default to local if preference not set
  
  const key = currentStorageType === 'cloud' ? CURRENT_GAME_CLOUD_KEY : CURRENT_GAME_LOCAL_KEY;
  return localStorage.getItem(key);
}

/**
 * Set the current active game code
 * @param {string} code - Game code to set as current
 * @param {string} [storageType] - Optional storage type ('local' or 'cloud'). If not provided, uses current storage preference.
 * @throws {Error} If game code is invalid or storage fails
 */
export function setCurrentGameCode(code, storageType = null) {
  const operation = 'setCurrentGameCode';
  
  if (!isValidGameCode(code)) {
    const error = new Error(`Invalid game code format: ${code}`);
    console.error(`[${operation}]`, error.message);
    throw error;
  }
  
  const normalizedCode = normalizeGameCode(code);
  
  // If storageType not provided, use current storage preference
  if (!storageType) {
    const storagePreference = localStorage.getItem('storage_preference');
    storageType = (storagePreference === 'local' || storagePreference === 'cloud') 
      ? storagePreference 
      : 'local'; // Default to local if preference not set
  }
  
  const key = storageType === 'cloud' ? CURRENT_GAME_CLOUD_KEY : CURRENT_GAME_LOCAL_KEY;
  
  try {
    localStorage.setItem(key, normalizedCode);
  } catch (e) {
    const error = new Error(`Failed to set current game code: ${e.message}`);
    console.error(`[${operation}]`, error.message);
    console.error(`[${operation}] Error details:`, e);
    throw error;
  }
}

/**
 * Clear the current game code
 * @param {string} [storageType] - Optional storage type ('local' or 'cloud'). If not provided, uses current storage preference.
 */
export function clearCurrentGameCode(storageType = null) {
  // If storageType not provided, use current storage preference
  if (!storageType) {
    const storagePreference = localStorage.getItem('storage_preference');
    storageType = (storagePreference === 'local' || storagePreference === 'cloud') 
      ? storagePreference 
      : 'local'; // Default to local if preference not set
  }
  
  const key = storageType === 'cloud' ? CURRENT_GAME_CLOUD_KEY : CURRENT_GAME_LOCAL_KEY;
  localStorage.removeItem(key);
}

/**
 * Get all games with their codes and basic info
 * Sorted by lastModified descending (most recent first)
 * @param {string} [storageType] - Optional storage type ('local' or 'cloud'). If not provided, defaults to 'local'.
 * @returns {Promise<Array<{code: string, phase: string, turn: number, numPlayers: number, lastModified: string, playerNames: Array<string>, metadata: Object}>>} - Array of game info
 */
export async function listGames(storageType = 'local') {
  const operation = 'listGames';
  
  try {
    const adapter = getAdapter(storageType);
    return await adapter.listGames();
  } catch (e) {
    console.error(`[${operation}] Unexpected error listing games:`, e.message);
    console.error(`[${operation}] Error details:`, e);
    return [];
  }
}

/**
 * Create a new game with a unique code
 * Sets initial lastModified timestamp in metadata
 * @param {string} [storageType] - Optional storage type ('local' or 'cloud'). Defaults to 'local'.
 * @param {Object} [options] - Optional configuration for the new game
 * @param {string} [options.gameMode='hotseat'] - Game mode: 'hotseat' (default) or 'byod'
 * @returns {Promise<string>} - The generated game code
 * @throws {Error} If code generation or storage fails
 */
export async function createNewGame(storageType = 'local', options = {}) {
  const operation = 'createNewGame';
  
  // Extract options with defaults
  const { gameMode = 'hotseat' } = options;
  
  // Validate gameMode
  if (gameMode !== 'hotseat' && gameMode !== 'byod') {
    throw new Error(`Invalid gameMode: ${gameMode}. Must be 'hotseat' or 'byod'.`);
  }
  
  try {
    const adapter = getAdapter(storageType);
    const code = await generateUniqueGameCode();
    setCurrentGameCode(code, storageType);
    
    // Initialize metadata with lastModified timestamp and gameMode
    const metadata = {
      lastModified: new Date().toISOString(), // ISO 8601 format for cloud compatibility
      gameMode: gameMode
    };
    
    // Save empty initial state to create the game record
    // We'll save an empty state initially - the actual game state will be saved when the game starts
    // For now, we just need to create the metadata entry
    // Since the adapter expects state, we'll create a minimal valid state
    const initialState = {
      G: { contracts: [], players: [], independentRailroads: [] },
      ctx: { phase: 'setup', currentPlayer: '0', numPlayers: 3, playOrder: ['0'], playOrderPos: 0, turn: 0 }
    };
    
    await adapter.saveGame(code, initialState, metadata);
    
    console.info(`[${operation}] Created new game with code:`, code, `(storage: ${storageType}, mode: ${gameMode})`);
    return code;
  } catch (e) {
    console.error(`[${operation}] Failed to create new game:`, e.message);
    console.error(`[${operation}] Error details:`, e);
    throw e;
  }
}

// Cache for storing last known last_modified timestamps per game
// Used for optimistic locking in conflict resolution
const lastModifiedCache = new Map();

/**
 * Save game state to storage with conflict resolution support
 * Stores state in format: { G: {...}, ctx: {...} }
 * Updates lastModified timestamp in metadata
 * @param {string} code - Game code
 * @param {Object} G - Game state
 * @param {Object} ctx - Game context
 * @param {string} [storageType] - Optional storage type ('local' or 'cloud'). If not provided, tries to detect from current game.
 * @returns {Promise<boolean>} - True if saved successfully
 */
export async function saveGameState(code, G, ctx, storageType = null) {
  const operation = 'saveGameState';
  
  if (!isValidGameCode(code)) {
    console.error(`[${operation}] Invalid game code format:`, code);
    return false;
  }

  const normalizedCode = normalizeGameCode(code);
  
  try {
    // Validate input state
    if (!G || typeof G !== 'object') {
      console.error(`[${operation}] Invalid G parameter for game "${normalizedCode}": expected object, got ${typeof G}`);
      return false;
    }
    
    if (!ctx || typeof ctx !== 'object') {
      console.error(`[${operation}] Invalid ctx parameter for game "${normalizedCode}": expected object, got ${typeof ctx}`);
      return false;
    }
    
    // Prepare state object
    const state = { G, ctx };
    
    // Prepare metadata with lastModified timestamp
    const metadata = {
      lastModified: new Date().toISOString() // ISO 8601 format for cloud compatibility
    };
    
    // Determine storage type if not provided
    let adapterStorageType = storageType;
    if (!adapterStorageType) {
      // Try to detect from current game codes
      const localCode = localStorage.getItem(CURRENT_GAME_LOCAL_KEY);
      const cloudCode = localStorage.getItem(CURRENT_GAME_CLOUD_KEY);
      if (cloudCode === normalizedCode) {
        adapterStorageType = 'cloud';
      } else if (localCode === normalizedCode) {
        adapterStorageType = 'local';
      } else {
        // Default to local for backward compatibility
        adapterStorageType = 'local';
      }
    }
    
    // Save using adapter
    const adapter = getAdapter(adapterStorageType);
    
    // For Supabase adapter, use optimistic locking with expectedLastModified
    // Use cached value if available and recent, but let saveGame() fetch fresh for actual comparison
    // This avoids race conditions from separate timestamp queries
    let expectedLastModified = null;
    if (adapter.getLastModified && typeof adapter.getLastModified === 'function') {
      // Use cached value as a hint, but only if it's recent (within last 30 seconds)
      // Stale cache values can cause false conflict warnings
      const cachedTimestamp = lastModifiedCache.get(normalizedCode);
      if (cachedTimestamp) {
        const cacheAge = Date.now() - new Date(cachedTimestamp).getTime();
        // Only use cache if it's less than 30 seconds old
        // Older cache values are likely stale and will cause false conflicts
        if (cacheAge < 30000) {
          expectedLastModified = cachedTimestamp;
        }
        // If cache is stale, pass null to skip conflict detection (prevents false positives)
      }
    }
    
    const result = await adapter.saveGame(normalizedCode, state, metadata, expectedLastModified);
    
    // Handle both boolean (localStorage) and object (Supabase) return formats
    let success = false;
    let hadConflict = false;
    
    if (typeof result === 'boolean') {
      success = result;
    } else if (result && typeof result === 'object') {
      success = result.success === true;
      hadConflict = result.conflict === true;
      
      // Update cache immediately with the timestamp we just set (optimistic update)
      // This prevents race conditions when multiple saves happen in quick succession
      if (success && result.lastModified) {
        lastModifiedCache.set(normalizedCode, result.lastModified);
      } else if (success && adapter.getLastModified) {
        // Fallback: fetch if not provided (for backward compatibility)
        const newLastModified = await adapter.getLastModified(normalizedCode);
        if (newLastModified) {
          lastModifiedCache.set(normalizedCode, newLastModified);
        }
      }
    }
    
    if (hadConflict) {
      console.warn(`[${operation}] Save completed with conflict resolution (last-write-wins) for game "${normalizedCode}"`);
    }
    
    return success;
  } catch (e) {
    console.error(`[${operation}] Unexpected error saving state for game "${normalizedCode}":`, e.message);
    console.error(`[${operation}] Error details:`, e);
    console.error(`[${operation}] Stack trace:`, e.stack);
    return false;
  }
}

/**
 * Clear the last_modified cache for a game (useful after loading fresh state)
 * @param {string} code - Game code
 */
export function clearLastModifiedCache(code) {
  if (isValidGameCode(code)) {
    const normalizedCode = normalizeGameCode(code);
    lastModifiedCache.delete(normalizedCode);
  }
}

/**
 * Update the last_modified cache for a game with a new timestamp
 * @param {string} code - Game code
 * @param {string} lastModified - New last_modified timestamp
 */
export function updateLastModifiedCache(code, lastModified) {
  if (isValidGameCode(code) && lastModified) {
    const normalizedCode = normalizeGameCode(code);
    lastModifiedCache.set(normalizedCode, lastModified);
  }
}

/**
 * Load game state from storage
 * Returns state in the format: { G: {...}, ctx: {...} }
 * Also updates the last_modified cache for conflict resolution
 * @param {string} code - Game code
 * @param {string} [storageType] - Optional storage type ('local' or 'cloud'). If not provided, tries both.
 * @returns {Promise<{G: Object, ctx: Object}|null>} - Game state or null if not found/invalid
 */
export async function loadGameState(code, storageType = null) {
  const operation = 'loadGameState';
  
  if (!isValidGameCode(code)) {
    console.error(`[${operation}] Invalid game code format:`, code);
    return null;
  }

  const normalizedCode = normalizeGameCode(code);
  
  try {
    if (storageType) {
      // Load from specific storage type
      const adapter = getAdapter(storageType);
      const state = await adapter.loadGame(normalizedCode);
      
      // Update last_modified cache after loading (for Supabase adapter)
      if (state && adapter.getLastModified && typeof adapter.getLastModified === 'function') {
        const lastModified = await adapter.getLastModified(normalizedCode);
        if (lastModified) {
          lastModifiedCache.set(normalizedCode, lastModified);
        }
      }
      
      return state;
    } else {
      // Try both storage types (for backward compatibility)
      const localAdapter = getAdapter('local');
      const cloudAdapter = getAdapter('cloud');
      
      // Try cloud first (newer), then local
      let state = await cloudAdapter.loadGame(normalizedCode);
      if (state) {
        // Update cache
        if (cloudAdapter.getLastModified && typeof cloudAdapter.getLastModified === 'function') {
          const lastModified = await cloudAdapter.getLastModified(normalizedCode);
          if (lastModified) {
            lastModifiedCache.set(normalizedCode, lastModified);
          }
        }
        return state;
      }
      
      state = await localAdapter.loadGame(normalizedCode);
      // Note: localStorage adapter doesn't have getLastModified, so no cache update needed
      return state;
    }
  } catch (e) {
    console.error(`[${operation}] Unexpected error loading state for game "${normalizedCode}":`, e.message);
    console.error(`[${operation}] Error details:`, e);
    console.error(`[${operation}] Stack trace:`, e.stack);
    return null;
  }
}
