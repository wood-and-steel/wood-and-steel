/**
 * Game Manager - Handles multiple game instances with unique four-letter codes
 * Works with boardgame.io's Local multiplayer storage format
 */

// boardgame.io uses these keys with matchID as part of the data structure
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
 * Get all boardgame.io storage data
 * @param {string} key - Storage key (state, metadata, or initial)
 * @returns {Map} - Map of matchID to data
 */
function getBgioData(key) {
  const data = localStorage.getItem(key);
  if (!data) {
    return new Map();
  }
  
  try {
    const parsed = JSON.parse(data);
    return new Map(parsed);
  } catch (e) {
    console.error(`Failed to parse ${key}:`, e);
    return new Map();
  }
}

/**
 * Set boardgame.io storage data
 * @param {string} key - Storage key (state, metadata, or initial)
 * @param {Map} dataMap - Map of matchID to data
 */
function setBgioData(key, dataMap) {
  const serialized = JSON.stringify(Array.from(dataMap.entries()));
  localStorage.setItem(key, serialized);
}

/**
 * Switch to a different game by updating the active matchID to the game code
 * boardgame.io uses "default" as matchID, we'll use the game code as matchID
 * @param {string} code - Game code to switch to
 * @returns {boolean} - True if switched successfully
 */
export function switchToGame(code) {
  if (!isValidGameCode(code)) {
    return false;
  }
  
  const normalizedCode = normalizeGameCode(code);
  
  // Check if game exists
  if (!gameExists(normalizedCode)) {
    return false;
  }
  
  // Set as current game
  setCurrentGameCode(normalizedCode);
  
  return true;
}

/**
 * Delete a game from localStorage
 * Removes all boardgame.io data for this matchID
 * @param {string} code - Game code
 * @returns {boolean} - True if deleted, false if not found
 */
export function deleteGame(code) {
  if (!isValidGameCode(code)) {
    return false;
  }
  
  const normalizedCode = normalizeGameCode(code);
  
  if (!gameExists(normalizedCode)) {
    return false;
  }
  
  // Remove from all three storage keys
  const stateMap = getBgioData(BGIO_STATE_KEY);
  const metadataMap = getBgioData(BGIO_METADATA_KEY);
  const initialMap = getBgioData(BGIO_INITIAL_KEY);
  
  stateMap.delete(normalizedCode);
  metadataMap.delete(normalizedCode);
  initialMap.delete(normalizedCode);
  
  setBgioData(BGIO_STATE_KEY, stateMap);
  setBgioData(BGIO_METADATA_KEY, metadataMap);
  setBgioData(BGIO_INITIAL_KEY, initialMap);
  
  return true;
}

/**
 * List all game codes (matchIDs that are valid game codes)
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
 */
export function setCurrentGameCode(code) {
  if (!isValidGameCode(code)) {
    throw new Error('Invalid game code format');
  }
  
  localStorage.setItem(CURRENT_GAME_KEY, normalizeGameCode(code));
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
  const codes = listGameCodes();
  const games = [];
  
  const stateMap = getBgioData(BGIO_STATE_KEY);
  const metadataMap = getBgioData(BGIO_METADATA_KEY);
  
  for (const code of codes) {
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
  }
  
  return games.sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * Create a new game with a unique code
 * This initializes the game in boardgame.io's storage
 * Note: The actual game initialization is handled by boardgame.io Client
 * This just reserves the code
 * @returns {string} - The generated game code
 */
export function createNewGame() {
  const code = generateUniqueGameCode();
  setCurrentGameCode(code);
  return code;
}
