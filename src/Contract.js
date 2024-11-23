import { cities, commodities } from "./GameData";
import { shortestDistance, citiesConnectedTo } from "./graph";
import { cardinalDirection } from "./geo";

/**
 * @typedef {Object} Contract
 * 
 * @property {string} destinationKey
 * @property {string} commodity
 * @property {boolean} fulfilled
 * @property {any} playerID
 */

/**
 * Create a starting private contract for a given pair of starting cities
 *
 * @param {*} G                             - boardgame.io global state
 * @param {string[2]} activeCitiesKeys      - Keys of two starting cities
 * @returns {Contract}
 */
export function generateStartingContract(G, activeCitiesKeys) {  
  if (!Array.isArray(activeCitiesKeys) || activeCitiesKeys.length !== 2) {
    console.error(`generateStartingContract(${activeCitiesKeys}): not an Array(2)`);
    return undefined;
  }

  // Throughout this function, "candidate" is always a city key, for a city being considered as a destination for the contract

  // Get all cities within 2 hops of active (starting) cities without crossing mountains
  const candidates = citiesConnectedTo(activeCitiesKeys, 2, (r => !r.mountainous));
  const candidatesByDirection = citiesByDirection(activeCitiesKeys, candidates);
  
  // If only two of the directions have cities, choose between those two directions 50/50
  // If all four directions have cities, choose one of them by these odds: N 20%, S 20%, E 30%, or W 30%

  const weightedDirections = new Map();
  
  if (candidatesByDirection.get("north").size === 0) {
    weightedDirections.set("east", 1).set("west", 1);
  } else if (candidatesByDirection.get("east").size === 0) {
    weightedDirections.set("north", 1).set("south", 1);
  } else {
    weightedDirections.set("north", 2).set("south", 2).set("east", 3).set("west", 3);
  }

  const candidatesInChosenDirection = Array.from(candidatesByDirection.get(weightedRandom(weightedDirections)));

  // Choose a commodity at random from those that are:
  //  - not available in every candidate desintation city
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
  const validCommodities = activeCitiesKeysCommodities.difference(commoditiesInEveryCandidate);

  // Pick a commodity for the contract
  const contractCommodity = [...validCommodities][Math.floor(Math.random() * validCommodities.size)];

  // Pick the destination, excluding candidate that supply the selected commodity
  const contractCity = weightedRandomCity(
    G,
    candidatesInChosenDirection.filter(candidate => !cities.get(candidate).commodities.includes(contractCommodity))
  );

  return newContract(contractCity, contractCommodity, { type: "private" });
};


/**
 * Create a private contract from the given active cities and the starting city
 *
 * @param {*} G                             - boardgame.io global state
 * @param {string[]} activeCitiesKeys       - Keys of all active cities
 * @param {string} currentCityKey           - Key of the city to determine direction from
 * @returns {Contract}
 */
export function generatePrivateContract(G, activeCitiesKeys, currentCityKey) {  
  if (!Array.isArray(activeCitiesKeys) || activeCitiesKeys.length === 0) {
    console.error(`generateMarketContract(${activeCitiesKeys}): not an array of non-zero length`);
    return undefined;
  }

  // Set odds for direction from currentCityKey, biased away from creating coastal connections

  const weightedDirections = new Map([ ["north", 2], ["south", 2] ]);
  if (cities.get(currentCityKey).nearEastCoast) {
    weightedDirections.set("east", 2).set("west", 4);
  } else if (cities.get(currentCityKey).nearWestCoast) {
    weightedDirections.set("east", 4).set("west", 2);
  } else {
    weightedDirections.set("east", 3).set("west", 3);
  }

  // Get all cities within 2 hops of current city, split by direction
  const candidatesByDirection = citiesByDirection( [ currentCityKey ], citiesConnectedTo(activeCitiesKeys, 2) );
  
  // Pick a direction and a city
  // TODO: Make sure these don't return any empty arrays
  const candidatesInChosenDirection = Array.from(candidatesByDirection.get(weightedRandom(weightedDirections)));
  const contractCity = weightedRandomCity(G, candidatesInChosenDirection);

  // Choose a commodity at random from those that are:
  //  - available within 1 hop of active cities
  //  - not avilable in destination city
  const availableCommodities = new Set();
  activeCitiesKeys.forEach(activeCity => {
    cities.get(activeCity).commodities.forEach(commodity => {
      availableCommodities.add(commodity);
    })
  })
  cities.get(contractCity).commodities.forEach(commodity => { availableCommodities.delete(commodity); });

  // Pick a commodity for the contract
  const contractCommodity = [...availableCommodities][Math.floor(Math.random() * availableCommodities.size)];

  return newContract(contractCity, contractCommodity, { type: "private" });
};


/**
 * Create a market contract from the given active cities
 *
 * @param {*} G                             - boardgame.io global state
 * @param {string[]} activeCitiesKeys       - Keys of all active cities
 * @returns {Contract}
 */
export function generateMarketContract(G, activeCitiesKeys) {  
  if (!Array.isArray(activeCitiesKeys) || activeCitiesKeys.length === 0) {
    console.error(`generateMarketContract(${activeCitiesKeys}): not an array with at least 1 city`);
    return undefined;
  }

  // Choose a city within 2 hops of active cities (but not an active city), randomly weighted by value
  const contractCity = weightedRandomCity(G, citiesConnectedTo(activeCitiesKeys, 2));

  // Choose a commodity at random from those that are:
  //  - not available in the desintation city
  //  - available within any active city or 1 away from them
  
  const citiesWithinOneHop = [ ...(citiesConnectedTo(activeCitiesKeys, 1)), ...activeCitiesKeys ];

  const possibleCommodities = new Set();
  citiesWithinOneHop.forEach(cityWithinOneHop => {
    const commodities = cities.get(cityWithinOneHop).commodities;
    commodities
      .filter(commodity => !cities.get(contractCity).commodities.includes(commodity))
      .forEach(commodityNotInContractCity => possibleCommodities.add(commodityNotInContractCity));
  });

  // TODO: Write test to ensure this case never happens (low priority, seems very unlikely by inspection)
  if (possibleCommodities.size === 0) {
    console.error(`generateMarketContract: no possible commodities`);
    return undefined;
  }

  // Pick a commodity for the contract
  const contractCommodity = [...possibleCommodities][Math.floor(Math.random() * possibleCommodities.size)];

  return newContract(contractCity, contractCommodity, { type: "market" });
};


/**
 * Randomly pick a city, weighted by the relative value of the cities
 *
 * @param {*} G                                   - boardgame.io global state
 * @param {Array<String>|Set<String>} cities      - Keys of cities to select from
 * @returns {String}                              - Key of randomly selected city
 */
function weightedRandomCity(G, cities) {
  return weightedRandom(new Map([...cities].map(city => [city, valueOfCity(G, city)])));
}


/**
 * Randomly pick a key from a map, weighted by the relative integer value of the keys
 *
 * @param {Map<any, number>} weightedMap    - Map where the keys are the choices and values are their integer weights
 * @returns {any}                           - Randomly selected key from weightedMap
 */
function weightedRandom(weightedMap) {
  let chosenKey = undefined;
  const sumValues = weightedMap.values().reduce((accumulator, currentValue) => accumulator + currentValue, 0);

  const finalDieRoll = Math.floor(Math.random() * sumValues);
  let skipped = 0;
  weightedMap.forEach((value, choice) => {
    if (finalDieRoll < value + skipped && !chosenKey)
      chosenKey = choice
    else
      skipped += value;
  });

  return chosenKey;
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

  // If a list in one direction is empty, copy the opposite direction’s list into it
  // Thie implements the requirement "If there are no cities in the selected direction, choose the opposite direction instead."

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
 * @param {string} destinationKey
 * @param {string} commodity
 * @param {{ type: string; fulfilled: boolean; }} [options={
 *   type: "market",
 *   fulfilled: false,
 *   player: null
 * }]
 * @returns {Contract|undefined} - contract object if successful, or undefined if not
 */
export function newContract(destinationKey, commodity, options = {
  type: "market",
  fulfilled: false,
  player: null,
}) {
  if ((typeof destinationKey !== "string") || !cities.get(destinationKey)) {
    console.error(`newContract: "${destinationKey}" is not a city`);
    return undefined;
  }
  if ((typeof commodity !== "string") || !commodities.get(commodity)) {
    console.error(`newContract: "${commodity}" is not a commodity`);
    return undefined;
  }
  if (!(["market", "private"].includes(options.type))) {
    console.error(`newContract: "${options.type}" is not a valid type`);
    return undefined;
  }

  return {
    destinationKey: destinationKey, 
    commodity: commodity, 
    type: options.type,
    fulfilled: options.fulfilled,
    player: null,
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
  // $3,000 per segment of the diwtance between the destination city and the closest city that provides the commodity
  return shortestDistance(contract.destinationKey, c => cities.get(c)?.commodities.includes(contract.commodity)) * 3000;
}


/**
 * Railroad tie value of this contract if fulfilled
 *
 * @param {Contract}
 * @type {number}
 */
export function railroadTieValue(contract) {

  // 1 railroad tie if the commodity is available in the same region as the destintation, 2 ties if the closest supplying city
  // is in an adjacent region, and 3 ties if it needs to move from Eastern to Western or vice versa
  const destinationRegion = cities.get(contract.destinationKey).region;
  const commodityRegions = commodities.get(contract.commodity);

  if (commodityRegions.includes(destinationRegion)) {
    return 1;
  } else if (destinationRegion === "Central" || commodityRegions.includes("Central")) {
    return 2;
  }

  // Not the same region and neither is Central, so it must be a Western-Eastern delivery (in either direction)
  return 3;
}
