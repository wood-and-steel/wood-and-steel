/**
 * Test Migration Utility
 * 
 * Browser console utilities for testing migration functionality.
 * Exposes functions to window for easy testing.
 * 
 * Usage in browser console:
 *   window.testMigration.exportFromLocalStorage()
 *   window.testMigration.migrateToSupabase({ overwrite: true })
 *   window.testMigration.exportToJSON().then(json => console.log(json))
 */

import {
  exportFromLocalStorage,
  importToSupabase,
  migrateLocalStorageToSupabase,
  exportToJSON,
  importFromJSON
} from './migration';

/**
 * Test migration utilities exposed to window for console testing
 */
export const testMigration = {
  /**
   * Export all games from localStorage
   * @returns {Promise<Array>} Exported games
   */
  async exportFromLocalStorage() {
    console.log('🧪 Testing: Export from localStorage...');
    try {
      const games = await exportFromLocalStorage();
      console.log(`✅ Exported ${games.length} games:`, games.map(g => g.code));
      return games;
    } catch (error) {
      console.error('❌ Export failed:', error);
      throw error;
    }
  },

  /**
   * Migrate all games from localStorage to Supabase
   * @param {Object} options - Migration options
   * @returns {Promise<Object>} Migration results
   */
  async migrateToSupabase(options = {}) {
    console.log('🧪 Testing: Migrate localStorage to Supabase...');
    try {
      const results = await migrateLocalStorageToSupabase({
        ...options,
        onProgress: (current, total, code, phase) => {
          console.log(`📦 ${phase}: ${current}/${total}${code ? ` - ${code}` : ''}`);
        }
      });
      console.log('✅ Migration complete:', results);
      return results;
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  /**
   * Export games to JSON string
   * @returns {Promise<string>} JSON string
   */
  async exportToJSON() {
    console.log('🧪 Testing: Export to JSON...');
    try {
      const json = await exportToJSON();
      console.log('✅ JSON export complete (length:', json.length, 'chars)');
      return json;
    } catch (error) {
      console.error('❌ JSON export failed:', error);
      throw error;
    }
  },

  /**
   * Import games from JSON string
   * @param {string} jsonString - JSON string
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import results
   */
  async importFromJSON(jsonString, options = {}) {
    console.log('🧪 Testing: Import from JSON...');
    try {
      const results = await importFromJSON(jsonString, options);
      console.log('✅ JSON import complete:', results);
      return results;
    } catch (error) {
      console.error('❌ JSON import failed:', error);
      throw error;
    }
  },

  /**
   * Test real-time sync by creating a test game and watching for updates
   * @param {string} testCode - Optional test game code (default: random)
   * @returns {Promise<Function>} Unsubscribe function
   */
  async testRealtimeSync(testCode = null) {
    console.log('🧪 Testing: Real-time sync...');
    
    const { getStorageAdapter } = await import('./index');
    const { generateGameCode } = await import('../gameManager');
    
    const code = testCode || generateGameCode();
    const adapter = getStorageAdapter();
    
    if (!adapter.subscribeToGame || typeof adapter.subscribeToGame !== 'function') {
      console.warn('⚠️ Current storage adapter does not support real-time subscriptions');
      return () => {};
    }
    
    console.log(`📡 Subscribing to game: ${code}`);
    
    const unsubscribe = adapter.subscribeToGame(code, (state, metadata) => {
      console.log('🔄 Real-time update received:', {
        code,
        phase: state?.ctx?.phase,
        turn: state?.ctx?.turn,
        timestamp: new Date().toISOString()
      });
    });
    
    console.log('✅ Real-time subscription active. Updates will be logged to console.');
    console.log('💡 Call the returned function to unsubscribe.');
    
    return unsubscribe;
  }
};

// Expose to window in development
if (typeof window !== 'undefined' && !import.meta.env.PROD) {
  window.testMigration = testMigration;
  console.log('🧪 Migration test utilities available:');
  console.log('  - window.testMigration.exportFromLocalStorage()');
  console.log('  - window.testMigration.migrateToSupabase({ overwrite: true })');
  console.log('  - window.testMigration.exportToJSON()');
  console.log('  - window.testMigration.importFromJSON(jsonString)');
  console.log('  - window.testMigration.testRealtimeSync(code)');
}
