/**
 * Migration Utility
 * 
 * Tools for migrating games between storage backends.
 * Supports exporting from localStorage and importing to Supabase.
 */

import { LocalStorageAdapter } from './localStorageAdapter';
import { SupabaseAdapter } from './supabaseAdapter';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../config/storage';

/**
 * Export all games from localStorage
 * 
 * @returns {Promise<Array<{code: string, state: Object, metadata: Object}>>} - Array of exported games
 */
export async function exportFromLocalStorage() {
  console.info('[Migration] Starting export from localStorage...');
  
  const adapter = new LocalStorageAdapter();
  const games = await adapter.listGames();
  
  const exportedGames = [];
  
  for (const gameInfo of games) {
    try {
      // Load the game state (this will deserialize it properly)
      const state = await adapter.loadGame(gameInfo.code);
      if (state && state.G && state.ctx) {
        exportedGames.push({
          code: gameInfo.code,
          state: state, // Already deserialized by loadGame
          metadata: {
            ...gameInfo.metadata,
            // Preserve lastModified from gameInfo if available
            lastModified: gameInfo.lastModified || gameInfo.metadata?.lastModified || new Date().toISOString()
          }
        });
        console.info(`[Migration] Exported game: ${gameInfo.code}`);
      } else {
        console.warn(`[Migration] Skipped game ${gameInfo.code}: invalid state structure`);
      }
    } catch (error) {
      console.error(`[Migration] Error exporting game ${gameInfo.code}:`, error.message);
    }
  }
  
  console.info(`[Migration] Export complete: ${exportedGames.length} games exported`);
  return exportedGames;
}

/**
 * Import games to Supabase
 * 
 * @param {Array<{code: string, state: Object, metadata: Object}>} games - Array of games to import
 * @param {Object} options - Import options
 * @param {boolean} options.overwrite - If true, overwrite existing games (default: false)
 * @param {Function} options.onProgress - Optional progress callback: (current, total, code) => void
 * @returns {Promise<{success: number, failed: number, skipped: number, errors: Array<{code: string, error: string}>}>} - Import results
 */
export async function importToSupabase(games, options = {}) {
  const { overwrite = false, onProgress } = options;
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase configuration is required. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.');
  }
  
  console.info(`[Migration] Starting import to Supabase (${games.length} games)...`);
  
  const adapter = new SupabaseAdapter(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  let success = 0;
  let failed = 0;
  let skipped = 0;
  const errors = [];
  
  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    
    try {
      if (onProgress) {
        onProgress(i + 1, games.length, game.code);
      }
      
      // Check if game already exists
      const exists = await adapter.gameExists(game.code);
      
      if (exists && !overwrite) {
        console.warn(`[Migration] Skipped game ${game.code}: already exists (use overwrite=true to replace)`);
        skipped++;
        continue;
      }
      
      // Import the game
      const result = await adapter.saveGame(game.code, game.state, game.metadata);
      
      // Handle both boolean and object return formats
      const saved = typeof result === 'boolean' ? result : (result && result.success === true);
      
      if (saved) {
        console.info(`[Migration] Imported game: ${game.code}`);
        success++;
      } else {
        console.error(`[Migration] Failed to import game: ${game.code}`);
        failed++;
        errors.push({
          code: game.code,
          error: 'Save operation returned false'
        });
      }
    } catch (error) {
      console.error(`[Migration] Error importing game ${game.code}:`, error.message);
      failed++;
      errors.push({
        code: game.code,
        error: error.message
      });
    }
  }
  
  console.info(`[Migration] Import complete: ${success} succeeded, ${failed} failed, ${skipped} skipped`);
  
  return {
    success,
    failed,
    skipped,
    errors
  };
}

/**
 * Migrate all games from localStorage to Supabase
 * 
 * This is a convenience function that combines export and import.
 * 
 * @param {Object} options - Migration options
 * @param {boolean} options.overwrite - If true, overwrite existing games in Supabase (default: false)
 * @param {Function} options.onProgress - Optional progress callback: (current, total, code, phase) => void
 * @returns {Promise<{exported: number, imported: {success: number, failed: number, skipped: number, errors: Array}}>} - Migration results
 */
export async function migrateLocalStorageToSupabase(options = {}) {
  const { onProgress } = options;
  
  console.info('[Migration] Starting migration from localStorage to Supabase...');
  
  // Phase 1: Export from localStorage
  if (onProgress) {
    onProgress(0, 0, null, 'exporting');
  }
  
  const exportedGames = await exportFromLocalStorage();
  
  if (exportedGames.length === 0) {
    console.warn('[Migration] No games found in localStorage to migrate');
    return {
      exported: 0,
      imported: {
        success: 0,
        failed: 0,
        skipped: 0,
        errors: []
      }
    };
  }
  
  // Phase 2: Import to Supabase
  if (onProgress) {
    onProgress(0, exportedGames.length, null, 'importing');
  }
  
  const importResults = await importToSupabase(exportedGames, {
    overwrite: options.overwrite,
    onProgress: (current, total, code) => {
      if (onProgress) {
        onProgress(current, total, code, 'importing');
      }
    }
  });
  
  console.info('[Migration] Migration complete');
  
  return {
    exported: exportedGames.length,
    imported: importResults
  };
}

/**
 * Export games to JSON file (for backup or manual migration)
 * 
 * @returns {Promise<string>} - JSON string of exported games
 */
export async function exportToJSON() {
  const games = await exportFromLocalStorage();
  return JSON.stringify(games, null, 2);
}

/**
 * Import games from JSON string
 * 
 * @param {string} jsonString - JSON string containing games array
 * @param {Object} options - Import options (same as importToSupabase)
 * @returns {Promise<{success: number, failed: number, skipped: number, errors: Array}>} - Import results
 */
export async function importFromJSON(jsonString, options = {}) {
  try {
    const games = JSON.parse(jsonString);
    
    if (!Array.isArray(games)) {
      throw new Error('JSON must contain an array of games');
    }
    
    return await importToSupabase(games, options);
  } catch (error) {
    throw new Error(`Failed to parse JSON: ${error.message}`);
  }
}
