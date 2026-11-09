import { describe, expect, test } from 'vitest';
import type { PlayerSeat } from '../../utils/gameManager';
import { BANDS, STRATEGY_BANDS, WEIGHT_KEYS } from '../heuristic/weights';
import {
  BOT_STATES_VERSION,
  MAX_LOG_TURNS,
  STARTING_CASH,
  addMissingBots,
  botSeatsByPlayerID,
  createBotRecord,
  emptyBotStates,
  normalizeBotStates,
} from './botStates';

const seats: Record<string, PlayerSeat> = {
  host: { joinedAt: 'T', playerName: 'Hana', playerID: '1' },
  'bot:a': { joinedAt: 'T', playerName: 'Avery (bot)', playerID: '0', bot: { name: 'Avery', strategy: 'builder' } },
  'bot:b': { joinedAt: 'T', playerName: 'Sage (bot)', playerID: '2', bot: { name: 'Sage', strategy: 'merchant' } },
  'bot:waiting': { joinedAt: 'T', playerName: 'Quinn (bot)', bot: { name: 'Quinn', strategy: 'express' } },
};

describe('createBotRecord', () => {
  test('starts with $10,000, no debt, and weights within its strategy', () => {
    const record = createBotRecord({ name: 'Avery', strategy: 'speculator' }, 5);
    expect(record).toMatchObject({ name: 'Avery', strategy: 'speculator', cash: STARTING_CASH, debt: 0, log: [] });
    for (const key of WEIGHT_KEYS) {
      const [lo, hi] = BANDS[STRATEGY_BANDS.speculator[key]];
      expect(record.weights[key]).toBeGreaterThanOrEqual(lo);
      expect(record.weights[key]).toBeLessThanOrEqual(hi);
    }
    expect(createBotRecord({ name: 'Avery', strategy: 'speculator' }, 5)).toEqual(record);
  });
});

describe('botSeatsByPlayerID and addMissingBots', () => {
  test('takes only bot seats that have a playerID', () => {
    expect(botSeatsByPlayerID(seats)).toEqual({
      '0': { name: 'Avery', strategy: 'builder' },
      '2': { name: 'Sage', strategy: 'merchant' },
    });
  });

  test('adds missing bots and is re-appliable', () => {
    let n = 0;
    const seed = () => ++n;
    const once = addMissingBots(emptyBotStates(), seats, seed);
    expect(Object.keys(once.bots).sort()).toEqual(['0', '2']);
    expect(addMissingBots(once, seats, seed)).toBe(once);
  });

  test('keeps existing records as they are', () => {
    const existing = { ...emptyBotStates(), bots: { '0': { ...createBotRecord({ name: 'Avery', strategy: 'builder' }, 1), cash: 3000 } } };
    const result = addMissingBots(existing, seats, () => 2);
    expect(result.bots['0'].cash).toBe(3000);
    expect(result.bots['2'].name).toBe('Sage');
  });
});

describe('normalizeBotStates', () => {
  test('round-trips a valid state', () => {
    const states = addMissingBots(emptyBotStates(), seats, () => 3);
    states.bots['0'].log = [{ round: 1, turn: 2, lines: ['Avery ended the turn.'] }];
    states.bots['0'].deliveries = { coal: 2 };
    states.bots['0'].plan = { target: 'Chicago' };
    states.bots['0'].turnInProgress = {
      turn: 4,
      playOrderPos: 1,
      steps: ['buildTrack'],
      pending: { step: 'endTurn', effects: [{ kind: 'move', move: { name: 'endTurn', args: [] } }] },
    };
    expect(normalizeBotStates(JSON.parse(JSON.stringify(states)))).toEqual(states);
  });

  test('tolerates garbage', () => {
    expect(normalizeBotStates(null)).toEqual(emptyBotStates());
    expect(normalizeBotStates({ bots: 'nope' })).toEqual(emptyBotStates());
  });

  test('drops bots without a name or a known strategy', () => {
    const states = normalizeBotStates({
      version: 1,
      bots: { '0': { name: 'Avery', strategy: 'gambler' }, '1': { strategy: 'builder' }, '2': { name: 'Sage', strategy: 'merchant' } },
    });
    expect(Object.keys(states.bots)).toEqual(['2']);
  });

  test('fills missing or malformed fields with safe defaults', () => {
    const states = normalizeBotStates({
      version: 1,
      bots: {
        '2': {
          name: 'Sage',
          strategy: 'merchant',
          weights: { debtTolerance: 0.2, reach: 7, variability: 'high' },
          cash: 'lots',
          debt: -5,
          deliveries: { coal: 2, unobtainium: 3, wood: 0 },
          exchangeCommodity: 'unobtainium',
          plan: ['not', 'an', 'object'],
          turnInProgress: { turn: 'x', steps: [] },
          log: [{ round: 1, turn: 1, lines: ['ok'] }, { round: 'x' }],
        },
      },
    });
    const sage = states.bots['2'];
    expect(sage.weights.debtTolerance).toBe(0.2);
    expect(sage.weights.reach).toBe(0.325); // lowMed midpoint
    expect(sage.cash).toBe(STARTING_CASH);
    expect(sage.debt).toBe(0);
    expect(sage.deliveries).toEqual({ coal: 2 });
    expect(sage.exchangeCommodity).toBeNull();
    expect(sage.plan).toBeNull();
    expect(sage.turnInProgress).toBeNull();
    expect(sage.log).toEqual([{ round: 1, turn: 1, lines: ['ok'] }]);
  });

  test('keeps only the last MAX_LOG_TURNS turns', () => {
    const log = Array.from({ length: MAX_LOG_TURNS + 5 }, (_, i) => ({ round: i, turn: i, lines: [`t${i}`] }));
    const states = normalizeBotStates({ version: 1, bots: { '0': { name: 'Avery', strategy: 'builder', log } } });
    expect(states.bots['0'].log).toHaveLength(MAX_LOG_TURNS);
    expect(states.bots['0'].log[0].turn).toBe(5);
  });

  test('refuses a newer version', () => {
    expect(() => normalizeBotStates({ version: BOT_STATES_VERSION + 1, bots: {} })).toThrow(/newer/);
  });
});
