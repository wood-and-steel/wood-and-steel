import { cities, commodities } from "./data";
import type { GameState, GameContext } from "./stores/gameStore";
import { shortestDistance, citiesConnectedTo } from "./utils/graph";
import { cardinalDirection } from "./utils/geo";
import { weightedRandom, randomSetItem } from "./utils/random";

/** Contract type: id, destination, commodity, fulfillment, and optional player. */
export interface Contract {
  id: string;
  destinationKey: string;
  commodity: string;
  type: "market" | "private";
  fulfilled: boolean;
  playerID: string | null;
  creationTime: number;
  /** Number of turns the current holder has held it, or null if unassigned. Must be null when playerID is null; may be a non-negative integer when playerID is set. */
  turnsHeld: number | null;
}

/** Spec for a private contract before it is assigned to a player. */
export interface PrivateContractSpec {
  commodity: string;
  destinationKey: string;
}

/** Valid region codes for commodity filtering. */
const COMMODITY_REGION_CODES = ["NW", "NC", "NE", "SW", "SC", "SE"] as const;
export type CommodityRegionCode = (typeof COMMODITY_REGION_CODES)[number];

/** Options for newContract. */
interface NewContractOptions {
  type?: "market" | "private";
  fulfilled?: boolean;
  playerID?: string | null;
}

/**
 * Create a starting private contract for a given pair of starting cities
 *
 * @param G - Game state object
 * @param activeCitiesKeys - Keys of two starting cities
 * @param playerID - Player who will hold this contract
 * @returns A contract, or undefined if generation fails
 */
export function generateStartingContract(
  G: GameState,
  activeCitiesKeys: [string, string],
  playerID: string
): Contract | undefined {
  if (!Array.isArray(activeCitiesKeys) || activeCitiesKeys.length !== 2) {
    console.error(`generateStartingContract(${activeCitiesKeys}): not an Array(2)`);
    return undefined;
  }

  // Throughout this function, "candidate" is always a city key, for a city being considered as a destination for the contract

  // Get all cities within 2 hops of active (starting) cities without crossing mountains
  const candidates = citiesConnectedTo(activeCitiesKeys, {
    distance: 2,
    routeTestFn: (route: { mountainous?: boolean }) => !route.mountainous,
  });
  const candidatesByDirection = citiesByDirection(activeCitiesKeys, Array.from(candidates));

  // If only two of the directions have cities, choose between those two directions 50/50.
  // If all four directions have cities, choose one of them by these odds: N 15%, S 15%, E 35%, or W 35%
  
  const weightedDirections = new Map<string, number>();

  if (candidatesByDirection.get("north")?.size === 0) {
    weightedDirections.set("east", 1).set("west", 1);
  } else if (candidatesByDirection.get("east")?.size === 0) {
    weightedDirections.set("north", 1).set("south", 1);
  } else {
    weightedDirections.set("north", 3).set("south", 3).set("east", 7).set("west", 7);
  }

  const chosenDirection = weightedRandom(weightedDirections);
  const candidatesInChosenDirection = Array.from(candidatesByDirection.get(chosenDirection) ?? []);
  if (candidatesInChosenDirection.length === 0) {
    return undefined;
  }

  // Choose a commodity at random from those that are:
  //  - not available in every candidate destination city
  //  - available in the starting cities
  //
  // List and count commodities in candidate destinations

  const candidateCountByCommodity = new Map<string, number>();
  candidatesInChosenDirection.forEach((candidate) => {
    const city = cities.get(candidate);
    if (!city) return;
    city.commodities.forEach((commodity) => {
      const prev = candidateCountByCommodity.get(commodity) ?? 0;
      candidateCountByCommodity.set(commodity, prev + 1);
    });
  });

  // Remember which commodities are available in all cities (thus not valid for delivery to this set of cities)
  const commoditiesInEveryCandidate = new Set<string>();
  candidateCountByCommodity.forEach((count, commodity) => {
    if (count === candidatesInChosenDirection.length) commoditiesInEveryCandidate.add(commodity);
  });

  // List all commodities available in active cities and remove the ones available in every potential destination
  const activeCitiesKeysCommodities = new Set<string>();
  activeCitiesKeys.forEach((cityKey) => {
    const city = cities.get(cityKey);
    if (city) city.commodities.forEach((c) => activeCitiesKeysCommodities.add(c));
  });
  const validCommodities = new Set(
    [...activeCitiesKeysCommodities].filter((c) => !commoditiesInEveryCandidate.has(c))
  );

  // Pick a commodity for the contract
  const contractCommodity = randomSetItem(validCommodities);
  if (!contractCommodity) return undefined;

  // Pick the destination, excluding candidates that supply the selected commodity
  const contractCity = weightedRandomCity(
    G,
    candidatesInChosenDirection.filter((candidate) => {
      const city = cities.get(candidate);
      return city && !city.commodities.includes(contractCommodity);
    })
  );
  if (!contractCity) return undefined;

  return newContract(contractCity, contractCommodity, { type: "private", playerID });
}

/**
 * Pure generation of a private contract spec (commodity + destination) for the current player.
 * No newContract, no playerID assigned to the contract.
 *
 * @param G - Game state object
 * @param ctx - Game context
 * @param commodityRegion - Optional region code (NW, NC, NE, SW, SC, SE). If provided, candidate commodities are those supplied in that region instead of within one hop of active cities.
 * @returns A spec with commodity and destinationKey, or undefined
 */
export function generatePrivateContractSpec(
  G: GameState,
  ctx: GameContext,
  commodityRegion?: CommodityRegionCode
): PrivateContractSpec | undefined {
  const player = G.players.find(([id]) => id === ctx.currentPlayer);
  if (!player) {
    console.error(`generatePrivateContractSpec: player ${ctx.currentPlayer} not found`);
    return undefined;
  }
  const activeCitiesKeys = Array.from(player[1].activeCities);
  const currentCityKey = activeCitiesKeys[activeCitiesKeys.length - 1];
  if (!currentCityKey) return undefined;

  // Set odds for direction from currentCityKey, biased away from creating coastal connections
  const weightedDirections = new Map<string, number>([
    ["north", 3],
    ["south", 3],
  ]);
  const currentCity = cities.get(currentCityKey);
  if (!currentCity) return undefined;
  if (currentCity.nearEastCoast) {
    weightedDirections.set("east", 3).set("west", 11);
  } else if (currentCity.nearWestCoast) {
    weightedDirections.set("east", 11).set("west", 3);
  } else {
    weightedDirections.set("east", 7).set("west", 7);
  }

  // Get all cities within 2 hops of active cities, split by direction
  const candidatesByDirection = citiesByDirection(
    [currentCityKey],
    Array.from(citiesConnectedTo(activeCitiesKeys, { distance: 2 }))
  );

  // Pick a direction and a city
  const chosenDirection = weightedRandom(weightedDirections);
  const candidatesInChosenDirection = Array.from(candidatesByDirection.get(chosenDirection) ?? []);
  if (candidatesInChosenDirection.length === 0) {
    console.error(`generatePrivateContractSpec: no candidates found in chosen direction`);
    return undefined;
  }
  const contractCity = weightedRandomCity(G, candidatesInChosenDirection);
  if (!contractCity) return undefined;

  // Choose a commodity at random from those that are:
  //  - available within 1 hop of active cities (or all commodities in commodityRegion if provided)
  //  - not available in destination city
  const availableCommodities = new Set<string>();
  if (commodityRegion === undefined) {
    const citiesWithinOneHop = Array.from(citiesConnectedTo(activeCitiesKeys, { distance: 1 }));
    citiesWithinOneHop.forEach((cityKey) => {
      const city = cities.get(cityKey);
      if (city) city.commodities.forEach((c) => availableCommodities.add(c));
    });
  } else {
    commodities.forEach((data, key) => {
      if (data.regions.includes(commodityRegion)) availableCommodities.add(key);
    });
  }
  const destCity = cities.get(contractCity);
  if (destCity) destCity.commodities.forEach((c) => availableCommodities.delete(c));

  // Pick a commodity for the contract
  const contractCommodity = randomSetItem(availableCommodities);
  if (!contractCommodity) return undefined;

  return { commodity: contractCommodity, destinationKey: contractCity };
}

/**
 * Returns unique private contract specs. Deduplicates by commodity|destinationKey;
 * retries generation until the requested count is reached or max attempts reached.
 *
 * @param G - Game state object
 * @param ctx - Game context
 * @param count - Number of offers to generate (default 2)
 */
export function generatePrivateContractOffers(
  G: GameState,
  ctx: GameContext
): PrivateContractSpec[] {
  const seen = new Set<string>();
  const offers: PrivateContractSpec[] = [];
  const maxAttempts = 50;
  const currentPlayer = G.players.find(([id]) => id === ctx.currentPlayer)?.[1];
  let offerCount: number = 2 + (currentPlayer?.hubCity != null ? 1 : 0);

  // If player has a regional office, generate a contract spec for it first
  if (currentPlayer?.regionalOffice != null) {
    offerCount += 1;
    const spec = generatePrivateContractSpec(G, ctx, currentPlayer.regionalOffice);
    if (spec) {
      offers.push(spec);
      seen.add(`${spec.commodity}|${spec.destinationKey}`);
    }
  }

  // Generate remaining specs while avoiding duplicates
  for (let attempts = 0; attempts < maxAttempts && offers.length < offerCount; attempts++) {
    const spec = generatePrivateContractSpec(G, ctx);
    if (!spec) continue;

    const key = `${spec.commodity}|${spec.destinationKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    offers.push(spec);
  }

  return offers;
}

/**
 * Create a private contract from the given active cities and the starting city
 *
 * @param G - Game state object
 * @param ctx - Game context
 * @returns A contract, or undefined if generation fails
 */
export function generatePrivateContract(
  G: GameState,
  ctx: GameContext
): Contract | undefined {
  const spec = generatePrivateContractSpec(G, ctx);
  if (!spec) return undefined;
  return newContract(spec.destinationKey, spec.commodity, {
    type: "private",
    playerID: ctx.currentPlayer,
  });
}

/**
 * Create a market contract from the given active cities
 *
 * @param G - Game state object
 * @returns A contract, or undefined if generation fails
 */
export function generateMarketContract(G: GameState): Contract | undefined {
  // Collect keys of all active cities
  const activeCitiesSet = new Set<string>();
  G.players.forEach(([, value]) => {
    value.activeCities.forEach((city) => activeCitiesSet.add(city));
  });
  const activeCitiesKeys = [...activeCitiesSet];

  // Choose a city within 2 hops of active cities (but not an active city), randomly weighted by value
  const candidatesSet = citiesConnectedTo(activeCitiesKeys, { distance: 2 });
  const contractCity = weightedRandomCity(G, candidatesSet);
  if (!contractCity) return undefined;

  // Choose a commodity at random from those that are:
  //  - not available in the destination city
  //  - available within any active city or 1 away from them
  //  - at least distance 2 from the destination (to ensure $6k or more value)
  const citiesWithinOneHop = citiesConnectedTo(activeCitiesKeys, {
    distance: 1,
    includeFromCities: true,
  });

  const possibleCommodities = new Set<string>();
  citiesWithinOneHop.forEach((cityWithinOneHop) => {
    const city = cities.get(cityWithinOneHop);
    if (!city) return;
    const destCity = cities.get(contractCity);
    if (!destCity) return;
    city.commodities
      .filter((commodity) => !destCity.commodities.includes(commodity))
      .forEach((c) => possibleCommodities.add(c));
  });

  // Filter out commodities that are too close to the destination (distance < 2).
  // This ensures all market contracts are worth at least $6k (2 segments × $3k)
  const validCommodities = new Set<string>();
  possibleCommodities.forEach((commodity) => {
    const distance = shortestDistance(
      contractCity,
      (c: string) => (cities.get(c)?.commodities.includes(commodity) ?? false)
    );
    if (distance !== undefined && distance >= 2) {
      validCommodities.add(commodity);
    }
  });

  // TODO: Write test to ensure this case never happens (low priority, seems very unlikely by inspection)
  if (validCommodities.size === 0) {
    console.error(`generateMarketContract: no valid commodities with distance >= 2`);
    return undefined;
  }

  // Pick a commodity for the contract
  const contractCommodity = randomSetItem(validCommodities);
  if (!contractCommodity) return undefined;

  return newContract(contractCity, contractCommodity, { type: "market" });
}

/**
 * Randomly pick a city, weighted by the relative value of the cities.
 *
 * @param G - Game state object
 * @param cityKeys - Keys of cities to select from (array or Set)
 * @returns Key of randomly selected city, or undefined if none
 */
function weightedRandomCity(
  G: GameState,
  cityKeys: Iterable<string>
): string | undefined {
  const citiesArr = [...cityKeys];
  if (citiesArr.length === 0) return undefined;
  const weightMap = new Map<string, number>();
  citiesArr.forEach((cityKey) => {
    const v = valueOfCity(G, cityKey);
    if (v !== undefined) weightMap.set(cityKey, v);
  });
  return weightedRandom(weightMap);
}

// TODO: Import CardinalDirection from utils/geo when that module is migrated to TS
type CardinalDirection = "north" | "east" | "south" | "west";

/**
 * Groups candidates into a Map of cardinal direction buckets. Candidates can appear in more than one bucket if there's
 * more than one origin (from) city. If there are no cities in a direction, the opposite direction's list is copied into it.
 *
 * @param fromCitiesKeys - Keys of origin cities
 * @param candidateCitiesKeys - Keys of candidate cities to bucket
 * @returns Map of cardinal direction (e.g. "north") to sets of candidate city keys
 */
function citiesByDirection(
  fromCitiesKeys: string[],
  candidateCitiesKeys: string[]
): Map<string, Set<string>> {
  const candidatesByDirection = new Map<CardinalDirection, Set<string>>([
    ["north", new Set()],
    ["east", new Set()],
    ["south", new Set()],
    ["west", new Set()],
  ]);
  candidateCitiesKeys.forEach((candidate) => {
    fromCitiesKeys.forEach((activeCity) => {
      if (candidate !== activeCity) {
        const dir = cardinalDirection(activeCity, candidate) as CardinalDirection | undefined;
        if (dir) candidatesByDirection.get(dir)?.add(candidate);
      }
    });
  });

  if (candidatesByDirection.get("north")!.size === 0) {
    candidatesByDirection.set("north", candidatesByDirection.get("south")!);
  } else if (candidatesByDirection.get("south")!.size === 0) {
    candidatesByDirection.set("south", candidatesByDirection.get("north")!);
  }
  if (candidatesByDirection.get("east")!.size === 0) {
    candidatesByDirection.set("east", candidatesByDirection.get("west")!);
  } else if (candidatesByDirection.get("west")!.size === 0) {
    candidatesByDirection.set("west", candidatesByDirection.get("east")!);
  }

  return candidatesByDirection as Map<string, Set<string>>;
}

/**
 * Validates parameters and returns a contract object.
 *
 * @param destinationKey - Key of destination city
 * @param commodity - Name of commodity
 * @param options - Optional type ("market" | "private"), fulfilled flag, and playerID
 * @returns Contract object if successful, or undefined if not
 */
export function newContract(
  destinationKey: string,
  commodity: string,
  options: NewContractOptions = {}
): Contract | undefined {
  const { type = "market", fulfilled = false, playerID = null } = options;

  if (typeof destinationKey !== "string" || !cities.get(destinationKey)) {
    console.error(`newContract: "${destinationKey}" is not a city`);
    return undefined;
  }
  if (typeof commodity !== "string" || !commodities.get(commodity)) {
    console.error(`newContract: "${commodity}" is not a commodity`);
    return undefined;
  }
  if (!["market", "private"].includes(type)) {
    console.error(`newContract: "${type}" is not a valid type`);
    return undefined;
  }

  const city = cities.get(destinationKey)!;
  const now = Date.now();
  return {
    id: `${commodity.substring(0, 3)}-${city.id}-${now.toString(16)}`,
    destinationKey,
    commodity,
    type,
    fulfilled,
    playerID,
    creationTime: now,
    turnsHeld: null,
  };
}

/**
 * Returns the value of a city (used for weighting random city selection).
 *
 * @param G - Game state object
 * @param cityKey - Key of the city
 * @param options
 * @param options.isHubCity - If true, include the value of each city within 1 hop (default false)
 * @returns Numeric value, or undefined if city not found
 */
export function valueOfCity(
  G: GameState,
  cityKey: string,
  options: { isHubCity?: boolean } = {}
): number | undefined {
  const { isHubCity = false } = options;
  const city = cities.get(cityKey);

  if (city === undefined) {
    console.error(`valueOfCity("${cityKey}"): could not find cityKey)`);
    return undefined;
  }

  let contractsFulfilledHere = 0,
    contractsWithCommoditiesFromHere = 0;

  G.contracts.forEach((contract) => {
    if (contract.fulfilled) {
      contractsFulfilledHere += contract.destinationKey === cityKey ? 1 : 0;
      contractsWithCommoditiesFromHere += city.commodities.includes(contract.commodity) ? 1 : 0;
    }
  });

  let value =
    2 *
      (1 +
        (city.commodities.length > 0 ? 1 : 0) +
        (city.large ? 1 : 0) +
        3 * (city.westCoast ? 1 : 0)) +
    (2 * contractsFulfilledHere) +
    contractsWithCommoditiesFromHere;

  if (isHubCity) {
    const connected = citiesConnectedTo([cityKey], {});
    for (const key of connected) {
      value += valueOfCity(G, key) ?? 0;
    }
  }

  return value;
}

/**
 * Dollar value of this contract if fulfilled.
 * $3,000 per segment of the distance between the destination city and the closest city that provides the commodity.
 *
 * @param contract - The contract or spec (needs destinationKey and commodity)
 * @returns Dollar value
 */
export function moneyValue(contract: Pick<Contract, "destinationKey" | "commodity">): number {
  return (
    shortestDistance(contract.destinationKey, (c: string) =>
      cities.get(c)?.commodities.includes(contract.commodity) ?? false
    ) ?? 0
  ) * 3000;
}

/**
 * Railroad tie value of this contract if fulfilled.
 * The value is based on the shortest distance between the destination city and any city that provides the commodity.
 *
 * @param contract - The contract or spec (needs destinationKey and commodity)
 * @returns Railroad tie value (1–4)
 */
export function railroadTieValue(contract: Pick<Contract, "destinationKey" | "commodity">): number {
  const destCity = cities.get(contract.destinationKey);
  const commodityRec = commodities.get(contract.commodity);
  if (!destCity || !commodityRec) return 0;

  const destinationRegion = destCity.region;
  const commodityRegions = commodityRec.regions;

  // Railroad tie value matrix: rows are destination regions, columns are commodity regions. Order: NW, NC, NE, SW, SC, SE
  const regionValues: Record<string, number[]> = {
    NW: [1, 2, 3, 2, 3, 4],
    NC: [2, 1, 2, 3, 2, 3],
    NE: [3, 2, 1, 4, 3, 2],
    SW: [2, 3, 4, 1, 2, 3],
    SC: [3, 2, 3, 2, 1, 2],
    SE: [4, 3, 2, 3, 2, 1],
  };

  const regionOrder = ["NW", "NC", "NE", "SW", "SC", "SE"];

  // Find minimum railroad tie value across all commodity regions
  const values = commodityRegions.map((commodityRegion) => {
    const columnIndex = regionOrder.indexOf(commodityRegion);
    return regionValues[destinationRegion]?.[columnIndex] ?? 0;
  });

  return Math.min(...values);
}
