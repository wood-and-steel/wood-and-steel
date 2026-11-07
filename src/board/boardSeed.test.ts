import type { GameContext, GameState } from '../stores/gameStore';
import { canSeedBoard, findRouteKey, seedBoardState, startingRouteKeys } from './boardSeed';

function game(players: Record<string, string[]>, phase = 'play'): { G: GameState; ctx: GameContext } {
  const ids = Object.keys(players);
  return {
    G: {
      contracts: [],
      players: ids.map((id) => [id, { name: `P${id}`, activeCities: players[id], hubCity: null, regionalOffice: null }]),
      independentRailroads: {
        Erie: { name: 'Erie', routes: [{ key: 'Chicago-Detroit', addedInRound: 0 }] },
      },
    },
    ctx: { phase, currentPlayer: ids[0], numPlayers: ids.length, playOrder: ids, playOrderPos: 0, turn: 0, round: 1 },
  };
}

describe('seeding', () => {
  it('finds route keys regardless of city order', () => {
    expect(findRouteKey('Quebec City', 'Montreal')).toBe('Montreal-Quebec City');
    expect(findRouteKey('Boston', 'Denver')).toBeNull();
  });

  it('waits until players have picked starting routes', () => {
    expect(canSeedBoard(game({ '0': [] }, 'setup').G, game({ '0': [] }, 'setup').ctx)).toBe(false);
    expect(canSeedBoard(game({}, 'play').G, game({}, 'play').ctx)).toBe(false);
    const g = game({ '0': ['Boston', 'Portland ME'] });
    expect(canSeedBoard(g.G, g.ctx)).toBe(true);
  });

  it("gives each player their starting route, empty trays, and an indie snapshot", () => {
    const { G, ctx } = game({ '0': ['Charleston', 'Savannah', 'Atlanta'], '1': ['Montreal', 'Quebec City'] });
    expect(seedBoardState(G, ctx)).toEqual({
      version: 1,
      seeded: true,
      track: { 'Charleston-Savannah': ['0'], 'Montreal-Quebec City': ['1'] },
      engines: { '0': [null, null], '1': [null, null] },
      railyards: { '0': null, '1': null },
      seenIndependentRailroads: { Erie: ['Chicago-Detroit'] },
    });
  });

  it('when several starting pairs match mid-game, prefers one no earlier player got', () => {
    const { G, ctx } = game({
      '0': ['New York', 'Philadelphia'],
      '1': ['New York', 'Philadelphia', 'Washington'],
      '2': ['Denver'],
    });
    expect(startingRouteKeys(G, ctx)).toEqual({ '0': 'New York-Philadelphia', '1': 'Philadelphia-Washington' });
  });
});
