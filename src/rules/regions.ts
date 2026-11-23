/** Map regions (docs/Game rules.md, Fulfilling a contract). */
import { cities } from '../data';

/** The region code of a city ("NE", "SC", …), or undefined for an unknown city. */
export function cityRegion(city: string): string | undefined {
  return cities.get(city)?.region;
}
