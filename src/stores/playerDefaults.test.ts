import { describe, expect, it } from 'vitest';
import { newPlayerProps, normalizePlayerProps, normalizePlayers, startingPlayerBoard } from './playerDefaults';

describe('startingPlayerBoard', () => {
  it('starts with $10,000, no debt, a John Bull on the light token, and nothing else', () => {
    expect(startingPlayerBoard()).toEqual({
      cash: 10000,
      debt: 0,
      engines: ['john-bull', null],
      cargo: [null, null],
      upgrades: [],
      exchangeCommodity: null,
      centralDebtServicePaid: false,
      westernDeliveryMade: false,
    });
  });

  it('returns fresh arrays each time', () => {
    const a = startingPlayerBoard();
    a.engines[1] = 'mogul';
    a.upgrades.push('timetable');
    expect(startingPlayerBoard().engines).toEqual(['john-bull', null]);
    expect(startingPlayerBoard().upgrades).toEqual([]);
  });
});

describe('newPlayerProps', () => {
  it('names the player and gives them the starting board and no cities', () => {
    expect(newPlayerProps('Ada', '#123456')).toEqual({
      name: 'Ada',
      activeCities: [],
      hubCity: null,
      regionalOffice: null,
      avatarColor: '#123456',
      ...startingPlayerBoard(),
    });
  });

  it('leaves out avatarColor when none is given', () => {
    expect(newPlayerProps('Ada')).not.toHaveProperty('avatarColor');
  });
});

describe('normalizePlayerProps', () => {
  it('gives a player saved before the app tracked money the starting board, keeping what was saved', () => {
    const old = { name: 'Ada', activeCities: ['Boston', 'Portland ME'], hubCity: 'Boston', regionalOffice: 'NE', avatarColor: '#abc' };
    expect(normalizePlayerProps(old)).toEqual({ ...old, ...startingPlayerBoard() });
  });

  it('keeps valid saved values', () => {
    const saved = {
      ...newPlayerProps('Ada'),
      cash: 4000,
      debt: 15000,
      engines: ['mogul', 'american'],
      cargo: ['coal', null],
      upgrades: ['railyard', 'timetable'],
      exchangeCommodity: 'grain',
      centralDebtServicePaid: true,
      westernDeliveryMade: true,
    };
    expect(normalizePlayerProps(saved)).toEqual(saved);
  });

  it('replaces invalid values with start values', () => {
    const player = normalizePlayerProps({
      name: 'Ada',
      cash: -5,
      debt: 'lots',
      engines: ['steam-car', 'mogul', 'extra'],
      cargo: ['unobtainium', 'coal'],
      upgrades: ['hub', 'timetable', 'timetable', 7],
      exchangeCommodity: 'gold',
      regionalOffice: 'XX',
      centralDebtServicePaid: 'yes',
    });
    expect(player).toMatchObject({
      cash: 10000,
      debt: 0,
      engines: ['john-bull', null],
      cargo: [null, 'coal'],
      upgrades: ['timetable'],
      exchangeCommodity: null,
      regionalOffice: null,
      centralDebtServicePaid: false,
      westernDeliveryMade: false,
      activeCities: [],
      hubCity: null,
    });
  });

  it('keeps fields it does not know about', () => {
    expect(normalizePlayerProps({ name: 'Ada', futureField: 3 })).toHaveProperty('futureField', 3);
  });
});

describe('normalizePlayers', () => {
  it('normalizes each [id, props] pair and drops anything else', () => {
    const players = normalizePlayers([['0', { name: 'Ada' }], 'junk', [1, { name: 'Ben' }]]);
    expect(players.map(([id, p]) => [id, p.name, p.cash])).toEqual([
      ['0', 'Ada', 10000],
      ['1', 'Ben', 10000],
    ]);
  });

  it('returns no players for a non-array', () => {
    expect(normalizePlayers(undefined)).toEqual([]);
  });
});
