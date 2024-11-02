import { cities } from "./GameData";

/**
 * Given two cities, returns the compass heading in degrees from one to the other
 *
 * @export
 * @param {*} fromKey
 * @param {*} toKey
 * @returns {number}
 */
export function heading(fromKey, toKey) {

  const fromCity = cities.get(fromKey);
  const toCity = cities.get(toKey);

  if (fromCity === undefined || toCity === undefined) {
    console.error(`heading("${fromKey}", "${toKey}"): could not find both keys`);
    return;
  }

  // deg to rad
  const fromLat = fromCity.latitude * Math.PI / 180.0;
  const fromLong = fromCity.longitude * Math.PI / 180.0;
  const toLat = toCity.latitude * Math.PI / 180.0;
  const toLong = toCity.longitude * Math.PI / 180.0;
  
  const x = Math.cos(toLat) * Math.sin(toLong - fromLong);
  const y = Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(toLong - fromLong);

  let β = Math.atan2(x, y) * 180.0 / Math.PI; // rad to deg
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
    console.error(`candinalDirection("${fromKey}", "${toKey}"): could not get heading`);
    return undefined;
  }

  if (h > 315.0 || h <= 45.0)
    return "north"
  else if (h > 45.0 && h <= 135.0)
    return "east"
  else if (h > 135.0 && h <= 225.0)
    return "south"
  else
    return "west";
}