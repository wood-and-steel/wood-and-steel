import { describe, expect, test } from 'vitest';
import type { GameContext, GameState } from '../../stores/gameStore';
import { createBotRecord } from '../state/botStates';
import { buildWorld } from './world';
import { startingPlayerBoard } from '../../stores/playerDefaults';

const G = {
  contracts: [],
  players: [
    ['0', { ...startingPlayerBoard(), name: 'Avery 🤖', activeCities: ['Boston', 'Portland ME'], hubCity: null, regionalOffice: null }],
    ['1', { ...startingPlayerBoard(), name: 'Ben', activeCities: ['Norfolk', 'Raleigh'], hubCity: null, regionalOffice: null }],
  ],
  independentRailroads: {},
} as unknown as GameState;
const ctx = { phase: 'play', currentPlayer: '0', numPlayers: 2, playOrder: ['0', '1'], playOrderPos: 0, turn: 2, round: 1 } as GameContext;
const bot = createBotRecord({ name: 'Avery', strategy: 'builder' }, 1);

describe('buildWorld', () => {
  test('seeds the board from G when there is no board row yet, as the board would', () => {
    const world = buildWorld({ G, ctx, board: null, bot, playerID: '0' });
    expect(world.board.track).toEqual({ 'Boston-Portland ME': ['0'], 'Norfolk-Raleigh': ['1'] });
    expect(world.board.engines['0']).toEqual([null, null]);
    expect(world).toMatchObject({ phase: 'play', round: 1, turn: 2, currentPlayer: '0' });
  });

  test('normalizes a stored board and copies inputs', () => {
    const board = { version: 2, seeded: true, track: { 'Boston-New York': ['0'] }, engines: {}, railyards: {}, seenIndependentRailroads: {} };
    const world = buildWorld({ G, ctx, board, bot, playerID: '0' });
    world.board.track['Boston-New York'].push('1');
    world.players[0][1].activeCities.push('Chicago');
    expect(board.track['Boston-New York']).toEqual(['0']);
    expect((G.players[0][1] as { activeCities: string[] }).activeCities).toEqual(['Boston', 'Portland ME']);
  });

  test('takes money, engines, cargo and upgrades from G, not from the board or the bot record', () => {
    const withBoard = {
      ...G,
      players: [
        [
          '0',
          {
            ...G.players[0][1],
            cash: 4000,
            debt: 15000,
            westernDeliveryMade: true,
            engines: ['mogul', 'american'],
            cargo: ['coal', null],
            upgrades: ['timetable', 'railyard'],
            exchangeCommodity: 'grain',
          },
        ],
        G.players[1],
      ],
    } as GameState;
    const board = { version: 2, seeded: true, engineTypes: { '0': ['prairie', null] }, upgrades: { '0': ['roundhouse'] } };
    const world = buildWorld({ G: withBoard, ctx, board, bot, playerID: '0' });
    expect(world.bot).toMatchObject({ cash: 4000, debt: 15000, westernDeliveryMade: true, exchangeCommodity: 'grain' });
    expect(world.board.engineTypes['0']).toEqual(['mogul', 'american']);
    expect(world.board.cargo['0']).toEqual(['coal', null]);
    // The Railyard's ownership is in G, its city on the board; board.upgrades keeps the six checkbox upgrades.
    expect(world.board.upgrades['0']).toEqual(['timetable']);
    expect(world.board.engineTypes['1']).toEqual(['john-bull', null]);
  });
});
