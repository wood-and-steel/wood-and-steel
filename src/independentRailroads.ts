import { cities, routes } from './data';
import { citiesConnectedTo } from './utils/graph';
import { weightedRandom, randomArrayItem } from './utils/random';
import type { GameState } from './stores/gameStore';

/**
 * Given a set of cities, return a set of all the route keys that do not include those cities.
 *
 * @param citiesToAvoid - Set of city keys to avoid
 * @returns Set of route keys that do not include these cities
 */
function routesWithoutTheseCities(citiesToAvoid: Set<string>): Set<string> {
  const routesFound = new Set<string>();
  routes.forEach((routeValue, routeKey) => {
    if (
      !citiesToAvoid.has(routeValue.cities[0]) &&
      !citiesToAvoid.has(routeValue.cities[1])
    ) {
      routesFound.add(routeKey);
    }
  });
  return routesFound;
}

/**
 * Initialize independent railroads: assign ~10% of eligible routes to new companies.
 * Eligible = routes not within 2 hops of possible starting cities.
 *
 * @returns Record of company name to { name, routes }
 */
export function initializeIndependentRailroads(): Record<
  string,
  { name: string; routes: string[] }
> {
  // Get the set of cities that are valid endpoints for independent railroads: everything not within 2 hops of possible starting cities
  const withinTwoOfStartingCities = citiesConnectedTo(
    [
      'Quebec City',
      'Montreal',
      'Boston',
      'Portland ME',
      'Philadelphia',
      'New York',
      'Washington',
      'Norfolk',
      'Raleigh',
      'Charleston',
      'Savannah',
    ],
    {
      distance: 2,
      includeFromCities: true,
    }
  );
  const routesAvailableToIndies =
    routesWithoutTheseCities(withinTwoOfStartingCities);

  // Calculate how many routes we want to assign (10% of total)
  const numberOfRoutesToAssign = Math.ceil(routesAvailableToIndies.size * 0.1);
  
  // Convert routes Map to array of entries for easier random selection
  const routeEntries = Array.from(routesAvailableToIndies.entries());

  // Shuffle the routes array
  function shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  const shuffledRoutes = shuffle([...routeEntries]);

  // Store independent railroads as a plain object
  const independentRailroads: Record<string, { name: string; routes: string[] }> =
    {};
  const routeOwnership = new Map<string, string>();
  const cityOwnership = new Map<string, string>();

  // Try to assign routes one by one
  let assignedCount = 0;

  while (assignedCount < numberOfRoutesToAssign && shuffledRoutes.length > 0) {
    const [routeKey] = shuffledRoutes.pop()!;

    // Create a new company name that doesn't already exist
    let companyCreated = false;
    let companyName: string = '';
    const route = routes.get(routeKey);
    if (!route) continue;
    const firstCity = cities.get(route.cities[0]);
    if (!firstCity) continue;
    while (!companyCreated) {
      companyName = generateRailroadName(firstCity.state);
      companyCreated = !independentRailroads[companyName];
    }

    // Check if route is already owned
    if (routeOwnership.has(routeKey)) {
      continue;
    }

    // Check if any cities in the route are owned by other companies
    const routeCities = route.cities;
    const isCityOwnedByOther = routeCities.some((cityKey) => {
      const owner = cityOwnership.get(cityKey);
      return owner != null && owner !== companyName;
    });

    if (!isCityOwnedByOther) {
      // Create the company and assign the route
      independentRailroads[companyName] = {
        name: companyName,
        routes: [routeKey],
      };

      // Record ownership of route and cities
      routeOwnership.set(routeKey, companyName);
      routeCities.forEach((city) => {
        if (!cityOwnership.has(city)) {
          cityOwnership.set(city, companyName);
        }
      });

      assignedCount++;
    }
  }

  return independentRailroads;
}

/**
 * Called at the end of a round; adds 0 or more segments and 0 or more independent railroad companies.
 *
 * @param G - Game state
 * @returns Set of IDs of added routes, or undefined if none were added
 */
export function growIndependentRailroads(
  G: GameState
): Set<string> | undefined {
  /*
   * Definitions used throughout this function:
   *  - available route: a route an independent railroad could occupy
   *  - occupancy: percentage of available routes with independent railroads on them
   */

  /*
   * Odds of independent railroads growing by different amounts given starting sizes.
   * How to read the nested maps:
   * - The key of the outer map is the current occupancy, rounded to the closest 5%.
   * - The inner map works with weightedRandom to return the number of percentage points by which
   *   the total independent RR network should grow.
   *
   * For example, if the independent RRs currently occupy 25% of the available routes, there's a
   * 10% chance they don't grow, a 70% chance they will grow to 25+2=27% occupancy and a 20% chance
   * they will grow to 25+4=29% occupancy.
   */
  const growthProbabilities = new Map<number, Map<number, number>>([
    [5, new Map([[2, 10], [4, 20], [6, 30], [8, 40]])],
    [10, new Map([[0, 5], [2, 45], [4, 35], [6, 10], [8, 5]])],
    [15, new Map([[0, 5], [2, 55], [4, 30], [6, 10]])],
    [20, new Map([[0, 10], [2, 60], [4, 25], [6, 5]])],
    [25, new Map([[0, 10], [2, 70], [4, 20]])],
    [30, new Map([[0, 35], [2, 50], [4, 15]])],
    [35, new Map([[0, 50], [2, 40], [4, 10]])],
    [40, new Map([[0, 70], [2, 30]])],
    [45, new Map([[0, 95], [2, 5]])],
  ]);

  // Min and max key values from above
  const smallestMappedOccupancy = Math.min(...growthProbabilities.keys());
  const largestMappedOccupancy = Math.max(...growthProbabilities.keys());

  // Collect keys of all active cities and what's adjacent to them
  const activeCities = new Set<string>();
  G.players.forEach(([, value]) => {
    value.activeCities.forEach((city) => activeCities.add(city));
  });
  const activeCitiesPlusOneHop = citiesConnectedTo(activeCities, {
    includeFromCities: true,
  });

  /*
   * Independent railroads can only grow into routes that are not adjacent to player routes.
   * We can't know all the players' routes, but hopefully everything within 1 of their active
   * cities will make a decent approximation.
   */
  const routesNotNearActiveCities =
    routesWithoutTheseCities(activeCitiesPlusOneHop);
  const railroadsArray = Object.values(G.independentRailroads);
  const startingRouteCount = railroadsArray.reduce(
    (acc, current) => acc + current.routes.length,
    0
  );
  let startingOccupancy = Math.round(
    (100 * startingRouteCount) / routesNotNearActiveCities.size
  );

  let occupancyLookup = Math.round(startingOccupancy / 5) * 5;
  if (occupancyLookup < smallestMappedOccupancy)
    occupancyLookup = smallestMappedOccupancy;
  else if (occupancyLookup > largestMappedOccupancy)
    occupancyLookup = largestMappedOccupancy;

  const lookupMap = growthProbabilities.get(occupancyLookup);
  const occupancyGrowth = lookupMap ? weightedRandom(lookupMap) : 0;

  // If there's a zero growth rate picked at random, we're done
  if (occupancyGrowth === 0 || occupancyGrowth === undefined) return undefined;

  const newOccupancy = startingOccupancy + occupancyGrowth;
  let newRouteCount = Math.round(
    0.01 * newOccupancy * routesNotNearActiveCities.size
  );

  // Rounding might mean that a non-zero increase in occupancy would still result in no growth. If this happens,
  // make it a 50/50 chance we'll grow by one route anyway.
  if (newRouteCount === startingRouteCount) {
    if (Math.random() > 0.5) {
      newRouteCount++;
    } else {
      return undefined;
    }
  }

  // Finally, we have the number of routes we're going to add during this independent growth action
  const numberOfRoutesToAdd = newRouteCount - startingRouteCount;
  const addedRoutes = new Set<string>();

  // Now we try to expand, up to 100 times
  let countOfAttempts = 0;

  while (addedRoutes.size < numberOfRoutesToAdd && countOfAttempts++ < 100) {
    // Pick an independent RR at random
    const railroadNames = Object.keys(G.independentRailroads);
    const randomRailroadName =
      railroadNames[Math.floor(Math.random() * railroadNames.length)];
    const railroadToExpand = G.independentRailroads[randomRailroadName];
    if (!railroadToExpand) continue;

    /*
     * Add one route
     */

    // Get all the cities in this RR
    const citiesInRailroad = new Set<string>();
    [...railroadToExpand.routes].forEach((routeKey) => {
      const route = routes.get(routeKey);
      if (route) {
        const [city1, city2] = route.cities;
        citiesInRailroad.add(city1).add(city2);
      }
    });

    // Get all the routes attached to those cities
    const routesSuperset = new Set<string>();
    [...citiesInRailroad].forEach((cityKey) => {
      const city = cities.get(cityKey);
      if (city) {
        city.routes.forEach((r) => routesSuperset.add(r));
      }
    });

    // Get all the cities in other independent RRs
    const citiesInOtherRailroads = new Set<string>();
    for (const [name, railroad] of Object.entries(G.independentRailroads)) {
      if (name !== randomRailroadName) {
        [...railroad.routes].forEach((routeKey) => {
          const route = routes.get(routeKey);
          if (route) {
            const [city1, city2] = route.cities;
            citiesInOtherRailroads.add(city1).add(city2);
          }
        });
      }
    }

    const routesOneHopAwayFromIndies = routesWithoutTheseCities(
      citiesConnectedTo(citiesInOtherRailroads, { includeFromCities: true })
    );

    // Routes that connect to this RR, are not already in it, are not one hop from other indies, and are not near active cities
    const possibleRoutes = new Set(
      [...routesSuperset].filter(
        (r) =>
          !railroadToExpand.routes.includes(r) &&
          !routesOneHopAwayFromIndies.has(r) &&
          routesNotNearActiveCities.has(r)
      )
    );

    if (possibleRoutes.size > 0) {
      const routeToAdd = randomArrayItem([...possibleRoutes]);
      if (routeToAdd !== undefined) {
        railroadToExpand.routes.push(routeToAdd);
        addedRoutes.add(routeToAdd);
      }
    }
  }

  return addedRoutes;
}

// State-specific industries and geographic features (used for name generation)
const stateCharacteristics: Record<
  string,
  { name: string; features: string[]; industries: string[] }
> = {
  AL: {
    name: 'Alabama',
    features: ['Valley', 'Ridge', 'Hills', 'River', 'Talladega', 'Black Belt'],
    industries: ['Cotton', 'Iron', 'Mining', 'Lumber', 'Agricultural'],
  },
  AZ: {
    name: 'Arizona',
    features: ['Mesa', 'Canyon', 'Desert', 'Mountain', 'Basin'],
    industries: ['Mining', 'Copper', 'Trading'],
  },
  AR: {
    name: 'Arkansas',
    features: ['Mountain', 'Highlands', 'Ridge', 'Ozark', 'Plains'],
    industries: ['Lumber', 'Cotton', 'Mining', 'Agricultural'],
  },
  CA: {
    name: 'California',
    features: ['Mountain', 'Valley', 'Coast', 'Bay', 'Desert', 'Pacific'],
    industries: ['Mining', 'Lumber', 'Agricultural', 'Maritime', 'Express'],
  },
  CO: {
    name: 'Colorado',
    features: ['Mountain', 'Peak', 'Valley', 'Canyon', 'Mesa', 'Rocky Mountain'],
    industries: ['Mining', 'Trading'],
  },
  CT: {
    name: 'Connecticut',
    features: ['River', 'Valley', 'Sound', 'Harbor', 'Atlantic', 'Brownstone'],
    industries: ['Industrial', 'Maritime', 'Commercial'],
  },
  DE: {
    name: 'Delaware',
    features: ['Bay', 'River', 'Coast', 'Harbor'],
    industries: ['Maritime', 'Industrial', 'Commercial'],
  },
  FL: {
    name: 'Florida',
    features: ['Coast', 'Bay', 'River', 'Harbor', 'Atlantic'],
    industries: ['Maritime', 'Lumber', 'Agricultural', 'Commercial'],
  },
  GA: {
    name: 'Georgia',
    features: ['Mountain', 'River', 'Coast', 'Valley', 'Atlantic'],
    industries: ['Cotton', 'Lumber', 'Agricultural', 'Maritime'],
  },
  ID: {
    name: 'Idaho',
    features: ['Mountain', 'Valley', 'River', 'Canyon'],
    industries: ['Mining', 'Lumber', 'Trading'],
  },
  IL: {
    name: 'Illinois',
    features: ['Prairie', 'Valley', 'River', 'Lake', 'Shawnee'],
    industries: ['Agricultural', 'Industrial', 'Commercial'],
  },
  IN: {
    name: 'Indiana',
    features: ['Prairie', 'Valley', 'River', 'Lake'],
    industries: ['Industrial', 'Agricultural', 'Commercial'],
  },
  IA: {
    name: 'Iowa',
    features: ['Prairie', 'Valley', 'River', 'Hills'],
    industries: ['Agricultural', 'Industrial', 'Commercial'],
  },
  KS: {
    name: 'Kansas',
    features: ['Prairie', 'Plains', 'River', 'Valley', 'Junction'],
    industries: ['Agricultural', 'Cattle', 'Trading'],
  },
  KY: {
    name: 'Kentucky',
    features: ['Mountain', 'Valley', 'River', 'Hills'],
    industries: ['Coal', 'Agricultural', 'Industrial'],
  },
  LA: {
    name: 'Lousiana',
    features: ['River', 'Bay', 'Coast', 'Delta'],
    industries: ['Cotton', 'Maritime', 'Agricultural', 'Commercial'],
  },
  ME: {
    name: 'Maine',
    features: ['Coast', 'Bay', 'Harbor', 'Lake', 'Forest', 'Atlantic'],
    industries: ['Lumber', 'Maritime', 'Industrial'],
  },
  MD: {
    name: 'Maryland',
    features: ['Bay', 'Harbor', 'Chesapeake', 'Piedmont'],
    industries: ['Maritime', 'Industrial', 'Commercial'],
  },
  MA: {
    name: 'Massachusetts',
    features: ['Bay', 'Harbor', 'Cape', 'Berkshire', 'Granite', 'Plymouth', 'Housatonic'],
    industries: ['Maritime', 'Industrial', 'Commercial'],
  },
  MI: {
    name: 'Michigan',
    features: ['Lake', 'Peninsula', 'Forest', 'Superior'],
    industries: ['Lumber', 'Mining', 'Industrial', 'Maritime'],
  },
  MN: {
    name: 'Minnesota',
    features: ['Lake', 'Arrowhead', 'Forest', 'Plains', 'Superior'],
    industries: ['Lumber', 'Mining', 'Agricultural'],
  },
  MS: {
    name: 'Mississippi',
    features: ['River', 'Delta', 'Coast', 'Bay'],
    industries: ['Cotton', 'Lumber', 'Maritime', 'Agricultural'],
  },
  MO: {
    name: 'Missouri',
    features: ['River', 'Valley', 'Prairie', 'Hills'],
    industries: ['Mining', 'Agricultural', 'Industrial'],
  },
  MT: {
    name: 'Montana',
    features: ['Mountain', 'Prairie', 'Canyon', 'Big Sky', 'Glocier'],
    industries: ['Mining', 'Cattle', 'Trading'],
  },
  NE: {
    name: 'Nebraska',
    features: ['Prairie', 'Plains', 'River', 'Valley'],
    industries: ['Agricultural', 'Cattle'],
  },
  NV: {
    name: 'Nevada',
    features: ['Mountain', 'Desert', 'Basin', 'Humboldt', 'Sierra'],
    industries: ['Mining', 'Trading'],
  },
  NH: {
    name: 'New Hampshire',
    features: ['Mountain', 'Valley', 'Monadnock', 'Timberland', 'Granite'],
    industries: ['Lumber', 'Industrial', 'Mining'],
  },
  NJ: {
    name: 'New Jersey',
    features: ['Coast', 'Bay', 'Harbor', 'Valley', 'Atlantic', 'Pine'],
    industries: ['Industrial', 'Maritime', 'Commercial'],
  },
  NM: {
    name: 'New Hampshire',
    features: ['River', 'Forest', 'Appalachian', 'Merrimack', 'Mountain'],
    industries: ['Mining', 'Textiles', 'Trading'],
  },
  NY: {
    name: 'New York',
    features: ['Lake', 'Valley', 'Mountain', 'Harbor', 'Upstate', 'Taconic', 'Erie'],
    industries: ['Agricultural', 'Maritime', 'Commercial'],
  },
  NC: {
    name: 'North Carolina',
    features: ['Blue Ridge', 'Piedmont', 'Coast', 'Sound', 'Atlantic'],
    industries: ['Lumber', 'Cotton', 'Maritime', 'Industrial'],
  },
  ND: {
    name: 'North Dakota',
    features: ['Prairie', 'Plains', 'Valley', 'River'],
    industries: ['Agricultural', 'Trading'],
  },
  OH: {
    name: 'Ohio',
    features: ['River', 'Valley', 'Lake', 'Hills'],
    industries: ['Industrial', 'Agricultural', 'Commercial'],
  },
  OK: {
    name: 'Oklahoma',
    features: ['Prairie', 'Great Plains', 'Mesa', 'Panhandle'],
    industries: ['Agricultural', 'Trading'],
  },
  OR: {
    name: 'Oregon',
    features: ['Cascades', 'Columbia', 'Coast', 'Forest', 'Pacific', 'Willamette'],
    industries: ['Lumber', 'Maritime'],
  },
  PA: {
    name: 'Pennsylvnia',
    features: ['Mountain', 'Valley', 'River', 'Forest', 'Keystone', 'Allegheny'],
    industries: ['Coal', 'Industrial', 'Commercial'],
  },
  RI: {
    name: 'Rhode Island',
    features: ['Bay', 'Harbor', 'Sound', 'Coast'],
    industries: ['Maritime', 'Industrial', 'Commercial'],
  },
  SC: {
    name: 'South Carolina',
    features: ['Coast', 'Valley', 'Harbor', 'River', 'Canal'],
    industries: ['Cotton', 'Maritime', 'Agricultural', 'Industrial'],
  },
  SD: {
    name: 'South Dakota',
    features: ['Prairie', 'Plains', 'Valley', 'Hills'],
    industries: ['Agricultural', 'Mining', 'Trading'],
  },
  TN: {
    name: 'Tennessee',
    features: ['Mountain', 'Valley', 'River', 'Upland', 'Blue Ridge'],
    industries: ['Coal', 'Agricultural', 'Industrial'],
  },
  TX: {
    name: 'Texas',
    features: ['Plains', 'Coast', 'Valley', 'Plains', 'Rio Grande'],
    industries: ['Cattle', 'Cotton', 'Petroleum', 'Trading'],
  },
  UT: {
    name: 'Utah',
    features: ['Mountain', 'Valley', 'Desert', 'Glen Canyon', 'Four Corners', 'Wasatch'],
    industries: ['Mining', 'Cattle', 'Trading'],
  },
  VT: {
    name: 'Vermont',
    features: ['Green Mountain', 'Valley', 'Champlain', 'Timberline', 'Burlington', 'River'],
    industries: ['Lumber', 'Agricultural', 'Granite'],
  },
  VA: {
    name: 'Virginia',
    features: ['Mountain', 'Valley', 'Coast', 'Bay'],
    industries: ['Coal', 'Maritime', 'Agricultural'],
  },
  WA: {
    name: 'Washington',
    features: ['Mountain', 'Puget Sound', 'Coast', 'Forest', 'Pacific', 'Cascadia'],
    industries: ['Lumber', 'Maritime'],
  },
  WV: {
    name: 'West Virginia',
    features: ['Mountain', 'Valley', 'River', 'Forest'],
    industries: ['Coal', 'Industrial'],
  },
  WI: {
    name: 'Wisconsin',
    features: ['Great Lakes', 'Ridge', 'Forest', 'Midwest'],
    industries: ['Lumber', 'Agricultural', 'Manufacturing', 'Dairy'],
  },
  WY: {
    name: 'Wyoming',
    features: ['Mountain', 'Valley', 'Plains', 'Basin'],
    industries: ['Mining', 'Cattle', 'Trading'],
  },
  BC: {
    name: 'British Columbia',
    features: ['Coast', 'Okanagan', 'Plateau', 'Valley', 'Island', 'Pacific', 'Glacier'],
    industries: ['Lumber', 'Maritime', 'Mining', 'Fishing'],
  },
  AB: {
    name: 'Alberta',
    features: ['Prairie', 'Mountain', 'Foothills', 'River', 'Canyon'],
    industries: ['Oil', 'Gas', 'Agricultural', 'Mining', 'Cattle'],
  },
  SK: {
    name: 'Saskatchewan',
    features: ['Prairie', 'Forest', 'Aspen', 'Athabasca', 'Basin'],
    industries: ['Agricultural', 'Wheat', 'Potash', 'Mining', 'Cattle'],
  },
  MB: {
    name: 'Manitoba',
    features: ['Prairie', 'Lake', 'Forest', 'River'],
    industries: ['Agricultural', 'Mining', 'Hydro-electric'],
  },
  ON: {
    name: 'Ontario',
    features: ['Great Lakes', 'River', 'Forest', 'Valley'],
    industries: ['Manufacturing', 'Agricultural', 'Mining'],
  },
  QC: {
    name: 'Quebec',
    features: ['River', 'Forest', 'Bay', 'Coast', 'Pine'],
    industries: ['Hydro-Electric', 'Forestry', 'Mining', 'Manufacturing'],
  },
  NB: {
    name: 'New Brunswick',
    features: ['Coast', 'Bay', 'Forest', 'River', 'Hill'],
    industries: ['Forestry', 'Fishing', 'Mining', 'Maritime'],
  },
};

// Common railroad terms that work anywhere
const regions = ['Northern', 'Southern', 'Eastern', 'Western', 'Central'];
// Grand single names (e.g. Enterprise, Pioneer)
const grandNames = [
  'Pioneer',
  'Liberty',
  'Enterprise',
  'Commonwealth',
  'Republic',
  'Continental',
  'Overland',
  'Frontier',
  'Trailblazer',
  'Excelsior',
  'Superior',
  'Imperial',
];

/**
 * Create a thematically appropriate railroad company name.
 * The first draft of this was written with the help of Claude.ai.
 *
 * @param state - State code whose features or industries may be used in the name (e.g. "MI")
 * @returns Generated company name
 */
function generateRailroadName(state?: string): string {
  const suffix = weightedRandom(
    new Map([
      ['Railway', 10],
      ['Railroad', 10],
      ['Line', 5],
      ['Transportation Company', 1],
      ['Rail Road', 1],
      ['Rail Company', 1],
    ])
  );
  // Determine name style
  const nameStyle = Math.random();

  if (typeof state !== 'string' || nameStyle < 0.2) {
    // 20% chance: Grand single name (e.g. Enterprise)
    const prefix = Math.random() < 0.5 ? 'The ' : '';
    const name = randomArrayItem(grandNames);
    return `${prefix}${name ?? 'Pioneer'} ${suffix ?? 'Railroad'}`;
  }

  if (nameStyle < 0.6) {
    // 40% chance: Industry/regional name (e.g. Michigan Lumber)
    const chars = stateCharacteristics[state];
    if (!chars) {
      const name = randomArrayItem(grandNames);
      return `${name ?? 'Pioneer'} ${suffix ?? 'Railroad'}`;
    }
    const direction = Math.random() < 0.5 ? `${randomArrayItem(regions) ?? ''} ` : '';
    const industry = randomArrayItem(chars.industries);
    return `${chars.name} ${direction}${industry ?? 'Railroad'} ${suffix ?? 'Railroad'}`;
  }

  // 40% chance: Paired geographic name (e.g. Valley & River)
  const chars = stateCharacteristics[state];
  if (!chars) {
    const name = randomArrayItem(grandNames);
    return `${name ?? 'Pioneer'} ${suffix ?? 'Railroad'}`;
  }
  const firstPart = randomArrayItem(chars.features);
  let secondPart = firstPart;
  const allSecond = [...regions, ...chars.features];
  while (secondPart === firstPart) {
    secondPart = randomArrayItem(allSecond) ?? firstPart;
  }
  return `${firstPart} & ${secondPart} ${suffix ?? 'Railroad'}`;
}
