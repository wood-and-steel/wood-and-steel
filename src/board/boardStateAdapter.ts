/**
 * Persistence for board-only state: one `board_states` row per game code
 * (SQL in src/board/supabase/board_states.sql). Saves are conditional on the row's
 * `updated_at`, so two screens editing at once can't clobber each other.
 */
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config/storage';
import {
  SupabaseJsonRowAdapter,
  type JsonRowAdapter,
  type JsonRowRecord,
  type JsonRowSaveResult,
} from './jsonRowAdapter';

export type BoardStateRecord = JsonRowRecord;
export type BoardSaveResult = JsonRowSaveResult;
export type BoardStateAdapter = JsonRowAdapter;

export const MISSING_TABLE_MESSAGE =
  'The board_states table does not exist. Apply src/board/supabase/board_states.sql in the Supabase dashboard.';

export class SupabaseBoardStateAdapter extends SupabaseJsonRowAdapter {
  constructor(url: string, anonKey: string) {
    super(url, anonKey, {
      table: 'board_states',
      channelPrefix: 'board',
      storageKey: 'wood-and-steel-board',
      missingTableMessage: MISSING_TABLE_MESSAGE,
    });
  }
}

let adapterInstance: BoardStateAdapter | null = null;

export function getBoardStateAdapter(): BoardStateAdapter {
  if (adapterInstance) return adapterInstance;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  adapterInstance = new SupabaseBoardStateAdapter(SUPABASE_URL, SUPABASE_ANON_KEY);
  return adapterInstance;
}

/** Replace the adapter (tests use MemoryBoardStateAdapter). */
export function setBoardStateAdapter(adapter: BoardStateAdapter | null): void {
  adapterInstance = adapter;
}
