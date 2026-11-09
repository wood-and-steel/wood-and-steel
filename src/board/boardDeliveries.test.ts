import { describe, expect, it } from 'vitest';
import type { Contract } from '../Contract';
import type { GameState } from '../stores/gameStore';
import { emptyBoardState, type BoardState } from './boardOps';
import { deliveryCargoOps, fulfilledIds } from './boardDeliveries';

const contract = (fields: Partial<Contract>): Contract => ({
  id: 'k1',
  destinationKey: 'Savannah',
  commodity: 'cotton',
  type: 'private',
  fulfilled: true,
  playerID: '0',
  creationTime: 0,
  turnsHeld: 0,
  ...fields,
});
const game = (contracts: Contract[]) => ({ contracts, players: [], independentRailroads: {} }) as unknown as GameState;
const board = (fields: Partial<BoardState>): BoardState => ({ ...emptyBoardState(), seeded: true, ...fields });

describe('deliveryCargoOps', () => {
  it('unloads the engine in the destination city carrying the commodity', () => {
    const b = board({ engines: { '0': ['Atlanta', 'Savannah'] }, cargo: { '0': ['cotton', 'cotton'] } });
    expect(deliveryCargoOps(new Set(), game([contract({})]), b)).toEqual([{ type: 'setCargo', playerID: '0', slot: 1, commodity: null }]);
  });

  it('only for contracts fulfilled since last time', () => {
    const b = board({ engines: { '0': ['Savannah', null] }, cargo: { '0': ['cotton', null] } });
    expect(deliveryCargoOps(new Set(['k1']), game([contract({})]), b)).toEqual([]);
    expect(deliveryCargoOps(new Set(), game([contract({ fulfilled: false })]), b)).toEqual([]);
  });

  it('nothing when no engine there carries it', () => {
    const elsewhere = board({ engines: { '0': ['Atlanta', null] }, cargo: { '0': ['cotton', null] } });
    const other = board({ engines: { '0': ['Savannah', null] }, cargo: { '0': ['tobacco', null] } });
    expect(deliveryCargoOps(new Set(), game([contract({})]), elsewhere)).toEqual([]);
    expect(deliveryCargoOps(new Set(), game([contract({})]), other)).toEqual([]);
  });

  it('market contracts unload the player who fulfilled them; two deliveries unload two engines', () => {
    const b = board({ engines: { '1': ['Savannah', 'Savannah'] }, cargo: { '1': ['cotton', 'cotton'] } });
    const contracts = [contract({ id: 'm1', type: 'market', playerID: '1' }), contract({ id: 'k2', playerID: '1' })];
    expect(deliveryCargoOps(new Set(), game(contracts), b)).toEqual([
      { type: 'setCargo', playerID: '1', slot: 0, commodity: null },
      { type: 'setCargo', playerID: '1', slot: 1, commodity: null },
    ]);
  });

  it('fulfilledIds lists fulfilled contracts', () => {
    expect([...fulfilledIds(game([contract({}), contract({ id: 'k2', fulfilled: false })]))]).toEqual(['k1']);
  });
});
