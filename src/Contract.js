import { cities, commodities } from "./data";
import { shortestDistance, citiesConnectedTo } from "./utils/graph";
import { cardinalDirection } from "./utils/geo";
import { weightedRandom, randomSetItem } from "./utils/random";

/**
 * @typedef {Object} Contract
 * 
 * @property {string} id - unique ID of the contract
 * @property {string} destinationKey
 * @property {string} commodity
 * @property {boolean} fulfilled
 * @property {any} playerID
 */

/**
 * Create a starting private contract for a given pair of starting cities
 *
 * @param {*} G - Game state object
 * @param {string[2]} activeCitiesKeys - Keys of two starting cities
 * @param {*} playerID - player who will hold this contract
 * @returns {Contract}
 */
export function generateStartingContract(G, activeCitiesKeys, playerID) {  
  if (!Array.isArray(activeCitiesKeys) || activeCitiesKeys.length !== 2) {
    console.error(`generateStartingContract(${activeCitiesKeys}): not an Array(2)`);
    return undefined;
  }

  // Throughout this function, "candidate" is always a city key, for a city being considered as a destination for the contract

  // Get all cities within 2 hops of active (starting) cities without crossing mountains
  const candidates = citiesConnectedTo(activeCitiesKeys, {
    distance: 2, 
    routeTestFn: (r => !r.mountainous),
  }); 
  const candidatesByDirection = citiesByDirection(activeCitiesKeys, candidates);
  
  // If only two of the directions have cities, choose between those two directions 50/50
  // If all four directions have cities, choose one of them by these odds: N 15%, S 15%, E 35%, or W 35%

  const weightedDirections = new Map();
  
  if (candidatesByDirection.get("north").size === 0) {
    weightedDirections.set("east", 1).set("west", 1);
  } else if (candidatesByDirection.get("east").size === 0) {
    weightedDirections.set("north", 1).set("south", 1);
  } else {
    weightedDirections.set("north", 3).set("south", 3).set("east", 7).set("west", 7);
  }

  const candidatesInChosenDirection = Array.from(candidatesByDirection.get(weightedRandom(weightedDirections)));

  // Choose a commodity at random from those that are:
  //  - not available in every candidate destination city
  //  - available in the starting cities
  
  // List and count commodities in candidate destinations
  
  const candidateCountByCommodity = new Map();
  candidatesInChosenDirection.forEach(candidate => {
    cities.get(candidate).commodities.forEach(commodity => {
      if (candidateCountByCommodity.has(commodity)) 
        candidateCountByCommodity.set(commodity, (candidateCountByCommodity.get(commodity) + 1))
      else
        candidateCountByCommodity.set(commodity, 1);
    })
  });

  // Remember which commodities are available in all cities (thus not valid for delivery to this set of cities)
  const commoditiesInEveryCandidate = new Set();
  candidateCountByCommodity.forEach((count, commodity) => {
    if (count === candidatesInChosenDirection.length) commoditiesInEveryCandidate.add(commodity) 
  });
  
  // List all commodities available in active cities and remove the ones available in every potential destination
  const activeCitiesKeysCommodities = new Set();
  activeCitiesKeys.forEach(city => cities.get(city).commodities.forEach(commodity => activeCitiesKeysCommodities.add(commodity)));
  const validCommodities = new Set([...activeCitiesKeysCommodities].filter(c => !commoditiesInEveryCandidate.has(c)));

  // Pick a commodity for the contract
  const contractCommodity = randomSetItem(validCommodities);

  // Pick the destination, excluding candidate that supply the selected commodity
  const contractCity = weightedRandomCity(
    G,
    candidatesInChosenDirection.filter(candidate => !cities.get(candidate).commodities.includes(contractCommodity))
  );

  return newContract(contractCity, contractCommodity, { type: "private", playerID: playerID });
};


/**
 * Create a private contract from the given active cities and the starting city
 *
 * @param {*} G - Game state object
 * @param {string[]} activeCitiesKeys - Keys of all active cities
 * @param {string} currentCityKey - Key of the city to determine direction from
 * @returns {Contract}
 */
export function generatePrivateContract(G, ctx) {  
  const player = G.players.find(([id, props]) => id === ctx.currentPlayer);
  if (!player) {
    console.error(`generatePrivateContract: player ${ctx.currentPlayer} not found`);
    return undefined;
  }
  const activeCitiesKeys = Array.from(player[1].activeCities);
  const currentCityKey = activeCitiesKeys.at(-1);

  // Set odds for direction from currentCityKey, biased away from creating coastal connections

  const weightedDirections = new Map([ ["north", 3], ["south", 3] ]);
  if (cities.get(currentCityKey).nearEastCoast) {
    weightedDirections.set("east", 3).set("west", 11);
  } else if (cities.get(currentCityKey).nearWestCoast) {
    weightedDirections.set("east", 11).set("west", 3);
  } else {
    weightedDirections.set("east", 7).set("west", 7);
  }

  // Get all cities within 2 hops of active cities, split by direction
  const candidatesByDirection = citiesByDirection( [ currentCityKey ], citiesConnectedTo(activeCitiesKeys, { distance: 2 }) );
  
  // Pick a direction and a city
  const candidatesInChosenDirection = Array.from(candidatesByDirection.get(weightedRandom(weightedDirections)));
  if (candidatesInChosenDirection.length === 0) {
    console.error(`generatePrivateContract: no candidates found in chosen direction`);
    return undefined;
  }
  const contractCity = weightedRandomCity(G, candidatesInChosenDirection);

  // Choose a commodity at random from those that are:
  //  - available within 1 hop of active cities
  //  - not available in destination city
  const availableCommodities = new Set();
  activeCitiesKeys.forEach(activeCity => {
    cities.get(activeCity).commodities.forEach(commodity => {
      availableCommodities.add(commodity);
    })
  })
  cities.get(contractCity).commodities.forEach(commodity => { availableCommodities.delete(commodity); });

  // Pick a commodity for the contract
  const contractCommodity = randomSetItem(availableCommodities);

  return newContract(contractCity, contractCommodity, { type: "private", playerID: ctx.currentPlayer });
};


/**
 * Create a market contract from the given active cities
 *
 * @param {*} G - Game state object
 * @returns {Contract}
 */
export function generateMarketContract(G) {
  // Collect keys of all active cities
  const activeCitiesSet = new Set();
  G.players.forEach(([key, value]) => {
    value.activeCities.forEach(city => { activeCitiesSet.add(city); });
  })
  const activeCitiesKeys = [...activeCitiesSet];

  // Choose a city within 2 hops of active cities (but not an active city), randomly weighted by value
  const contractCity = weightedRandomCity(G, citiesConnectedTo(activeCitiesKeys, { distance: 2 }));

  // Choose a commodity at random from those that are:
  //  - not available in the destination city
  //  - available within any active city or 1 away from them
  //  - at least distance 2 from the destination (to ensure $6k or more value)
  
  const citiesWithinOneHop = citiesConnectedTo(activeCitiesKeys, {
    distance: 1,
    includeFromCities: true,
  });

  const possibleCommodities = new Set();
  citiesWithinOneHop.forEach(cityWithinOneHop => {
    const commodities = cities.get(cityWithinOneHop).commodities;
    commodities
      .filter(commodity => !cities.get(contractCity).commodities.includes(commodity))
      .forEach(commodityNotInContractCity => possibleCommodities.add(commodityNotInContractCity));
  });

  // Filter out commodities that are too close to the destination (distance < 2)
  // This ensures all market contracts are worth at least $6k (2 segments × $3k)
  const validCommodities = new Set();
  possibleCommodities.forEach(commodity => {
    const distance = shortestDistance(contractCity, c => cities.get(c)?.commodities.includes(commodity));
    if (distance >= 2) {
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

  return newContract(contractCity, contractCommodity, { type: "market" });
};


/**
 * Randomly pick a city, weighted by the relative value of the cities
 * @param {*} G - Game state object
 * @param {Array<String>|Set<String>} cities - Keys of cities to select from
 * @returns {String} - Key of randomly selected city
 */
function weightedRandomCity(G, cities) {
  return weightedRandom(new Map([...cities].map(city => [city, valueOfCity(G, city)])));
}


/**
 * Groups candidates into a Map of cardinal direction buckets. Candidates can appear in more than one bucket if there's 
 * more than one origin (from) city.
 * 
 * @param {string[]} fromCitiesKeys 
 * @param {string[]} candidateCitiesKeys 
 * @returns {Map}
 */
function citiesByDirection(fromCitiesKeys, candidateCitiesKeys) 
{
  let candidatesByDirection = new Map([
    ["north", new Set()],
    ["east", new Set()],
    ["south", new Set()],
    ["west", new Set()]
  ]);
  candidateCitiesKeys.forEach(candidate => {
    fromCitiesKeys.forEach(activeCity => {
      if (candidate !== activeCity) {
        candidatesByDirection.get(cardinalDirection(activeCity, candidate))?.add(candidate);
      }
    })
  })

  // If a list in one direction is empty, copy the opposite direction's list into it
  // This implements the requirement "If there are no cities in the selected direction, choose the opposite direction instead."

  if (candidatesByDirection.get("north").size === 0) {
    candidatesByDirection.set("north", candidatesByDirection.get("south"));
  } else if (candidatesByDirection.get("south").size === 0) {
    candidatesByDirection.set("south", candidatesByDirection.get("north"));
  }

  if (candidatesByDirection.get("east").size === 0) {
    candidatesByDirection.set("east", candidatesByDirection.get("west"));
  } else if (candidatesByDirection.get("west").size === 0) {
    candidatesByDirection.set("west", candidatesByDirection.get("east"));
  }

  return candidatesByDirection;
}


/**
 * Validates parameters and returns a contract object
 *
 * @export
 * @param {string} destinationKey = City of destination city
 * @param {string} commodity - Name of commodity
 * @param {Object} options
 * @param {"market"|"private"} [options.type="market"] - Type of contract
 * @param {boolean} [options.fulfilled=false] - Whether it has been fulfilled
 * @param {*} [options.playerID=null] - ID of player who fulfilled commodity
 * @returns {Contract|undefined} - contract object if successful, or undefined if not
 */
export function newContract(destinationKey, commodity, options = {}) {
  const {
    type = "market",
    fulfilled = false,
    playerID = null,
  } = options;

  if ((typeof destinationKey !== "string") || !cities.get(destinationKey)) {
    console.error(`newContract: "${destinationKey}" is not a city`);
    return undefined;
  }
  if ((typeof commodity !== "string") || !commodities.get(commodity)) {
    console.error(`newContract: "${commodity}" is not a commodity`);
    return undefined;
  }
  if (!(["market", "private"].includes(type))) {
    console.error(`newContract: "${type}" is not a valid type`);
    return undefined;
  }

  return {
    id: `${commodity.substring(0, 3)}-${cities.get(destinationKey).id}-${Date.now().toString(16)}`,
    destinationKey: destinationKey, 
    commodity: commodity, 
    type: type,
    fulfilled: fulfilled,
    playerID: playerID,
  }
}


/**
 * Returns the value of a city
 * 
 * @param {*} G
 * @param {string} cityKey 
 * @returns {number|undefined}
 */
export function valueOfCity(G, cityKey) {
  const city = cities.get(cityKey);

  if (city === undefined) {
    console.error(`valueOfCity("${cityKey}"): could not find cityKey)`);
    return undefined;
  }

  let contractsFulfilledHere = 0, contractsWithCommoditiesFromHere = 0;

  G.contracts.forEach(contract => {
    if (contract.fulfilled) {
      contractsFulfilledHere += (contract.destinationKey === cityKey);
      contractsWithCommoditiesFromHere += (city.commodities.includes(contract.commodity));
    }
  });

  const value = 2 * (1 + 
    (city.commodities.length > 0) + 
    city.large + 
    (3 * city.westCoast)) +
    (2 * contractsFulfilledHere) +
    contractsWithCommoditiesFromHere;
  
  return value;
}


/**
 * Dollar value of this contract if fulfilled
 *
 * @param {Contract}
 * @type {number}
 */
export function rewardValue(contract) {
  // $3,000 per segment of the distance between the destination city and the closest city that provides the commodity
  return shortestDistance(contract.destinationKey, c => cities.get(c)?.commodities.includes(contract.commodity)) * 3000;
}


/**
 * Railroad tie value of this contract if fulfilled
 *
 * @param {Contract}
 * @type {number}
 */
export function railroadTieValue(contract) {

  // The value of a contract is based on the shortest distance between the destination 
  // city and any city that provides the commodity.

  const destinationRegion = cities.get(contract.destinationKey).region;
  const commodityRegions = commodities.get(contract.commodity).regions;

  // Railroad tie value matrix: rows are destination regions, columns are commodity regions
  // Order: NW, NC, NE, SW, SC, SE
  const regionValues = {
    "NW": [1, 2, 3, 2, 3, 4],
    "NC": [2, 1, 2, 3, 2, 3],
    "NE": [3, 2, 1, 4, 3, 2],
    "SW": [2, 3, 4, 1, 2, 3],
    "SC": [3, 2, 3, 2, 1, 2],
    "SE": [4, 3, 2, 3, 2, 1]
  };
  
  const regionOrder = ["NW", "NC", "NE", "SW", "SC", "SE"];
  
  // Find minimum railroad tie value across all commodity regions
  const values = commodityRegions.map(commodityRegion => {
    const columnIndex = regionOrder.indexOf(commodityRegion);
    return regionValues[destinationRegion][columnIndex];
  });
  
  return Math.min(...values);
}
