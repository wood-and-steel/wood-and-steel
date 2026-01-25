/**
 * Game Manager - Handles multiple game instances with unique four-letter codes
 * Works with Zustand store state persistence
 * Uses localStorage with a format compatible with legacy saved games
 */

import { serializeState, deserializeState, isValidSerializedState } from './stateSerialization';

// Storage keys - using legacy format for backward compatibility with existing saved games
const GAME_STATE_KEY = 'game_state';
const GAME_METADATA_KEY = 'game_metadata';
const GAME_INITIAL_KEY = 'game_initial';
const CURRENT_GAME_KEY = 'current_game';

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
 * @returns {string} - Unique game code
 */
export function generateUniqueGameCode() {
  const existingCodes = listGameCodes();
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
 * Get all game storage data from localStorage
 * @param {string} key - Storage key (state, metadata, or initial)
 * @returns {Map} - Map of game code to data
 */
function getGameData(key) {
  try {
    const data = localStorage.getItem(key);
    if (!data) {
      return new Map();
    }
    
    try {
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) {
        console.error(`[getGameData] Invalid data format for key "${key}": expected array, got ${typeof parsed}`);
        // Attempt recovery: clear corrupted data
        localStorage.removeItem(key);
        return new Map();
      }
      return new Map(parsed);
    } catch (parseError) {
      console.error(`[getGameData] Failed to parse JSON for key "${key}":`, parseError.message);
      console.error(`[getGameData] Corrupted data (first 200 chars):`, data.substring(0, 200));
      // Attempt recovery: clear corrupted data
      try {
        localStorage.removeItem(key);
        console.warn(`[getGameData] Cleared corrupted data for key "${key}"`);
      } catch (removeError) {
        console.error(`[getGameData] Failed to clear corrupted data for key "${key}":`, removeError.message);
      }
      return new Map();
    }
  } catch (e) {
    console.error(`[getGameData] Unexpected error accessing localStorage for key "${key}":`, e.message);
    console.error(`[getGameData] Error details:`, e);
    return new Map();
  }
}

/**
 * Set game storage data in localStorage
 * @param {string} key - Storage key (state, metadata, or initial)
 * @param {Map} dataMap - Map of game code to data
 * @returns {boolean} - True if saved successfully
 */
function setGameData(key, dataMap) {
  try {
    if (!(dataMap instanceof Map)) {
      console.error(`[setGameData] Invalid dataMap type for key "${key}": expected Map, got ${typeof dataMap}`);
      return false;
    }
    
    const serialized = JSON.stringify(Array.from(dataMap.entries()));
    
    // Check localStorage quota (rough estimate)
    const currentSize = new Blob([serialized]).size;
    if (currentSize > 5 * 1024 * 1024) { // 5MB warning
      console.warn(`[setGameData] Large data size for key "${key}": ${(currentSize / 1024 / 1024).toFixed(2)}MB`);
    }
    
    localStorage.setItem(key, serialized);
    return true;
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      console.error(`[setGameData] Storage quota exceeded for key "${key}"`);
      console.error(`[setGameData] Attempting to free space by clearing old games...`);
      // Could implement cleanup logic here if needed
    } else {
      console.error(`[setGameData] Failed to save data for key "${key}":`, e.message);
      console.error(`[setGameData] Error details:`, e);
    }
    return false;
  }
}

/**
 * Switch to a different game by updating the active game code
 * @param {string} code - Game code to switch to
 * @returns {boolean} - True if switched successfully
 */
export function switchToGame(code) {
  const operation = 'switchToGame';
  
  if (!isValidGameCode(code)) {
    console.error(`[${operation}] Invalid game code format:`, code);
    return false;
  }
  
  const normalizedCode = normalizeGameCode(code);
  
  try {
    // Check if game exists
    if (!gameExists(normalizedCode)) {
      console.warn(`[${operation}] Game not found:`, normalizedCode);
      return false;
    }
    
    // Set as current game
    setCurrentGameCode(normalizedCode);
    return true;
  } catch (e) {
    console.error(`[${operation}] Unexpected error switching to game "${normalizedCode}":`, e.message);
    console.error(`[${operation}] Error details:`, e);
    return false;
  }
}

/**
 * Delete a game from localStorage
 * Removes all game data for this game code
 * @param {string} code - Game code
 * @returns {boolean} - True if deleted, false if not found
 */
export function deleteGame(code) {
  const operation = 'deleteGame';
  
  if (!isValidGameCode(code)) {
    console.error(`[${operation}] Invalid game code format:`, code);
    return false;
  }
  
  const normalizedCode = normalizeGameCode(code);
  
  try {
    if (!gameExists(normalizedCode)) {
      console.warn(`[${operation}] Game not found:`, normalizedCode);
      return false;
    }
    
    // Remove from all three storage keys
    const stateMap = getGameData(GAME_STATE_KEY);
    const metadataMap = getGameData(GAME_METADATA_KEY);
    const initialMap = getGameData(GAME_INITIAL_KEY);
    
    const hadState = stateMap.delete(normalizedCode);
    metadataMap.delete(normalizedCode);
    initialMap.delete(normalizedCode);
    
    // Save changes, checking for errors
    const stateSaved = setGameData(GAME_STATE_KEY, stateMap);
    const metadataSaved = setGameData(GAME_METADATA_KEY, metadataMap);
    const initialSaved = setGameData(GAME_INITIAL_KEY, initialMap);
    
    if (!stateSaved || !metadataSaved || !initialSaved) {
      console.error(`[${operation}] Failed to save some data after deletion for game:`, normalizedCode);
      console.error(`[${operation}] State saved: ${stateSaved}, Metadata saved: ${metadataSaved}, Initial saved: ${initialSaved}`);
      // Still return true if at least state was deleted
      return hadState;
    }
    
    return true;
  } catch (e) {
    console.error(`[${operation}] Unexpected error deleting game "${normalizedCode}":`, e.message);
    console.error(`[${operation}] Error details:`, e);
    return false;
  }
}

/**
 * List all game codes
 * @returns {string[]} - Array of game codes
 */
export function listGameCodes() {
  const codes = [];
  const stateMap = getGameData(GAME_STATE_KEY);
  
  for (const [matchID] of stateMap) {
    // Only include valid game codes
    if (isValidGameCode(matchID)) {
      codes.push(matchID);
    }
  }
  
  return codes.sort();
}

/**
 * Check if a game exists
 * @param {string} code - Game code
 * @returns {boolean} - True if game exists
 */
export function gameExists(code) {
  if (!isValidGameCode(code)) {
    return false;
  }
  
  const normalizedCode = normalizeGameCode(code);
  const stateMap = getGameData(GAME_STATE_KEY);
  
  return stateMap.has(normalizedCode);
}

/**
 * Get the current active game code
 * @returns {string|null} - Current game code or null
 */
export function getCurrentGameCode() {
  return localStorage.getItem(CURRENT_GAME_KEY);
}

/**
 * Set the current active game code
 * @param {string} code - Game code to set as current
 * @throws {Error} If game code is invalid or storage fails
 */
export function setCurrentGameCode(code) {
  const operation = 'setCurrentGameCode';
  
  if (!isValidGameCode(code)) {
    const error = new Error(`Invalid game code format: ${code}`);
    console.error(`[${operation}]`, error.message);
    throw error;
  }
  
  const normalizedCode = normalizeGameCode(code);
  
  try {
    localStorage.setItem(CURRENT_GAME_KEY, normalizedCode);
  } catch (e) {
    const error = new Error(`Failed to set current game code: ${e.message}`);
    console.error(`[${operation}]`, error.message);
    console.error(`[${operation}] Error details:`, e);
    throw error;
  }
}

/**
 * Clear the current game code
 */
export function clearCurrentGameCode() {
  localStorage.removeItem(CURRENT_GAME_KEY);
}

/**
 * Get all games with their codes and basic info
 * Sorted by lastModified descending (most recent first)
 * @returns {Array<{code: string, phase: string, turn: number, numPlayers: number, lastModified: string, playerNames: Array<string>, metadata: Object}>} - Array of game info
 */
export function listGames() {
  const operation = 'listGames';
  
  try {
    const codes = listGameCodes();
    const games = [];
    
    const stateMap = getGameData(GAME_STATE_KEY);
    const metadataMap = getGameData(GAME_METADATA_KEY);
    
    for (const code of codes) {
      try {
        const state = stateMap.get(code);
        const metadata = metadataMap.get(code) || {};
        
        if (state) {
          // Extract player names from the game state
          const playerNames = state.G?.players?.map(([id, player]) => player.name) || [];
          
          games.push({
            code: code,
            phase: state.ctx?.phase || 'unknown',
            turn: state.ctx?.turn || 0,
            numPlayers: state.ctx?.numPlayers || 0,
            lastModified: metadata.lastModified || new Date(0).toISOString(), // Default to epoch if missing
            playerNames: playerNames,
            metadata: metadata
          });
        }
      } catch (e) {
        console.warn(`[${operation}] Error processing game "${code}":`, e.message);
        // Continue processing other games
      }
    }
    
    // Sort by lastModified descending (most recent first)
    return games.sort((a, b) => {
      const timeA = new Date(a.lastModified).getTime();
      const timeB = new Date(b.lastModified).getTime();
      return timeB - timeA; // Descending order
    });
  } catch (e) {
    console.error(`[${operation}] Unexpected error listing games:`, e.message);
    console.error(`[${operation}] Error details:`, e);
    return [];
  }
}

/**
 * Create a new game with a unique code
 * Sets initial lastModified timestamp in metadata
 * @returns {string} - The generated game code
 * @throws {Error} If code generation or storage fails
 */
export function createNewGame() {
  const operation = 'createNewGame';
  
  try {
    const code = generateUniqueGameCode();
    setCurrentGameCode(code);
    
    // Set initial lastModified timestamp in metadata
    const metadataMap = getGameData(GAME_METADATA_KEY);
    metadataMap.set(code, {
      lastModified: new Date().toISOString() // ISO 8601 format for cloud compatibility
    });
    setGameData(GAME_METADATA_KEY, metadataMap);
    
    console.info(`[${operation}] Created new game with code:`, code);
    return code;
  } catch (e) {
    console.error(`[${operation}] Failed to create new game:`, e.message);
    console.error(`[${operation}] Error details:`, e);
    throw e;
  }
}

/**
 * Save game state to localStorage
 * Stores state in format: { G: {...}, ctx: {...} }
 * Updates lastModified timestamp in metadata
 * @param {string} code - Game code
 * @param {Object} G - Game state
 * @param {Object} ctx - Game context
 * @returns {boolean} - True if saved successfully
 */
export function saveGameState(code, G, ctx) {
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
    
    // Get existing state map
    const stateMap = getGameData(GAME_STATE_KEY);
    
    // Serialize state using serialization utilities
    // This ensures proper deep cloning and filtering of internal properties
    let serialized;
    try {
      serialized = serializeState(G, ctx);
    } catch (serializeError) {
      console.error(`[${operation}] Serialization failed for game "${normalizedCode}":`, serializeError.message);
      console.error(`[${operation}] Serialization error details:`, serializeError);
      return false;
    }
    
    stateMap.set(normalizedCode, serialized);
    
    const saved = setGameData(GAME_STATE_KEY, stateMap);
    if (!saved) {
      console.error(`[${operation}] Failed to persist state to localStorage for game "${normalizedCode}"`);
      return false;
    }
    
    // Update lastModified timestamp in metadata
    const metadataMap = getGameData(GAME_METADATA_KEY);
    const existingMetadata = metadataMap.get(normalizedCode) || {};
    metadataMap.set(normalizedCode, {
      ...existingMetadata,
      lastModified: new Date().toISOString() // ISO 8601 format for cloud compatibility
    });
    setGameData(GAME_METADATA_KEY, metadataMap);
    
    return true;
  } catch (e) {
    console.error(`[${operation}] Unexpected error saving state for game "${normalizedCode}":`, e.message);
    console.error(`[${operation}] Error details:`, e);
    console.error(`[${operation}] Stack trace:`, e.stack);
    return false;
  }
}

/**
 * Load game state from localStorage
 * Returns state in the format: { G: {...}, ctx: {...} }
 * @param {string} code - Game code
 * @returns {{G: Object, ctx: Object}|null} - Game state or null if not found/invalid
 */
export function loadGameState(code) {
  const operation = 'loadGameState';
  
  if (!isValidGameCode(code)) {
    console.error(`[${operation}] Invalid game code format:`, code);
    return null;
  }

  const normalizedCode = normalizeGameCode(code);
  
  try {
    const stateMap = getGameData(GAME_STATE_KEY);
    const stateData = stateMap.get(normalizedCode);
    
    if (!stateData) {
      console.info(`[${operation}] No saved state found for game:`, normalizedCode);
      return null;
    }
    
    // Validate state structure before deserializing
    if (!isValidSerializedState(stateData)) {
      console.warn(`[${operation}] Invalid state format for game "${normalizedCode}"`);
      console.warn(`[${operation}] State data type:`, typeof stateData);
      console.warn(`[${operation}] State data keys:`, stateData && typeof stateData === 'object' ? Object.keys(stateData) : 'N/A');
      
      // Attempt recovery: remove corrupted state
      console.warn(`[${operation}] Attempting to remove corrupted state for game "${normalizedCode}"`);
      try {
        stateMap.delete(normalizedCode);
        setGameData(GAME_STATE_KEY, stateMap);
        console.warn(`[${operation}] Removed corrupted state for game "${normalizedCode}"`);
      } catch (recoveryError) {
        console.error(`[${operation}] Failed to remove corrupted state:`, recoveryError.message);
      }
      
      return null;
    }
    
    // Deserialize state using serialization utilities
    // This ensures clean state structure and proper deep cloning
    try {
      return deserializeState(stateData);
    } catch (deserializeError) {
      console.error(`[${operation}] Deserialization failed for game "${normalizedCode}":`, deserializeError.message);
      console.error(`[${operation}] Deserialization error details:`, deserializeError);
      
      // Attempt recovery: remove corrupted state
      console.warn(`[${operation}] Attempting to remove corrupted state after deserialization failure`);
      try {
        stateMap.delete(normalizedCode);
        setGameData(GAME_STATE_KEY, stateMap);
        console.warn(`[${operation}] Removed corrupted state for game "${normalizedCode}"`);
      } catch (recoveryError) {
        console.error(`[${operation}] Failed to remove corrupted state:`, recoveryError.message);
      }
      
      return null;
    }
  } catch (e) {
    console.error(`[${operation}] Unexpected error loading state for game "${normalizedCode}":`, e.message);
    console.error(`[${operation}] Error details:`, e);
    console.error(`[${operation}] Stack trace:`, e.stack);
    return null;
  }
}
