import { cities, routes } from "./GameData";
import { cardinalDirection } from "./geo";

// Return cities connected to fromCitiesKeys

export function citiesConnectedTo(
  fromCitiesKeys,                 // String[] or Set of city keys
  depth = 1,                      // number of hops to traverse
  routeTestFn = () => true        // function to filter routes (e.g. r => !r.mountainous to filter out mountainous routes)
) {
  
  const connectedCities = new Set([...fromCitiesKeys]);
  
  let iteratorCities = new Set([...fromCitiesKeys]);
  while ((depth-- > 0) && (iteratorCities.size < cities.size)) {
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

// Group candidates into cardinal direction buckets
// Candidates can appear in more than one bucket if there's more than one origin (from) city

function citiesByDirection(
  fromCitiesKeys,
  candidateCitiesKeys
) {
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

// TODO: Make and return a real Contract object instead of a string

export function generateStartingContract(activeCitiesKeys) {
  
  if (!Array.isArray(activeCitiesKeys) || activeCitiesKeys.length !== 2) {
    console.error(`generateStartingContract(${activeCitiesKeys}): not an Array(2)`);
    return;
  }

  // Throughout this function, "candidate" is always a city key, for a city being considered as a destination for the contract

  // Get all cities within 2 hops of active (starting) cities without crossing mountains
  const candidates = citiesConnectedTo(activeCitiesKeys, 2, (r => !r.mountainous));
  console.log(`candidates:\n${[...candidates]}`);

  const candidatesByDirection = citiesByDirection(activeCitiesKeys, candidates);
  console.log("candidatesByDirection:");
  console.log(candidatesByDirection);
  
  // If only two of the directions have cities, choose between those two directions 50/50
  // If all four directions have cities, choose one of them by these odds: N 20%, S 20%, E 30%, or W 30%

  let candidatesInChosenDirection = [];
  
  if (candidatesByDirection.get("north").size === 0)
    candidatesInChosenDirection.push(...(candidatesByDirection.get( Math.random() < 0.5 ? "east" : "west" )));
  else if (candidatesByDirection.get("east").size === 0)
    candidatesInChosenDirection.push(...(candidatesByDirection.get( Math.random() < 0.5 ? "north" : "south" )));
  else {
    const rand = Math.random();
    let randomDirection = "";
    
    if (rand < 0.2) randomDirection = "north"
    else if (rand < 0.4) randomDirection = "south"
    else if (rand < 0.7) randomDirection = "east"
    else randomDirection = "west";
    candidatesInChosenDirection.push(...(candidatesByDirection.get(randomDirection)));
  }

  console.log(`candidatesInChosenDirection:\n${candidatesInChosenDirection}`);
  
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
  console.log(`commoditiesInEveryCandidate:\n${[...commoditiesInEveryCandidate]}`);
  
  // List all commodities available in active cities and remove the ones available in every potential destination
  
  const activeCitiesKeysCommodities = new Set();
  activeCitiesKeys.forEach(city => cities.get(city).commodities.forEach(commodity => activeCitiesKeysCommodities.add(commodity)));
  const validCommodities = activeCitiesKeysCommodities.difference(commoditiesInEveryCandidate);
  console.log(`validCommodities:\n${[...validCommodities]}`);

  // Randomly pick a commodity for the contract
  
  const contractCommodity = [...validCommodities][Math.floor(Math.random() * validCommodities.size)];
  console.log(`contractCommodity: ${contractCommodity}`);

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
  if (weightedCandidates.size === 0) return "Error: no candidate cities survived";

  // Choose the destination, part 2: randomly pick the destination, weighted by their values
  
  let contractCity = "";
  const finalCityDieRoll = Math.floor(Math.random() * sumValues);
  console.log(`finalCityDieRoll: ${finalCityDieRoll}`);
  let skipped = 0;
  weightedCandidates.forEach((cityValue, candidate) => {
    if (finalCityDieRoll < cityValue + skipped && contractCity === "")
      contractCity = candidate
    else
      skipped += cityValue;
  });
  console.log(`contractCity: ${contractCity}`);

  return `Deliver ${contractCommodity} to ${contractCity}`;
}

function valueOfCity(cityKey) {
  // TODO: Adjust city value based on completed contracts
  const city = cities.get(cityKey);

  if (city === undefined) {
    console.error(`valueOfCity("${cityKey}"): could not find cityKey)`);
    return 0;
  }

  return 2 * (1 + (city.commodities.length > 0) + city.large + (3 * city.westCoast));
}
