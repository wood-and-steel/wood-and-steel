/**
 * Independent railroads' routes drawn over the map art, shared by the board app's map and the
 * round report's mini maps so both draw them the same way. Board pixels throughout
 * (src/data/cityPoints.ts); the SVG's viewBox does the zooming.
 */
import React from 'react';
import type { GameState } from '../stores/gameStore';
import { trackPathD } from './trackPaths';

/**
 * - `indie`: an independent railroad's route, as on the board.
 * - `new`: a route just added, highlighted over a light casing.
 * - `faint`: another railroad's route, drawn for context.
 */
export type MapRouteKind = 'indie' | 'new' | 'faint';

export interface MapRoute {
  key: string;
  kind: MapRouteKind;
}

/** Stroke widths in board pixels at scale 1. The printed routes are about 23px wide. */
const INDIE_WIDTH = 15;
const NEW_WIDTH = 26;
const NEW_CASING_WIDTH = 42;

/** Bottom to top. New routes' casings all go under every new stroke, so crossings stay clean. */
const LAYERS: { kind: MapRouteKind; className: string; width: number }[] = [
  { kind: 'faint', className: 'mapRoute mapRoute--faint', width: INDIE_WIDTH },
  { kind: 'indie', className: 'mapRoute mapRoute--indie', width: INDIE_WIDTH },
  { kind: 'new', className: 'mapRoute mapRoute--casing', width: NEW_CASING_WIDTH },
  { kind: 'new', className: 'mapRoute mapRoute--new', width: NEW_WIDTH },
];

/** routeKey -> independent railroad name */
export function getIndieRouteOwners(G: GameState): Map<string, string> {
  const owners = new Map<string, string>();
  for (const railroad of Object.values(G.independentRailroads ?? {})) {
    for (const route of railroad.routes) owners.set(route.key, railroad.name);
  }
  return owners;
}

/**
 * Routes trimmed at the city circles, like the board's track. `scale` multiplies the stroke
 * widths, so a map cropped wide can keep its routes as thick on screen as a narrow one.
 */
export function MapRoutes({ routes, scale = 1 }: { routes: MapRoute[]; scale?: number }): React.ReactElement {
  return (
    <g className="mapRoutes">
      {LAYERS.flatMap(({ kind, className, width }) =>
        routes
          .filter((route) => route.kind === kind)
          .map(({ key }) => {
            const d = trackPathD(key, 0);
            return d ? (
              <path key={`${className}|${key}`} className={className} d={d} strokeWidth={width * scale} />
            ) : null;
          })
      )}
    </g>
  );
}
