import { describe, expect, it } from 'vitest';
import { emptyBoardState, normalizeBoardState } from './boardOps';
import { saveBoardOp } from './boardRowOps';
import { MemoryBoardStateAdapter } from './memoryBoardStateAdapter.testHelper';

const CODE = 'BCDFG';
const seeded = () => ({ ...emptyBoardState(), seeded: true });

describe('saveBoardOp', () => {
  it('seeds a missing row, then applies the op', async () => {
    const adapter = new MemoryBoardStateAdapter();
    await saveBoardOp(adapter, CODE, { type: 'claimRoute', routeKey: 'Boston-New York', playerID: '0' }, seeded);
    expect(normalizeBoardState(adapter.rows.get(CODE)!.state).track).toEqual({ 'Boston-New York': ['0'] });
  });

  it('does nothing without a row when it cannot seed', async () => {
    const adapter = new MemoryBoardStateAdapter();
    expect(await saveBoardOp(adapter, CODE, { type: 'moveRailyard', playerID: '0', city: 'Boston' }, () => null)).toBeNull();
    expect(adapter.rows.size).toBe(0);
  });

  it('re-applies after a conflict, keeping the other screen’s edit', async () => {
    const adapter = new MemoryBoardStateAdapter();
    adapter.write(CODE, seeded());
    adapter.beforeSave = () => adapter.write(CODE, { ...seeded(), track: { 'Norfolk-Raleigh': ['1'] } });
    await saveBoardOp(adapter, CODE, { type: 'claimRoute', routeKey: 'Boston-New York', playerID: '0' }, () => null);
    expect(normalizeBoardState(adapter.rows.get(CODE)!.state).track).toEqual({
      'Norfolk-Raleigh': ['1'],
      'Boston-New York': ['0'],
    });
  });
});
