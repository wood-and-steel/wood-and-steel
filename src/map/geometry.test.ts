import { routes } from '../data/routes';
import { CITY_POINTS, REGIONAL_OFFICE_POINTS } from '../data/cityPoints';
import { EDITED_ROUTES, FLAGGED_ROUTES, ROUTE_PATHS } from './routePaths';
import { formatPathD, parsePathD } from './pathData';

const routeEntries = [...routes.entries()];

describe('map geometry', () => {
  it('has a city point for every city on a route', () => {
    const cities = routeEntries.flatMap(([, route]) => route.cities);
    expect(cities.filter((city) => !CITY_POINTS[city])).toEqual([]);
  });

  it('has the six Regional Office discs', () => {
    expect(Object.keys(REGIONAL_OFFICE_POINTS).sort()).toEqual(['NC', 'NE', 'NW', 'SC', 'SE', 'SW']);
  });

  it('has a path for every route', () => {
    expect(routeEntries.filter(([key]) => !ROUTE_PATHS[key]).map(([key]) => key)).toEqual([]);
  });

  it('runs each path from its first city to its second', () => {
    const misplaced = routeEntries
      .filter(([key, route]) => {
        const path = parsePathD(ROUTE_PATHS[key]);
        const [from, to] = route.cities.map((c) => CITY_POINTS[c]);
        const end = path.segments[path.segments.length - 1].end;
        return (
          Math.hypot(path.start.x - from.x, path.start.y - from.y) > from.r ||
          Math.hypot(end.x - to.x, end.y - to.y) > to.r
        );
      })
      .map(([key]) => key);
    expect(misplaced).toEqual([]);
  });

  it('only lists known routes as flagged or edited', () => {
    const keys = [...Object.keys(FLAGGED_ROUTES), ...EDITED_ROUTES];
    expect(keys.filter((key) => !routes.has(key))).toEqual([]);
  });

  it('round-trips path strings', () => {
    for (const d of Object.values(ROUTE_PATHS)) {
      expect(formatPathD(parsePathD(d))).toBe(d);
    }
  });
});
