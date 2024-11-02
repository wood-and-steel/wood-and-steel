import { cities, routes } from "./GameData";
import Contract from "./Contract";
import { cardinalDirection } from "./geo";

/**
 * Returns all cities connected to one or more cities within a number of segments
 * 
 * @param {string[]|Set} fromCitiesKeys           - Keys of cities from which to traverse the map
 * @param {*} [distance = 1]                      - Maximum number of segments to traverse
 * @param {*} [routeTestFn = () => true]          - Function to filter routes (e.g. r => !r.mountainous to filter out mountainous routes)
 * @returns {Set}                                 - City keys with origin cities removed
 */
export function citiesConnectedTo(fromCitiesKeys, distance = 1, routeTestFn = () => true) {
  
  const connectedCities = new Set([...fromCitiesKeys]);
  
  let iteratorCities = new Set([...fromCitiesKeys]);
  while ((distance-- > 0) && (iteratorCities.size < cities.size)) {
    iteratorCities.forEach((iteratorCity) => {
      cities.get(iteratorCity)?.routes.forEach(routeKey => {
        const route = routes.get(routeKey)
        if (routeTestFn(route)) {
          connectedCities.add(route?.cities.find(cityOnRoute => cityOnRoute !== iteratorCity))
        }
      })
    })
    iteratorCities = new Set([...connectedCities]);
  }
  
  fromCitiesKeys.forEach(fromCity => connectedCities.delete(fromCity));
  
  return connectedCities;
}

/**
 * Returns the number of segments from a given city to the closest one that matches a function
 * 
 * @param {string} fromKey                        - Key of city to calculate distance from
 * @param {function} toCityTestFn                 - Function to filter destination city (e.g. c => c === "New York")
 * @param {function} [routeTestFn = () => true]   - Function to filter routes (e.g. r => !r.mountainous to filter out mountainous routes)
 * @returns {number|undefined}                    - Number of segments, or undefined if the route does not exist
 */
export function shortestDistance(fromKey, toCityTestFn, routeTestFn = () => true) 
{ 
  let iteratorCities = new Set([ fromKey ]);
  const connectedCities = new Set([ fromKey ]);
  let distance = 0;

  while (
    ![...iteratorCities].some(toCityTestFn) &&     // have not found a city match the given criteria
    (iteratorCities.size < cities.size) &&         // have not gotten to all the cities
    distance < 30                                  // longest possible distance is 12, but 30 allows for future maps with more cities
  ) {
    iteratorCities.forEach((iteratorCity) => {
      cities.get(iteratorCity)?.routes.forEach(routeKey => {
        const route = routes.get(routeKey)
        if (routeTestFn(route)) {
          connectedCities.add(route?.cities.find(cityOnRoute => cityOnRoute !== iteratorCity))
        }
      })
    })
    iteratorCities = new Set([...connectedCities]);
    distance++;
  }
  
  if ([...iteratorCities].some(toCityTestFn)) {
    return distance;
  } else {
    return undefined;
  }
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
      candidatesByDirection.get(cardinalDirection(activeCity, candidate))?.add(candidate)
    })
  });

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
 * Create a starting private contract for a given pair of starting cities
 *
 * @export
 * @param {string[2]} activeCitiesKeys      - Keys of two starting cities
 * @returns {Contract}
 */
export function generateStartingContract(activeCitiesKeys) {
  
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

  let candidatesInChosenDirection = [];
  
  if (candidatesByDirection.get("north").size === 0) {
    candidatesInChosenDirection.push(...(candidatesByDirection.get( Math.random() < 0.5 ? "east" : "west" )));
  } else if (candidatesByDirection.get("east").size === 0) {
    candidatesInChosenDirection.push(...(candidatesByDirection.get( Math.random() < 0.5 ? "north" : "south" )));
  } else {
    const rand = Math.random();
    let randomDirection = "";
    
    if (rand < 0.2) randomDirection = "north"
    else if (rand < 0.4) randomDirection = "south"
    else if (rand < 0.7) randomDirection = "east"
    else randomDirection = "west";
    candidatesInChosenDirection.push(...(candidatesByDirection.get(randomDirection)));
  }

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

  // Randomly pick a commodity for the contract
  
  const contractCommodity = [...validCommodities][Math.floor(Math.random() * validCommodities.size)];

  // Choose the destination, part 1: list candidates that don't supply the contractCommodity by their value
  
  let sumValues = 0;
  const weightedCandidates = new Map(
    candidatesInChosenDirection
      .filter(candidate => !cities.get(candidate).commodities.includes(contractCommodity))
      .map(candidate => {
        sumValues += valueOfCity(candidate);
        return [candidate, valueOfCity(candidate)];
      })
  );

  console.log(`weightedCandidates:\n${[...weightedCandidates]}`);

  // TODO: Write a test that exercises all paths to make sure this case can't happen
  if (weightedCandidates.size === 0) {
    console.error("generateStartingContract: no candidate cities survived");
    return undefined;
  }

  // Choose the destination, part 2: randomly pick the destination, weighted by their values
  
  let contractCity = "";
  const finalCityDieRoll = Math.floor(Math.random() * sumValues);
  let skipped = 0;
  weightedCandidates.forEach((cityValue, candidate) => {
    if (finalCityDieRoll < cityValue + skipped && contractCity === "")
      contractCity = candidate
    else
      skipped += cityValue;
  });

  const startingContract = new Contract(contractCity, contractCommodity, "private");

  return startingContract;
}

/**
 * Returns the value of a city
 * 
 * @param {string} cityKey 
 * @returns {number}
 */
function valueOfCity(cityKey) {
  // TODO: Adjust city value based on completed contracts
  const city = cities.get(cityKey);

  if (city === undefined) {
    console.error(`valueOfCity("${cityKey}"): could not find cityKey)`);
    return 0;
  }

  return 2 * (1 + (city.commodities.length > 0) + city.large + (3 * city.westCoast));
}
