/**
 * Migration Utility
 *
 * Tools for migrating games between storage backends.
 * Supports exporting from localStorage and importing to Supabase.
 */

import { LocalStorageAdapter } from './localStorageAdapter';
import { SupabaseAdapter } from './supabaseAdapter';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../config/storage';
import type { StoredGameState } from './storageAdapter';
import type { GameListItem } from './storageAdapter';

/** Single exported game for migration. */
export interface ExportedGame {
  code: string;
  state: StoredGameState;
  metadata: Record<string, unknown>;
}

/** Options for importToSupabase. */
export interface ImportOptions {
  overwrite?: boolean;
  onProgress?: (current: number, total: number, code: string) => void;
}

/** Result of importToSupabase / importFromJSON. */
export interface ImportResult {
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ code: string; error: string }>;
}

/** Options for migrateLocalStorageToSupabase. */
export interface MigrateOptions {
  overwrite?: boolean;
  onProgress?: (current: number, total: number, code: string | null, phase: 'exporting' | 'importing') => void;
}

/** Result of migrateLocalStorageToSupabase. */
export interface MigrateResult {
  exported: number;
  imported: ImportResult;
}

export async function exportFromLocalStorage(): Promise<ExportedGame[]> {
  console.info('[Migration] Starting export from localStorage...');

  const adapter = new LocalStorageAdapter();
  const games: GameListItem[] = await adapter.listGames();
  const exportedGames: ExportedGame[] = [];

  for (const gameInfo of games) {
    try {
      const state = await adapter.loadGame(gameInfo.code);
      if (state?.G && state?.ctx) {
        const meta = gameInfo.metadata || {};
        exportedGames.push({
          code: gameInfo.code,
          state,
          metadata: {
            ...meta,
            lastModified:
              gameInfo.lastModified ||
              (meta.lastModified as string) ||
              new Date().toISOString(),
          },
        });
        console.info(`[Migration] Exported game: ${gameInfo.code}`);
      } else {
        console.warn(`[Migration] Skipped game ${gameInfo.code}: invalid state structure`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[Migration] Error exporting game ${gameInfo.code}:`, msg);
    }
  }

  console.info(`[Migration] Export complete: ${exportedGames.length} games exported`);
  return exportedGames;
}

export async function importToSupabase(
  games: ExportedGame[],
  options: ImportOptions = {}
): Promise<ImportResult> {
  const { overwrite = false, onProgress } = options;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Supabase configuration is required. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.'
    );
  }

  console.info(`[Migration] Starting import to Supabase (${games.length} games)...`);

  const adapter = new SupabaseAdapter(SUPABASE_URL, SUPABASE_ANON_KEY);

  let success = 0;
  let failed = 0;
  let skipped = 0;
  const errors: Array<{ code: string; error: string }> = [];

  for (let i = 0; i < games.length; i++) {
    const game = games[i];

    try {
      if (onProgress) {
        onProgress(i + 1, games.length, game.code);
      }

      const exists = await adapter.gameExists(game.code);

      if (exists && !overwrite) {
        console.warn(`[Migration] Skipped game ${game.code}: already exists (use overwrite=true to replace)`);
        skipped++;
        continue;
      }

      const result = await adapter.saveGame(game.code, game.state, game.metadata);
      const saved =
        typeof result === 'boolean' ? result : (result && result.success === true);

      if (saved) {
        console.info(`[Migration] Imported game: ${game.code}`);
        success++;
      } else {
        console.error(`[Migration] Failed to import game: ${game.code}`);
        failed++;
        errors.push({ code: game.code, error: 'Save operation returned false' });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[Migration] Error importing game ${game.code}:`, msg);
      failed++;
      errors.push({ code: game.code, error: msg });
    }
  }

  console.info(`[Migration] Import complete: ${success} succeeded, ${failed} failed, ${skipped} skipped`);

  return { success, failed, skipped, errors };
}

export async function migrateLocalStorageToSupabase(
  options: MigrateOptions = {}
): Promise<MigrateResult> {
  const { onProgress } = options;

  console.info('[Migration] Starting migration from localStorage to Supabase...');

  if (onProgress) {
    onProgress(0, 0, null, 'exporting');
  }

  const exportedGames = await exportFromLocalStorage();

  if (exportedGames.length === 0) {
    console.warn('[Migration] No games found in localStorage to migrate');
    return {
      exported: 0,
      imported: { success: 0, failed: 0, skipped: 0, errors: [] },
    };
  }

  if (onProgress) {
    onProgress(0, exportedGames.length, null, 'importing');
  }

  const importResults = await importToSupabase(exportedGames, {
    overwrite: options.overwrite,
    onProgress: (current, total, code) => {
      if (onProgress) {
        onProgress(current, total, code, 'importing');
      }
    },
  });

  console.info('[Migration] Migration complete');

  return {
    exported: exportedGames.length,
    imported: importResults,
  };
}

export async function exportToJSON(): Promise<string> {
  const games = await exportFromLocalStorage();
  return JSON.stringify(games, null, 2);
}

export async function importFromJSON(
  jsonString: string,
  options: ImportOptions = {}
): Promise<ImportResult> {
  try {
    const parsed: unknown = JSON.parse(jsonString);
    if (!Array.isArray(parsed)) {
      throw new Error('JSON must contain an array of games');
    }
    const games = parsed as ExportedGame[];
    return await importToSupabase(games, options);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse JSON: ${msg}`);
  }
}
