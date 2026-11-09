import { describe, expect, test } from 'vitest';
import { createRng } from '../rng';
import { STRATEGIES } from './strategies';
import { BANDS, STRATEGY_BANDS, WEIGHT_KEYS, defaultWeights, drawWeights } from './weights';

describe('strategy weights', () => {
  test('every strategy has a band for every weight', () => {
    expect(Object.keys(STRATEGY_BANDS).sort()).toEqual(STRATEGIES.map((s) => s.id).sort());
    for (const bands of Object.values(STRATEGY_BANDS)) {
      expect(Object.keys(bands).sort()).toEqual([...WEIGHT_KEYS].sort());
    }
  });

  test.each(STRATEGIES.map((s) => s.id))('%s draws stay within its bands', (strategy) => {
    const rng = createRng(123);
    for (let i = 0; i < 200; i++) {
      const weights = drawWeights(strategy, rng);
      for (const key of WEIGHT_KEYS) {
        const [lo, hi] = BANDS[STRATEGY_BANDS[strategy][key]];
        expect(weights[key]).toBeGreaterThanOrEqual(lo);
        expect(weights[key]).toBeLessThanOrEqual(hi);
      }
    }
  });

  test('two bots with one strategy usually get different weights', () => {
    const rng = createRng(9);
    expect(drawWeights('builder', rng)).not.toEqual(drawWeights('builder', rng));
  });

  test('defaults are band midpoints', () => {
    expect(defaultWeights('speculator').debtTolerance).toBe(0.85);
    expect(defaultWeights('builder').debtTolerance).toBe(0.15);
  });
});
