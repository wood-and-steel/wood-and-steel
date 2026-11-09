/**
 * SupabaseBotStatesAdapter against a fake Supabase client: it is the shared JSON row adapter
 * (covered in src/board/boardStateAdapter.test.ts) pointed at the bot_states table.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BOT_STATES_MISSING_TABLE_MESSAGE, SupabaseBotStatesAdapter } from './botStatesAdapter';

interface Result {
  data: unknown;
  error: { code?: string; message: string } | null;
}

const calls: [string, ...unknown[]][] = [];
let nextResult: Result = { data: null, error: null };

function builder() {
  const b: Record<string, unknown> = {};
  for (const method of ['select', 'insert', 'update', 'eq', 'maybeSingle', 'single']) {
    b[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return b;
    };
  }
  b.then = (resolve: (r: Result) => unknown) => resolve(nextResult);
  return b;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      calls.push(['from', table]);
      return builder();
    },
    channel: (name: string) => {
      calls.push(['channel', name]);
      const channel = { on: () => channel, subscribe: () => channel };
      return channel;
    },
    removeChannel: vi.fn(),
  }),
}));

const adapter = () => new SupabaseBotStatesAdapter('https://example.supabase.co', 'anon');

beforeEach(() => {
  calls.length = 0;
  nextResult = { data: null, error: null };
});

describe('SupabaseBotStatesAdapter', () => {
  it('reads the bot_states table', async () => {
    nextResult = { data: { state: { version: 1 }, updated_at: 'T1' }, error: null };
    expect(await adapter().load('BCDFG')).toEqual({ state: { version: 1 }, updatedAt: 'T1' });
    expect(calls).toContainEqual(['from', 'bot_states']);
  });

  it('points a missing table at its SQL file', async () => {
    nextResult = { data: null, error: { code: '42P01', message: 'relation does not exist' } };
    await expect(adapter().load('BCDFG')).rejects.toThrow(BOT_STATES_MISSING_TABLE_MESSAGE);
    nextResult = { data: null, error: { code: 'XX000', message: 'boom' } };
    await expect(adapter().load('BCDFG')).rejects.toThrow('bot_states: boom');
  });

  it('subscribes on its own channel', () => {
    adapter().subscribe('BCDFG', () => {});
    expect(calls).toContainEqual(['channel', 'bots:BCDFG']);
  });
});
