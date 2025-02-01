import { cities, routes } from "./GameData";

/**
 * Returns all cities connected to one or more cities within a number of segments
 * 
 * @param {string[]|Set} fromCitiesKeys - Keys of cities from which to traverse the map
 * @param {Object} options
*  @param {number} [options.distance=1] - Maximum number of segments to traverse [1]
*  @param {function} [options.routeTestFn] - Function to filter routes (e.g. r => !r.mountainous to filter out mountainous routes)
*  @param {boolean} [options.includeFromCities=false] - Whether to include fromCitiesKeys in return value [false]
 * @returns {Set} Set of matching city keys
 */
export function citiesConnectedTo(fromCitiesKeys, options = {}) {
  const {
    distance = 1,
    routeTestFn = () => true,
    includeFromCities = false,
  } = options;

  if (!fromCitiesKeys) return new Set();
  
  const connectedCities = new Set([...fromCitiesKeys]);
  
  let iteratorCities = new Set([...fromCitiesKeys]);
  let distanceCountdown = distance;
  while ((distanceCountdown-- > 0) && (iteratorCities.size < cities.size)) {
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
  
  if (!includeFromCities) fromCitiesKeys.forEach(fromCity => connectedCities.delete(fromCity));
  
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
