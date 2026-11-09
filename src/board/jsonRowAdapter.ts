/**
 * One JSON row per game code in a Supabase table, with saves conditional on the row's
 * `updated_at` and realtime notifications. Used by `board_states` (boardStateAdapter.ts) and,
 * in playtest builds, by `bot_states` (src/bots/state/, docs/BOT_PLAN.md).
 */
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';

export interface JsonRowRecord {
  /** Raw stored JSON; normalize it before use. */
  state: unknown;
  updatedAt: string;
}

export type JsonRowSaveResult = { ok: true; updatedAt: string } | { ok: false; conflict: true };

export interface JsonRowAdapter {
  /** The stored row, or null if this game has none yet. */
  load(code: string): Promise<JsonRowRecord | null>;
  /**
   * Save if the row is still at expectedUpdatedAt (null: only if no row exists yet).
   * Resolves { ok: false, conflict: true } if someone else saved first; rejects on other errors.
   */
  save(code: string, state: unknown, expectedUpdatedAt: string | null): Promise<JsonRowSaveResult>;
  /** Realtime inserts/updates for this game's row. Returns unsubscribe. */
  subscribe(code: string, onChange: (record: JsonRowRecord) => void): () => void;
}

export interface JsonRowTable {
  table: string;
  /** Realtime channel name prefix, e.g. 'board' gives 'board:CODE'. */
  channelPrefix: string;
  /** Auth storage key for this client; distinct per table avoids "multiple GoTrueClient instances". */
  storageKey: string;
  /** Error message when the table hasn't been created. */
  missingTableMessage: string;
}

interface PostgrestErrorLike {
  code?: string;
  message: string;
}

interface JsonRow {
  code: string;
  state: unknown;
  updated_at: string;
}

export class SupabaseJsonRowAdapter implements JsonRowAdapter {
  private supabase: SupabaseClient;
  private config: JsonRowTable;

  constructor(url: string, anonKey: string, config: JsonRowTable) {
    // Separate client from the game adapter, so playtest code stays self-contained. No auth is used.
    this.supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, storageKey: config.storageKey },
    });
    this.config = config;
  }

  private toError(error: PostgrestErrorLike): Error {
    // 42P01: undefined_table (Postgres); PGRST205: table not in PostgREST's schema cache.
    if (error.code === '42P01' || error.code === 'PGRST205') return new Error(this.config.missingTableMessage);
    return new Error(`${this.config.table}: ${error.message}`);
  }

  async load(code: string): Promise<JsonRowRecord | null> {
    const { data, error } = await this.supabase
      .from(this.config.table)
      .select('state, updated_at')
      .eq('code', code)
      .maybeSingle();
    if (error) throw this.toError(error);
    const row = data as Pick<JsonRow, 'state' | 'updated_at'> | null;
    return row ? { state: row.state, updatedAt: row.updated_at } : null;
  }

  async save(code: string, state: unknown, expectedUpdatedAt: string | null): Promise<JsonRowSaveResult> {
    const updatedAt = new Date().toISOString();
    if (expectedUpdatedAt === null) {
      const { data, error } = await this.supabase
        .from(this.config.table)
        .insert({ code, state, updated_at: updatedAt })
        .select('updated_at')
        .single();
      // 23505: unique_violation, i.e. another client created the row first.
      if (error?.code === '23505') return { ok: false, conflict: true };
      if (error) throw this.toError(error);
      return { ok: true, updatedAt: (data as { updated_at: string }).updated_at };
    }
    const { data, error } = await this.supabase
      .from(this.config.table)
      .update({ state, updated_at: updatedAt })
      .eq('code', code)
      .eq('updated_at', expectedUpdatedAt)
      .select('updated_at');
    if (error) throw this.toError(error);
    const rows = (data ?? []) as { updated_at: string }[];
    return rows.length === 1 ? { ok: true, updatedAt: rows[0].updated_at } : { ok: false, conflict: true };
  }

  subscribe(code: string, onChange: (record: JsonRowRecord) => void): () => void {
    const channel: RealtimeChannel = this.supabase
      .channel(`${this.config.channelPrefix}:${code}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: this.config.table, filter: `code=eq.${code}` },
        (payload: { new?: Partial<JsonRow> }) => {
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
