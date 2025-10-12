import { cities } from "../data";

// Constants for geographic calculations
const DEG_TO_RAD = Math.PI / 180.0;
const RAD_TO_DEG = 180.0 / Math.PI;

// Cardinal direction boundaries in degrees
const NORTH_EAST_BOUNDARY = 45.0;
const EAST_SOUTH_BOUNDARY = 135.0;
const SOUTH_WEST_BOUNDARY = 225.0;
const WEST_NORTH_BOUNDARY = 315.0;

/**
 * Given two cities, returns the compass heading in degrees from one to the other
 *
 * @export
 * @param {string} fromKey
 * @param {string} toKey
 * @returns {number | undefined}
 */
export function heading(fromKey, toKey) {

  const fromCity = cities.get(fromKey);
  const toCity = cities.get(toKey);

  if (fromCity === undefined || toCity === undefined) {
    console.error(`heading("${fromKey}", "${toKey}"): could not find both keys`);
    return undefined;
  }

  // deg to rad
  const fromLat = fromCity.latitude * DEG_TO_RAD;
  const fromLong = fromCity.longitude * DEG_TO_RAD;
  const toLat = toCity.latitude * DEG_TO_RAD;
  const toLong = toCity.longitude * DEG_TO_RAD;
  
  const x = Math.cos(toLat) * Math.sin(toLong - fromLong);
  const y = Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(toLong - fromLong);

  let β = Math.atan2(x, y) * RAD_TO_DEG;
  if (β < 0) β += 360.0;
  
  return β;
}

/**
 * Given two cities, return one of ["north", "south", "east", "west"]
 *
 * @export
 * @param {string} fromKey
 * @param {string} toKey
 * @returns {("north" | "east" | "south" | "west" | undefined)}
 */
export function cardinalDirection(fromKey, toKey) {

  const h = heading(fromKey, toKey);

  if (h === undefined) {
    console.error(`cardinalDirection("${fromKey}", "${toKey}"): could not get heading`);
    return undefined;
  }

  if (h > WEST_NORTH_BOUNDARY || h <= NORTH_EAST_BOUNDARY)
    return "north";
  else if (h > NORTH_EAST_BOUNDARY && h <= EAST_SOUTH_BOUNDARY)
    return "east";
  else if (h > EAST_SOUTH_BOUNDARY && h <= SOUTH_WEST_BOUNDARY)
    return "south";
  else
    return "west";
}