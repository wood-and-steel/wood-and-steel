import { cities, routes } from "./GameData";

/**
 * Returns all cities connected to one or more cities within a number of segments
 * 
 * @export
 * @param {string[]|Set} fromCitiesKeys - Keys of cities from which to traverse the map
 * @param {Object} options
 * @param {number} [options.distance=1] - Maximum number of segments to traverse
 * @param {function} [options.routeTestFn] - Function to filter routes, receives route object (e.g. r => !r.mountainous)
 * @param {boolean} [options.includeFromCities=false] - Whether to include fromCitiesKeys in return value
 * @returns {Set} Set of matching city keys
 */
export function citiesConnectedTo(fromCitiesKeys, options = {}) {
  const {
    distance = 1,
    routeTestFn = () => true,
    includeFromCities = false,
  } = options;

  if (!fromCitiesKeys || (Array.isArray(fromCitiesKeys) && fromCitiesKeys.length === 0) || (fromCitiesKeys instanceof Set && fromCitiesKeys.size === 0)) {
    return new Set();
  }
  
  // Track all visited cities across all iterations
  const visited = new Set([...fromCitiesKeys]);
  
  // Track cities discovered in the current BFS level
  let currentLevel = new Set([...fromCitiesKeys]);
  
  // Perform breadth-first search for the specified distance
  for (let i = 0; i < distance; i++) {
    const nextLevel = new Set();
    
    // For each city in the current level, find its neighbors
    for (const currentCity of currentLevel) {
      const city = cities.get(currentCity);
      if (!city) continue;
      
      // Check each route from this city
      for (const routeKey of city.routes) {
        const route = routes.get(routeKey);
        if (!route || !routeTestFn(route)) continue;
        
        // Find the neighbor city on this route (the city that isn't the current one)
        const neighborCity = route.cities.find(cityOnRoute => cityOnRoute !== currentCity);
        
        // Add to next level if it's a valid city and we haven't visited it yet
        if (neighborCity && !visited.has(neighborCity)) {
          visited.add(neighborCity);
          nextLevel.add(neighborCity);
        }
      }
    }
    
    // Move to next level
    currentLevel = nextLevel;
    
    // Early exit if no new cities were found
    if (currentLevel.size === 0) break;
  }
  
  // Remove starting cities if requested
  if (!includeFromCities) {
    for (const fromCity of fromCitiesKeys) {
      visited.delete(fromCity);
    }
  }
  
  return visited;
}

// Maximum search distance to prevent infinite loops on disconnected graphs
const MAX_MAP_DISTANCE = 30;

/**
 * Returns the number of segments from a given city to the closest one that matches a function
 * 
 * @export
 * @param {string} fromKey - Key of city to calculate distance from
 * @param {function} toCityTestFn - Function to test destination city, receives city key string (e.g. c => c === "New York")
 * @param {function} [routeTestFn] - Function to filter routes, receives route object (e.g. r => !r.mountainous)
 * @returns {number|undefined} - Number of segments, or undefined if no matching city is reachable
 */
export function shortestDistance(fromKey, toCityTestFn, routeTestFn = () => true) 
{ 
  if (!fromKey || !cities.has(fromKey)) {
    return undefined;
  }

  // Check if the starting city itself matches
  if (toCityTestFn(fromKey)) {
    return 0;
  }

  // Track all visited cities
  const visited = new Set([fromKey]);
  
  // Track cities at the current BFS level
  let currentLevel = new Set([fromKey]);
  let distance = 0;

  // Perform breadth-first search
  while (currentLevel.size > 0 && distance < MAX_MAP_DISTANCE) {
    distance++;
    const nextLevel = new Set();
    
    // Check each city in the current level
    for (const currentCity of currentLevel) {
      const city = cities.get(currentCity);
      if (!city) continue;
      
      // Explore each route from this city
      for (const routeKey of city.routes) {
        const route = routes.get(routeKey);
        if (!route || !routeTestFn(route)) continue;
        
        // Find the neighbor city on this route
        const neighborCity = route.cities.find(cityOnRoute => cityOnRoute !== currentCity);
        
        // Skip if invalid or already visited
        if (!neighborCity || visited.has(neighborCity)) continue;
        
        // Check if this neighbor matches our search criteria
        if (toCityTestFn(neighborCity)) {
          return distance;
        }
        
        // Add to next level for continued search
        visited.add(neighborCity);
        nextLevel.add(neighborCity);
      }
    }
    
    // Move to next level
    currentLevel = nextLevel;
  }
  
  // No matching city found
  return undefined;
}
