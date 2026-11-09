/**
 * Persistence for bot_states (SQL in src/bots/supabase/bot_states.sql): one JSON row per game,
 * saved conditionally on updated_at, with realtime so board screens can show narration.
 */
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../../config/storage';
import { SupabaseJsonRowAdapter, type JsonRowAdapter } from '../../board/jsonRowAdapter';

export type BotStatesAdapter = JsonRowAdapter;

export const BOT_STATES_MISSING_TABLE_MESSAGE =
  'The bot_states table does not exist. Apply src/bots/supabase/bot_states.sql in the Supabase dashboard.';

export class SupabaseBotStatesAdapter extends SupabaseJsonRowAdapter {
  constructor(url: string, anonKey: string) {
    super(url, anonKey, {
      table: 'bot_states',
      channelPrefix: 'bots',
      storageKey: 'wood-and-steel-bots',
      missingTableMessage: BOT_STATES_MISSING_TABLE_MESSAGE,
    });
  }
}

let adapterInstance: BotStatesAdapter | null = null;

export function getBotStatesAdapter(): BotStatesAdapter {
  if (adapterInstance) return adapterInstance;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  adapterInstance = new SupabaseBotStatesAdapter(SUPABASE_URL, SUPABASE_ANON_KEY);
  return adapterInstance;
}

/** Replace the adapter (tests use MemoryBotStatesAdapter). */
export function setBotStatesAdapter(adapter: BotStatesAdapter | null): void {
  adapterInstance = adapter;
}
