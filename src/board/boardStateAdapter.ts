/**
 * Persistence for board-only state: one `board_states` row per game code
 * (SQL in src/board/supabase/board_states.sql). Saves are conditional on the row's
 * `updated_at`, so two screens editing at once can't clobber each other.
 */
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config/storage';

export interface BoardStateRecord {
  /** Raw stored JSON; run it through normalizeBoardState before use. */
  state: unknown;
  updatedAt: string;
}

export type BoardSaveResult = { ok: true; updatedAt: string } | { ok: false; conflict: true };

export interface BoardStateAdapter {
  /** The stored row, or null if this game has no board yet. */
  load(code: string): Promise<BoardStateRecord | null>;
  /**
   * Save if the row is still at expectedUpdatedAt (null: only if no row exists yet).
   * Resolves { ok: false, conflict: true } if someone else saved first; rejects on other errors.
   */
  save(code: string, state: unknown, expectedUpdatedAt: string | null): Promise<BoardSaveResult>;
  /** Realtime inserts/updates for this game's row. Returns unsubscribe. */
  subscribe(code: string, onChange: (record: BoardStateRecord) => void): () => void;
}

export const MISSING_TABLE_MESSAGE =
  'The board_states table does not exist. Apply src/board/supabase/board_states.sql in the Supabase dashboard.';

interface PostgrestErrorLike {
  code?: string;
  message: string;
}

interface BoardStatesRow {
  code: string;
  state: unknown;
  updated_at: string;
}

function toError(error: PostgrestErrorLike): Error {
  // 42P01: undefined_table (Postgres); PGRST205: table not in PostgREST's schema cache.
  if (error.code === '42P01' || error.code === 'PGRST205') return new Error(MISSING_TABLE_MESSAGE);
  return new Error(`board_states: ${error.message}`);
}

export class SupabaseBoardStateAdapter implements BoardStateAdapter {
  private supabase: SupabaseClient;

  constructor(url: string, anonKey: string) {
    // Separate client from the game adapter so src/board stays self-contained. No auth is used;
    // a distinct storage key avoids the "multiple GoTrueClient instances" warning.
    this.supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, storageKey: 'wood-and-steel-board' },
    });
  }

  async load(code: string): Promise<BoardStateRecord | null> {
    const { data, error } = await this.supabase
      .from('board_states')
      .select('state, updated_at')
      .eq('code', code)
      .maybeSingle();
    if (error) throw toError(error);
    const row = data as Pick<BoardStatesRow, 'state' | 'updated_at'> | null;
    return row ? { state: row.state, updatedAt: row.updated_at } : null;
  }

  async save(code: string, state: unknown, expectedUpdatedAt: string | null): Promise<BoardSaveResult> {
    const updatedAt = new Date().toISOString();
    if (expectedUpdatedAt === null) {
      const { data, error } = await this.supabase
        .from('board_states')
        .insert({ code, state, updated_at: updatedAt })
        .select('updated_at')
        .single();
      // 23505: unique_violation, i.e. another screen created the row first.
      if (error?.code === '23505') return { ok: false, conflict: true };
      if (error) throw toError(error);
      return { ok: true, updatedAt: (data as { updated_at: string }).updated_at };
    }
    const { data, error } = await this.supabase
      .from('board_states')
      .update({ state, updated_at: updatedAt })
      .eq('code', code)
      .eq('updated_at', expectedUpdatedAt)
      .select('updated_at');
    if (error) throw toError(error);
    const rows = (data ?? []) as { updated_at: string }[];
    return rows.length === 1 ? { ok: true, updatedAt: rows[0].updated_at } : { ok: false, conflict: true };
  }

  subscribe(code: string, onChange: (record: BoardStateRecord) => void): () => void {
    const channel: RealtimeChannel = this.supabase
      .channel(`board:${code}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'board_states', filter: `code=eq.${code}` },
        (payload: { new?: Partial<BoardStatesRow> }) => {
          const row = payload.new;
          if (row?.state && row.updated_at) onChange({ state: row.state, updatedAt: row.updated_at });
        }
      )
      .subscribe();
    return () => {
      void this.supabase.removeChannel(channel);
    };
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
