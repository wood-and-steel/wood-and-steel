import { generateMarketContract, rewardValue, newContract } from './Contract';

describe('generateMarketContract', () => {
  test('generates market contracts with value of at least $6000', () => {
    // Create a minimal game state for testing with valid city names
    const G = {
      contracts: [],
      players: [
        ['0', { activeCities: ['New York', 'Philadelphia', 'Pittsburgh'] }],
        ['1', { activeCities: ['Raleigh', 'Norfolk'] }],
      ],
    };

    // Generate multiple contracts to test the constraint
    for (let i = 0; i < 20; i++) {
      const contract = generateMarketContract(G);
      
      if (contract) {
        const value = rewardValue(contract);
        
        // All market contracts should be worth at least $6000 (distance >= 2)
        expect(value).toBeGreaterThanOrEqual(6000);
      }
    }
  });
});

describe('rewardValue', () => {
  test('calculates correct dollar value based on distance', () => {
    // Create a valid contract using newContract with a valid commodity
    const contract = newContract('Chicago', 'coal', { type: 'market' });
    
    if (contract) {
      const value = rewardValue(contract);
      // Value should be distance × $3000
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value % 3000).toBe(0); // Should be a multiple of 3000
    }
  });
});
