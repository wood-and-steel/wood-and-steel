import { routes } from '../data';
import {
  growIndependentRailroads,
  initializeIndependentRailroads,
} from '../independentRailroads';
import type {
  GameContext,
  GameState,
  IndependentRailroadRoute,
} from '../stores/gameStore';
import { citiesConnectedTo } from '../utils/graph';
import { generatePlayerAvatarColor } from '../utils/playerAvatar';
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
  activeCitiesPerRound: number;
}

export interface AcquiredRailroad {
  name: string;
  routes: IndependentRailroadRoute[];
  acquiredByPlayer: string;
  acquiredInRound: number;
}

/** Round in which each player acquired each city (starting cities use round 0). */
export type PlayerCityAcquiredInRound = Record<string, Record<string, number>>;

export interface GameResult {
  gameNumber: number;
  G: GameState;
  activeCities: string[];
  activeCitiesTotal: number;
  activeCitiesAverage: number;
  rrSizes: string[];
  maxRrSize: number;
  rrRoutes: string[];
  acquiredRailroads: AcquiredRailroad[];
  railroadColorIndices: Record<string, number>;
  playerCityAcquiredInRound: PlayerCityAcquiredInRound;
}

function seedStartingCities(
  G: GameState,
  numPlayers: number,
  playerCityAcquiredInRound: PlayerCityAcquiredInRound
): void {
  const pool: [string, string][] = shuffleArray([...STARTING_CITY_PAIRS]) as [string, string][];
  if (pool.length < numPlayers) {
    throw new Error(
      `Not enough starting city pairs for ${numPlayers} players (need ${numPlayers}, have ${pool.length}).`
    );
  }

  for (let i = 0; i < numPlayers; i++) {
    const [cityA, cityB] = pool.pop()!;
    const playerEntry = G.players[i];
    const player = playerEntry?.[1];
    if (player && playerEntry) {
      const playerId = playerEntry[0];
      player.activeCities = [cityA, cityB];
      const rounds = (playerCityAcquiredInRound[playerId] ??= {});
      rounds[cityA] = 0;
      rounds[cityB] = 0;
    } else {
      throw new Error(`Player ${i} not found in game state.`);
    }
  }
}

function createStubGame(
  numPlayers: number,
  playerCityAcquiredInRound: PlayerCityAcquiredInRound
): { G: GameState; ctx: GameContext } {
  const G: GameState = {
    contracts: [],
    players: Array.from({ length: numPlayers }, (_, i) => [
      String(i),
      {
        name: `Player ${i}`,
        activeCities: [],
        hubCity: null,
        regionalOffice: null,
        avatarColor: generatePlayerAvatarColor(),
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

  seedStartingCities(G, numPlayers, playerCityAcquiredInRound);
  return { G, ctx };
}

function captureRailroadColorIndices(G: GameState): Record<string, number> {
  const indices: Record<string, number> = {};
  Object.keys(G.independentRailroads).forEach((name, index) => {
    indices[name] = index;
  });
  return indices;
}

function expandCities(
  activeCities: string[],
  activeCitiesPerRound: number,
  round: number
): string | undefined {
  const target = Math.trunc(round * activeCitiesPerRound + 2);
  if (target <= activeCities.length && Math.random() < 0.75 && target <= (activeCities.length + 1)) {
    return undefined;
  }

  const owned = new Set(activeCities);
  const reachable = citiesConnectedTo(owned, { distance: 2, includeFromCities: false });
  const candidates = [...reachable].filter((city) => !owned.has(city));
  const picked = randomArrayItem(candidates) as string | undefined;
  if (picked != null) {
    activeCities.push(picked);
    return picked;
  }
  return undefined;
}

function collectRailroadCities(rr: {
  routes: IndependentRailroadRoute[];
}): Set<string> {
  const cities = new Set<string>();
  for (const routeEntry of rr.routes) {
    const route = routes.get(routeEntry.key);
    if (route) {
      cities.add(route.cities[0]);
      cities.add(route.cities[1]);
    }
  }
  return cities;
}

function checkAcquisitions(
  newCity: string,
  G: GameState,
  playerId: string,
  round: number,
  acquiredRailroads: AcquiredRailroad[],
  playerCityAcquiredInRound: PlayerCityAcquiredInRound
): void {
  const player = G.players.find(([id]) => id === playerId)?.[1];
  if (!player) return;

  for (const [rrName, rr] of Object.entries(G.independentRailroads)) {
    const rrCities = collectRailroadCities(rr);
    if (!rrCities.has(newCity)) continue;

    const owned = new Set(player.activeCities);
    const rounds = (playerCityAcquiredInRound[playerId] ??= {});
    for (const city of rrCities) {
      if (!owned.has(city)) {
        player.activeCities.push(city);
        owned.add(city);
        rounds[city] = round;
      }
    }

    acquiredRailroads.push({
      name: rr.name,
      routes: [...rr.routes],
      acquiredByPlayer: playerId,
      acquiredInRound: round,
    });

    delete G.independentRailroads[rrName];
    break;
  }
}

function runSingleGame(params: SimulationParams, gameNumber: number): GameResult {
  const playerCityAcquiredInRound: PlayerCityAcquiredInRound = {};
  const { G, ctx } = createStubGame(params.numPlayers, playerCityAcquiredInRound);
  const railroadColorIndices = captureRailroadColorIndices(G);
  const acquiredRailroads: AcquiredRailroad[] = [];

  for (let round = 1; round <= params.numRounds; round++) {
    ctx.round = round;

    for (const playerId of ctx.playOrder) {
      const player = G.players.find(([id]) => id === playerId)?.[1];
      if (player) {
        const newCity = expandCities(
          player.activeCities,
          params.activeCitiesPerRound,
          round
        );
        if (newCity) {
          const rounds = (playerCityAcquiredInRound[playerId] ??= {});
          rounds[newCity] = round;
          checkAcquisitions(
            newCity,
            G,
            playerId,
            round,
            acquiredRailroads,
            playerCityAcquiredInRound
          );
        }
      }
    }

    growIndependentRailroads(G, ctx);
  }

  const activeCities = G.players.flatMap(([, player]) => player.activeCities);
  const independentSizes = Object.values(G.independentRailroads).map((rr) => rr.routes.length);
  const acquiredSizes = acquiredRailroads.map((ar) => ar.routes.length);
  const rrSizes = [
    ...independentSizes.map(String),
    ...acquiredSizes.map((size) => `${size}*`),
  ];
  const allSizes = [...independentSizes, ...acquiredSizes];
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
    maxRrSize: allSizes.length > 0 ? Math.max(...allSizes) : 0,
    rrRoutes,
    acquiredRailroads,
    railroadColorIndices,
    playerCityAcquiredInRound,
  };
}

export function runSimulation(params: SimulationParams): GameResult[] {
  const results: GameResult[] = [];
  for (let i = 1; i <= params.numGames; i++) {
    results.push(runSingleGame(params, i));
  }
  return results;
}
