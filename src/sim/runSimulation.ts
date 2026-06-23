import {
  growIndependentRailroads,
  initializeIndependentRailroads,
} from '../independentRailroads';
import type { GameContext, GameState } from '../stores/gameStore';
import { citiesConnectedTo } from '../utils/graph';
import { randomArrayItem, shuffleArray } from '../utils/random';

export const STARTING_CITY_PAIRS: readonly [string, string][] = [
  ['Montreal', 'Quebec City'],
  ['Boston', 'Portland ME'],
  ['New York', 'Philadelphia'],
  // ['Philadelphia', 'Washington'], -- omitting one of the Phildelphia dupes to simplify implementation
  ['Norfolk', 'Raleigh'],
  ['Charleston', 'Savannah'],
];

export interface SimulationParams {
  numPlayers: number;
  numRounds: number;
  numGames: number;
  expandChancePct: number;
}

export interface GameResult {
  gameNumber: number;
  G: GameState;
  activeCities: string[];
  activeCitiesTotal: number;
  activeCitiesAverage: number;
  rrSizes: number[];
  maxRrSize: number;
  rrRoutes: string[];
}

function seedStartingCities(G: GameState, numPlayers: number): void {
  const pool: [string, string][] = shuffleArray([...STARTING_CITY_PAIRS]) as [string, string][];
  if (pool.length < numPlayers) {
    throw new Error(
      `Not enough starting city pairs for ${numPlayers} players (need ${numPlayers}, have ${pool.length}).`
    );
  }

  for (let i = 0; i < numPlayers; i++) {
    const [cityA, cityB] = pool.pop()!;
    const player = G.players[i]?.[1];
    if (player) {
      player.activeCities = [cityA, cityB];
    } else {
      throw new Error(`Player ${i} not found in game state.`);
    }
  }
}

function createStubGame(numPlayers: number): { G: GameState; ctx: GameContext } {
  const G: GameState = {
    contracts: [],
    players: Array.from({ length: numPlayers }, (_, i) => [
      String(i),
      {
        name: `Player ${i}`,
        activeCities: [],
        hubCity: null,
        regionalOffice: null,
      },
    ]),
    independentRailroads: initializeIndependentRailroads(),
  };

  const ctx: GameContext = {
    phase: 'play',
    currentPlayer: '0',
    numPlayers,
    playOrder: Array.from({ length: numPlayers }, (_, i) => String(i)),
    playOrderPos: 0,
    turn: 0,
    round: 0,
  };

  seedStartingCities(G, numPlayers);
  return { G, ctx };
}

function maybeExpandActiveCities(
  activeCities: string[],
  expandChancePct: number
): void {
  if (Math.random() * 100 >= expandChancePct) {
    return;
  }

  const owned = new Set(activeCities);
  const reachable = citiesConnectedTo(owned, { distance: 2, includeFromCities: false });
  const candidates = [...reachable].filter((city) => !owned.has(city));
  const picked = randomArrayItem(candidates) as string | undefined;
  if (picked != null) {
    activeCities.push(picked);
  }
}

function runSingleGame(params: SimulationParams, gameNumber: number): GameResult {
  const { G, ctx } = createStubGame(params.numPlayers);

  for (let round = 1; round <= params.numRounds; round++) {
    ctx.round = round;

    for (const playerId of ctx.playOrder) {
      const player = G.players.find(([id]) => id === playerId)?.[1];
      if (player) {
        maybeExpandActiveCities(player.activeCities, params.expandChancePct);
      }
    }

    growIndependentRailroads(G, ctx);
  }

  const activeCities = G.players.flatMap(([, player]) => player.activeCities);
  const rrSizes = Object.values(G.independentRailroads).map((rr) => rr.routes.length);
  const rrRoutes = Object.values(G.independentRailroads).flatMap((rr) =>
    rr.routes.map((route) => route.key)
  );

  return {
    gameNumber,
    G,
    activeCities,
    activeCitiesTotal: activeCities.length,
    activeCitiesAverage: activeCities.length / params.numPlayers,
    rrSizes,
    maxRrSize: rrSizes.length > 0 ? Math.max(...rrSizes) : 0,
    rrRoutes,
  };
}

export function runSimulation(params: SimulationParams): GameResult[] {
  const results: GameResult[] = [];
  for (let i = 1; i <= params.numGames; i++) {
    results.push(runSingleGame(params, i));
  }
  return results;
}
