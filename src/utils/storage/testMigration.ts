/**
 * Test Migration Utility
 *
 * Browser console utilities for testing migration functionality.
 * Exposes functions to window in development for easy testing.
 *
 * Usage in browser console:
 *   window.testMigration?.exportFromLocalStorage()
 *   window.testMigration?.migrateToSupabase({ overwrite: true })
 *   window.testMigration?.exportToJSON().then(json => console.log(json))
 */

import {
  exportFromLocalStorage,
  importToSupabase,
  migrateLocalStorageToSupabase,
  exportToJSON,
  importFromJSON,
} from './migration';
import type { ExportedGame, ImportOptions, MigrateOptions } from './migration';

/** Migration test results. */
interface MigrateTestResult {
  exported: number;
  imported: { success: number; failed: number; skipped: number; errors: Array<{ code: string; error: string }> };
}

/** Test migration API exposed to window in development. */
export const testMigration = {
  async exportFromLocalStorage(): Promise<ExportedGame[]> {
    console.log('🧪 Testing: Export from localStorage...');
    try {
      const games = await exportFromLocalStorage();
      console.log(`✅ Exported ${games.length} games:`, games.map((g) => g.code));
      return games;
    } catch (error) {
      console.error('❌ Export failed:', error);
      throw error;
    }
  },

  async migrateToSupabase(options: MigrateOptions = {}): Promise<MigrateTestResult> {
    console.log('🧪 Testing: Migrate localStorage to Supabase...');
    try {
      const results = await migrateLocalStorageToSupabase({
        ...options,
        onProgress: (current, total, code, phase) => {
          console.log(`📦 ${phase}: ${current}/${total}${code ? ` - ${code}` : ''}`);
        },
      });
      console.log('✅ Migration complete:', results);
      return results;
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async exportToJSON(): Promise<string> {
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

  async importFromJSON(jsonString: string, options: ImportOptions = {}): Promise<ReturnType<typeof importToSupabase>> {
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

  async testRealtimeSync(testCode: string | null = null): Promise<() => void> {
    console.log('🧪 Testing: Real-time sync...');

    const { getStorageAdapter } = await import('./index');
    const { generateGameCode } = await import('../gameManager');

    const code = testCode ?? generateGameCode();
    const adapter = getStorageAdapter();

    if (typeof adapter.subscribeToGame !== 'function') {
      console.warn('⚠️ Current storage adapter does not support real-time subscriptions');
      return () => {};
    }

    console.log(`📡 Subscribing to game: ${code}`);

    const unsubscribe = adapter.subscribeToGame(code, (state, _metadata) => {
      console.log('🔄 Real-time update received:', {
        code,
        phase: state?.ctx?.phase,
        turn: state?.ctx?.turn,
        timestamp: new Date().toISOString(),
      });
    });

    console.log('✅ Real-time subscription active. Updates will be logged to console.');
    console.log('💡 Call the returned function to unsubscribe.');

    return unsubscribe;
  },
};

declare global {
  interface Window {
    testMigration?: typeof testMigration;
  }
}

if (typeof window !== 'undefined' && !import.meta.env.PROD) {
  window.testMigration = testMigration;
  console.log('🧪 Migration test utilities available:');
  console.log('  - window.testMigration.exportFromLocalStorage()');
  console.log('  - window.testMigration.migrateToSupabase({ overwrite: true })');
  console.log('  - window.testMigration.exportToJSON()');
  console.log('  - window.testMigration.importFromJSON(jsonString)');
  console.log('  - window.testMigration.testRealtimeSync(code)');
}
