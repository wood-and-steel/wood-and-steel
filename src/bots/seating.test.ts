import { describe, expect, test } from 'vitest';
import { BOT_NAMES } from './names';
import { STRATEGIES } from './heuristic/strategies';
import { pickBotName, resolveStrategy } from './seating';

const first = () => 0;
const last = () => 0.999999;

describe('pickBotName', () => {
  test('has the 74 names from the list, with no duplicates', () => {
    expect(BOT_NAMES).toHaveLength(21);
    expect(new Set(BOT_NAMES.map((n) => n.toLowerCase())).size).toBe(21);
  });

  test('picks from the list', () => {
    expect(pickBotName({}, first)).toBe('Avery');
    expect(pickBotName({}, last)).toBe('Zola');
  });

  test('skips names used by bots and by humans, ignoring case and "🤖"', () => {
    const seats = {
      a: { playerName: 'Avery 🤖', bot: { name: 'Avery', strategy: 'builder' } },
      b: { playerName: 'geni' },
      c: { playerName: 'Brooke 🤖' },
    };
    expect(pickBotName(seats, first)).toBe('Brooke');
  });

  test('keeps names unique when every name is taken', () => {
    const seats = Object.fromEntries(BOT_NAMES.map((name) => [name, { playerName: name }]));
    expect(pickBotName(seats, first)).toBe('Avery 2');
  });
});

describe('resolveStrategy', () => {
  test('keeps an explicit choice, even if another bot has it', () => {
    const seats = { a: { playerName: 'Avery 🤖', bot: { name: 'Avery', strategy: 'merchant' } } };
    expect(resolveStrategy('merchant', seats, first)).toBe('merchant');
  });

  test('random avoids strategies already in the game', () => {
    const seats = {
      a: { playerName: 'Avery 🤖', bot: { name: 'Avery', strategy: 'builder' } },
      b: { playerName: 'Sage 🤖', bot: { name: 'Sage', strategy: 'speculator' } },
      h: { playerName: 'Host' },
    };
    expect(resolveStrategy('random', seats, first)).toBe('consolidator');
    expect(resolveStrategy('random', seats, last)).toBe('regionalist');
  });

  test('random uses any strategy once all six are taken', () => {
    const seats = Object.fromEntries(
      STRATEGIES.map((s, i) => [String(i), { playerName: `B${i} 🤖`, bot: { name: `B${i}`, strategy: s.id } }])
    );
    expect(resolveStrategy('random', seats, first)).toBe('builder');
  });
});
