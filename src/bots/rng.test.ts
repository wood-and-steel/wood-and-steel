import { describe, expect, test } from 'vitest';
import { createRng, randomSeed } from './rng';

describe('createRng', () => {
  test('is deterministic for a seed and stays in [0, 1)', () => {
    const a = createRng(42);
    const b = createRng(42);
    const values = Array.from({ length: 1000 }, () => a.next());
    expect(values).toEqual(Array.from({ length: 1000 }, () => b.next()));
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(new Set(values).size).toBeGreaterThan(990);
  });

  test('continues the same sequence from a saved state', () => {
    const rng = createRng(7);
    rng.next();
    rng.next();
    const resumed = createRng(rng.state());
    expect(resumed.next()).toBe(rng.next());
  });

  test('randomSeed gives a 32-bit unsigned integer', () => {
    const seed = randomSeed();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(2 ** 32);
  });
});
