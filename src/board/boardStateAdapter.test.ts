/**
 * SupabaseBoardStateAdapter against a fake Supabase client: checks the conditional-save
 * contract (insert vs. update-where-updated_at), conflict detection, error mapping, and realtime.
 */
import { vi } from 'vitest';
import { MISSING_TABLE_MESSAGE, SupabaseBoardStateAdapter } from './boardStateAdapter';

interface Result {
  data: unknown;
  error: { code?: string; message: string } | null;
}

const calls: [string, ...unknown[]][] = [];
let nextResult: Result = { data: null, error: null };
let realtimeHandler: ((payload: unknown) => void) | null = null;
const removeChannel = vi.fn();

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
      const channel = {
        on: (_event: string, _filter: unknown, handler: (payload: unknown) => void) => {
          realtimeHandler = handler;
          return channel;
        },
        subscribe: () => channel,
      };
      return channel;
    },
    removeChannel,
  }),
}));

const adapter = () => new SupabaseBoardStateAdapter('https://example.supabase.co', 'anon');

beforeEach(() => {
  calls.length = 0;
  nextResult = { data: null, error: null };
  realtimeHandler = null;
});

describe('SupabaseBoardStateAdapter', () => {
  it('loads a row, or null when there is none', async () => {
    nextResult = { data: { state: { seeded: true }, updated_at: 'T1' }, error: null };
    expect(await adapter().load('BCDFG')).toEqual({ state: { seeded: true }, updatedAt: 'T1' });
    expect(calls).toContainEqual(['eq', 'code', 'BCDFG']);
    nextResult = { data: null, error: null };
    expect(await adapter().load('BCDFG')).toBeNull();
  });

  it('maps a missing table to a message pointing at the SQL file', async () => {
    nextResult = { data: null, error: { code: 'PGRST205', message: 'Could not find the table' } };
    await expect(adapter().load('BCDFG')).rejects.toThrow(MISSING_TABLE_MESSAGE);
    nextResult = { data: null, error: { code: 'XX000', message: 'boom' } };
    await expect(adapter().load('BCDFG')).rejects.toThrow('board_states: boom');
  });

  it('inserts when no row is expected, and reports a duplicate as a conflict', async () => {
    nextResult = { data: { updated_at: 'T2' }, error: null };
    expect(await adapter().save('BCDFG', { seeded: true }, null)).toEqual({ ok: true, updatedAt: 'T2' });
    expect(calls.some(([m]) => m === 'insert')).toBe(true);
    nextResult = { data: null, error: { code: '23505', message: 'duplicate key' } };
    expect(await adapter().save('BCDFG', {}, null)).toEqual({ ok: false, conflict: true });
  });

  it('updates only where updated_at still matches; zero rows is a conflict', async () => {
    nextResult = { data: [{ updated_at: 'T3' }], error: null };
    expect(await adapter().save('BCDFG', { seeded: true }, 'T2')).toEqual({ ok: true, updatedAt: 'T3' });
    expect(calls).toContainEqual(['eq', 'code', 'BCDFG']);
    expect(calls).toContainEqual(['eq', 'updated_at', 'T2']);
    nextResult = { data: [], error: null };
    expect(await adapter().save('BCDFG', {}, 'T2')).toEqual({ ok: false, conflict: true });
  });

  it('forwards realtime rows and removes the channel on unsubscribe', () => {
    const onChange = vi.fn();
    const unsubscribe = adapter().subscribe('BCDFG', onChange);
    expect(calls).toContainEqual(['channel', 'board:BCDFG']);
    realtimeHandler!({ new: { code: 'BCDFG', state: { seeded: true }, updated_at: 'T4' } });
    realtimeHandler!({ new: {} });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ state: { seeded: true }, updatedAt: 'T4' });
    unsubscribe();
    expect(removeChannel).toHaveBeenCalled();
  });
});
