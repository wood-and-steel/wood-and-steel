/**
 * The board SVG, drawn in full-PNG pixel space (docs/BOARD_APP_PLAN.md, Rendering).
 * Layers bottom to top: art, indie routes, hubs, Regional Office discs, route hit areas.
 * Player track (M3) and engine/Railyard tokens (M4) slot in between as later milestones land.
 */
import React from 'react';
import boardImageUrl from './assets/map-board.webp';
import { routes } from '../data/routes';
import type { GameState, RegionCode } from '../stores/gameStore';
import { BOARD_HEIGHT, BOARD_WIDTH, CITY_POINTS, REGIONAL_OFFICE_POINTS } from './geometry/cityPoints';
import { ROUTE_PATHS } from './geometry/routePaths';
import type { BoardPlayer } from './boardPlayers';
import type { ZoomPan } from './useZoomPan';

/** Hub ring: gap outside the printed city circle, and spacing if several hubs share a city. */
const HUB_RING_GAP = 20;
const HUB_RING_SPACING = 26;

interface BoardMapProps {
  G: GameState;
  players: BoardPlayer[];
  zoomPan: ZoomPan;
}

/** routeKey -> independent railroad name */
export function getIndieRouteOwners(G: GameState): Map<string, string> {
  const owners = new Map<string, string>();
  for (const railroad of Object.values(G.independentRailroads ?? {})) {
    for (const route of railroad.routes) owners.set(route.key, railroad.name);
  }
  return owners;
}

function routeTooltip(key: string, indieOwner: string | undefined): string {
  const route = routes.get(key);
  const parts = [key];
  if (route) {
    parts.push(`length ${route.length}`);
    if (route.mountainous) parts.push('mountainous');
  }
  if (indieOwner) parts.push(indieOwner);
  return parts.join(' · ');
}

/** Lay out n discs side by side inside a Regional Office space of radius r. */
function regionalOfficeDiscs(n: number, r: number): { dx: number; r: number }[] {
  const discR = n === 1 ? r * 0.55 : r * 0.38;
  const step = discR * 1.6;
  return Array.from({ length: n }, (_, i) => ({ dx: (i - (n - 1) / 2) * step, r: discR }));
}

export function BoardMap({ G, players, zoomPan }: BoardMapProps): React.ReactElement {
  const indieOwners = React.useMemo(() => getIndieRouteOwners(G), [G]);

  const hubsByCity = new Map<string, BoardPlayer[]>();
  const officesByRegion = new Map<RegionCode, BoardPlayer[]>();
  for (const player of players) {
    if (player.hubCity && CITY_POINTS[player.hubCity]) {
      hubsByCity.set(player.hubCity, [...(hubsByCity.get(player.hubCity) ?? []), player]);
    }
    if (player.regionalOffice && REGIONAL_OFFICE_POINTS[player.regionalOffice]) {
      officesByRegion.set(player.regionalOffice, [...(officesByRegion.get(player.regionalOffice) ?? []), player]);
    }
  }

  return (
    <svg
      className={`boardMap${zoomPan.isPanning ? ' boardMap--panning' : ''}`}
      viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
      width={zoomPan.width}
      height={zoomPan.height}
      role="img"
      aria-label="Game board"
      {...zoomPan.panHandlers}
    >
      <image
        className="boardMap__art"
        href={boardImageUrl}
        width={BOARD_WIDTH}
        height={BOARD_HEIGHT}
        preserveAspectRatio="none"
      />

      <g className="boardMap__indieRoutes">
        {[...indieOwners.keys()].map((key) =>
          ROUTE_PATHS[key] ? <path key={key} className="boardMap__indieRoute" d={ROUTE_PATHS[key]} /> : null
        )}
      </g>

      <g className="boardMap__hubs">
        {[...hubsByCity.entries()].flatMap(([city, owners]) => {
          const p = CITY_POINTS[city];
          return owners.map((player, i) => (
            <circle
              key={`${city}-${player.id}`}
              className="boardMap__hub"
              cx={p.x}
              cy={p.y}
              r={p.r + HUB_RING_GAP + i * HUB_RING_SPACING}
              stroke={player.dark}
            >
              <title>{`${player.name}'s Hub: ${city}`}</title>
            </circle>
          ));
        })}
      </g>

      <g className="boardMap__regionalOffices">
        {[...officesByRegion.entries()].flatMap(([region, owners]) => {
          const p = REGIONAL_OFFICE_POINTS[region];
          const discs = regionalOfficeDiscs(owners.length, p.r);
          return owners.map((player, i) => (
            <circle
              key={`${region}-${player.id}`}
              className="boardMap__regionalOffice"
              cx={p.x + discs[i].dx}
              cy={p.y}
              r={discs[i].r}
              fill={player.dark}
            >
              <title>{`${player.name}'s Regional Office: ${region}`}</title>
            </circle>
          ));
        })}
      </g>

      <g className="boardMap__routeHits">
        {Object.entries(ROUTE_PATHS).map(([key, d]) => (
          <path key={key} className="boardMap__routeHit" d={d} data-route={key}>
            <title>{routeTooltip(key, indieOwners.get(key))}</title>
          </path>
        ))}
      </g>
    </svg>
  );
}
