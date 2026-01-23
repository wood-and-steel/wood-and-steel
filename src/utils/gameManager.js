/**
 * Game Manager - Handles multiple game instances with unique four-letter codes
 * Works with Zustand store state persistence
 * Uses localStorage with a format compatible with legacy saved games
 */

import { serializeState, deserializeState, isValidSerializedState } from './stateSerialization';

// Storage keys - using legacy format for backward compatibility with existing saved games
const BGIO_STATE_KEY = 'bgio_state';
const BGIO_METADATA_KEY = 'bgio_metadata';
const BGIO_INITIAL_KEY = 'bgio_initial';
const CURRENT_GAME_KEY = 'bgio_current_game';

/**
 * Generate a random four-letter code (A-Z)
 * @returns {string} - Four-letter uppercase code
 */
export function generateGameCode() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return code;
}

/**
 * Generate a unique four-letter code that doesn't exist in current games
 * @returns {string} - Unique four-letter uppercase code
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
 * Validate game code format (exactly 4 letters A-Z, case-insensitive)
 * @param {string} code - Game code to validate
 * @returns {boolean} - True if valid format
 */
export function isValidGameCode(code) {
  if (!code) return false;
  const normalized = normalizeGameCode(code);
  return /^[A-Z]{4}$/.test(normalized);
}

/**
 * Get all game storage data from localStorage
 * @param {string} key - Storage key (state, metadata, or initial)
 * @returns {Map} - Map of game code to data
 */
function getBgioData(key) {
  try {
    const data = localStorage.getItem(key);
    if (!data) {
      return new Map();
    }
    
    try {
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) {
        console.error(`[getBgioData] Invalid data format for key "${key}": expected array, got ${typeof parsed}`);
        // Attempt recovery: clear corrupted data
        localStorage.removeItem(key);
        return new Map();
      }
      return new Map(parsed);
    } catch (parseError) {
      console.error(`[getBgioData] Failed to parse JSON for key "${key}":`, parseError.message);
      console.error(`[getBgioData] Corrupted data (first 200 chars):`, data.substring(0, 200));
      // Attempt recovery: clear corrupted data
      try {
        localStorage.removeItem(key);
        console.warn(`[getBgioData] Cleared corrupted data for key "${key}"`);
      } catch (removeError) {
        console.error(`[getBgioData] Failed to clear corrupted data for key "${key}":`, removeError.message);
      }
      return new Map();
    }
  } catch (e) {
    console.error(`[getBgioData] Unexpected error accessing localStorage for key "${key}":`, e.message);
    console.error(`[getBgioData] Error details:`, e);
    return new Map();
  }
}

/**
 * Set game storage data in localStorage
 * @param {string} key - Storage key (state, metadata, or initial)
 * @param {Map} dataMap - Map of game code to data
 * @returns {boolean} - True if saved successfully
 */
function setBgioData(key, dataMap) {
  try {
    if (!(dataMap instanceof Map)) {
      console.error(`[setBgioData] Invalid dataMap type for key "${key}": expected Map, got ${typeof dataMap}`);
      return false;
    }
    
    const serialized = JSON.stringify(Array.from(dataMap.entries()));
    
    // Check localStorage quota (rough estimate)
    const currentSize = new Blob([serialized]).size;
    if (currentSize > 5 * 1024 * 1024) { // 5MB warning
      console.warn(`[setBgioData] Large data size for key "${key}": ${(currentSize / 1024 / 1024).toFixed(2)}MB`);
    }
    
    localStorage.setItem(key, serialized);
    return true;
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      console.error(`[setBgioData] Storage quota exceeded for key "${key}"`);
      console.error(`[setBgioData] Attempting to free space by clearing old games...`);
      // Could implement cleanup logic here if needed
    } else {
      console.error(`[setBgioData] Failed to save data for key "${key}":`, e.message);
      console.error(`[setBgioData] Error details:`, e);
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
    const stateMap = getBgioData(BGIO_STATE_KEY);
    const metadataMap = getBgioData(BGIO_METADATA_KEY);
    const initialMap = getBgioData(BGIO_INITIAL_KEY);
    
    const hadState = stateMap.delete(normalizedCode);
    metadataMap.delete(normalizedCode);
    initialMap.delete(normalizedCode);
    
    // Save changes, checking for errors
    const stateSaved = setBgioData(BGIO_STATE_KEY, stateMap);
    const metadataSaved = setBgioData(BGIO_METADATA_KEY, metadataMap);
    const initialSaved = setBgioData(BGIO_INITIAL_KEY, initialMap);
    
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
  const stateMap = getBgioData(BGIO_STATE_KEY);
  
  for (const [matchID] of stateMap) {
    // Only include valid 4-letter codes
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
  const stateMap = getBgioData(BGIO_STATE_KEY);
  
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
 * @returns {Array<{code: string, phase: string, players: any}>} - Array of game info
 */
export function listGames() {
  const operation = 'listGames';
  
  try {
    const codes = listGameCodes();
    const games = [];
    
    const stateMap = getBgioData(BGIO_STATE_KEY);
    const metadataMap = getBgioData(BGIO_METADATA_KEY);
    
    for (const code of codes) {
      try {
        const state = stateMap.get(code);
        const metadata = metadataMap.get(code);
        
        if (state) {
          // Extract player names from the game state
          const playerNames = state.G?.players?.map(([id, player]) => player.name) || [];
          
          games.push({
            code: code,
            phase: state.ctx?.phase || 'unknown',
            turn: state.ctx?.turn || 0,
            numPlayers: state.ctx?.numPlayers || 0,
            playerNames: playerNames,
            metadata: metadata || {}
          });
        }
      } catch (e) {
        console.warn(`[${operation}] Error processing game "${code}":`, e.message);
        // Continue processing other games
      }
    }
    
    return games.sort((a, b) => a.code.localeCompare(b.code));
  } catch (e) {
    console.error(`[${operation}] Unexpected error listing games:`, e.message);
    console.error(`[${operation}] Error details:`, e);
    return [];
  }
}

/**
 * Create a new game with a unique code
 * @returns {string} - The generated game code
 * @throws {Error} If code generation or storage fails
 */
export function createNewGame() {
  const operation = 'createNewGame';
  
  try {
    const code = generateUniqueGameCode();
    setCurrentGameCode(code);
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
    const stateMap = getBgioData(BGIO_STATE_KEY);
    
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
    
    const saved = setBgioData(BGIO_STATE_KEY, stateMap);
    if (!saved) {
      console.error(`[${operation}] Failed to persist state to localStorage for game "${normalizedCode}"`);
      return false;
    }
    
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
    const stateMap = getBgioData(BGIO_STATE_KEY);
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
        setBgioData(BGIO_STATE_KEY, stateMap);
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
        setBgioData(BGIO_STATE_KEY, stateMap);
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
