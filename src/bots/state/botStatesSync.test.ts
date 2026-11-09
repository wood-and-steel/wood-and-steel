import { beforeEach, describe, expect, test } from 'vitest';
import type { PlayerSeat } from '../../utils/gameManager';
import { normalizeBotStates } from './botStates';
import { MAX_SAVE_ATTEMPTS, ensureBotStates, loadBotStates, updateBotStates } from './botStatesSync';
import { MemoryBotStatesAdapter } from './memoryBotStatesAdapter.testHelper';

const CODE = 'BCDFG';
let adapter: MemoryBotStatesAdapter;

const seats: Record<string, PlayerSeat> = {
  host: { joinedAt: 'T', playerName: 'Hana', playerID: '1' },
  'bot:a': { joinedAt: 'T', playerName: 'Avery (bot)', playerID: '0', bot: { name: 'Avery', strategy: 'builder' } },
};

beforeEach(() => {
  adapter = new MemoryBotStatesAdapter();
});

describe('ensureBotStates', () => {
  test('creates the row with one record per bot', async () => {
    const saved = await ensureBotStates(CODE, seats, { adapter, seed: () => 1 });
    expect(Object.keys(saved.states.bots)).toEqual(['0']);
    expect((await loadBotStates(CODE, adapter))!.states).toEqual(saved.states);
  });

  test('does nothing when every bot already has a record', async () => {
    await ensureBotStates(CODE, seats, { adapter });
    const saves = adapter.saves;
    await ensureBotStates(CODE, seats, { adapter });
    expect(adapter.saves).toBe(saves);
  });

  test('if another device creates the row first, uses theirs', async () => {
    adapter.beforeSave = () => {
      adapter.write(CODE, { version: 1, bots: { '0': { name: 'Avery', strategy: 'builder', cash: 1234 } } });
    };
    const saved = await ensureBotStates(CODE, seats, { adapter });
    expect(saved.states.bots['0'].cash).toBe(1234);
  });
});

describe('updateBotStates', () => {
  test('re-applies the change after a conflict, keeping the other write', async () => {
    await ensureBotStates(CODE, seats, { adapter });
    adapter.beforeSave = () => {
      const row = normalizeBotStates(adapter.rows.get(CODE)!.state);
      row.bots['0'].debt = 5000;
      adapter.write(CODE, row);
    };
    const saved = await updateBotStates(
      CODE,
      (states) => ({ ...states, bots: { ...states.bots, '0': { ...states.bots['0'], cash: 4000 } } }),
      { adapter }
    );
    expect(saved.states.bots['0']).toMatchObject({ cash: 4000, debt: 5000 });
  });

  test('skips the save when nothing changes', async () => {
    await ensureBotStates(CODE, seats, { adapter });
    const saves = adapter.saves;
    await updateBotStates(CODE, (states) => states, { adapter });
    expect(adapter.saves).toBe(saves);
  });

  test('throws when there is no row', async () => {
    await expect(updateBotStates(CODE, (s) => s, { adapter })).rejects.toThrow(/No bot state/);
  });

  test(`gives up after ${MAX_SAVE_ATTEMPTS} conflicts`, async () => {
    await ensureBotStates(CODE, seats, { adapter });
    const original = adapter.save.bind(adapter);
    adapter.save = async () => ({ ok: false, conflict: true });
    await expect(updateBotStates(CODE, (s) => ({ ...s }), { adapter })).rejects.toThrow(/attempts/);
    adapter.save = original;
  });
});
