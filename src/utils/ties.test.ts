import { describe, expect, test } from 'vitest';
import { railroadTieValue, type Contract } from '../Contract';
import { contractTies, playerTies } from './ties';

const contract = (c: Partial<Contract>): Contract =>
  ({ id: 'c', type: 'private', commodity: 'coal', destinationKey: 'Boston', playerID: '0', fulfilled: true, ...c }) as Contract;

describe('playerTies', () => {
  test('adds 1 tie per acquired railroad to the contract ties, which alone end the game', () => {
    const contracts = [contract({}), contract({ id: 'd', playerID: '1' })];
    const fromContracts = railroadTieValue(contracts[0]);
    expect(contractTies(contracts, '0')).toBe(fromContracts);
    expect(playerTies(contracts, '0', { railroadsAcquired: 2 })).toBe(fromContracts + 2);
    expect(playerTies(contracts, '0', undefined)).toBe(fromContracts);
  });
});
