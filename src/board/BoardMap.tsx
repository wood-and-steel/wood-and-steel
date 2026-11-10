/**
 * The board SVG, drawn in board pixel space (6660x4173) (docs/archived/BOARD_APP_PLAN.md, Rendering).
 * Layers bottom to top: art, indie routes, player track, hubs, Regional Office discs, route hit
 * areas, then Railyard and engine tokens (above the hit areas so they stay grabbable at cities).
 */
import React from 'react';
import boardImageUrl from './assets/map-board.webp';
import { routes } from '../data/routes';
import type { GameState, RegionCode } from '../stores/gameStore';
import { BOARD_HEIGHT, BOARD_WIDTH, CITY_POINTS, REGIONAL_OFFICE_POINTS } from './geometry/cityPoints';
import { ROUTE_PATHS } from './geometry/routePaths';
import { ownerSlots, trackPathD } from './geometry/trackPaths';
import type { BoardPlayer } from './boardPlayers';
import type { ZoomPan } from './useZoomPan';
import { tokenFill } from './TokenIcon';
import {
  ENGINE_HEIGHT,
  ENGINE_WIDTH,
  RAILYARD_RADIUS,
  sameToken,
  tokenId,
  tokenLabel,
  type PlacedToken,
  type TokenRef,
} from './tokens';

/** Hub ring: gap outside the printed city circle, and spacing if several hubs share a city. */
const HUB_RING_GAP = 20;
const HUB_RING_SPACING = 26;
/** Snap highlight ring: gap outside the city circle while a token is dragged over it. */
const SNAP_RING_GAP = 36;

/** Track stroke color for an owner who is no longer in the game. */
const UNKNOWN_OWNER_COLOR = '#808080';

export interface RouteClick {
  routeKey: string;
  clientX: number;
  clientY: number;
  /** Shift-click or right-click: always open the popover. */
  forcePopover: boolean;
}

interface BoardMapProps {
  G: GameState;
  players: BoardPlayer[];
  /** routeKey -> [primary, ...parallel] owner IDs (board state) */
  track: Record<string, string[]>;
  zoomPan: ZoomPan;
  onRouteClick: (click: RouteClick) => void;
  /** Engines and Railyards on cities */
  tokens: PlacedToken[];
  /** Token being dragged (drawn dimmed in place) */
  dragging: TokenRef | null;
  /** City a dragged token would snap to */
  snapCity: string | null;
  /** Null when tokens can't be moved yet (board state not ready) */
  onTokenPointerDown: ((token: TokenRef, event: React.PointerEvent<Element>) => void) | null;
}

/** routeKey -> independent railroad name */
export function getIndieRouteOwners(G: GameState): Map<string, string> {
  const owners = new Map<string, string>();
  for (const railroad of Object.values(G.independentRailroads ?? {})) {
    for (const route of railroad.routes) owners.set(route.key, railroad.name);
  }
  return owners;
}

function routeTooltip(
  key: string,
  indieOwner: string | undefined,
  owners: string[] | undefined,
  players: BoardPlayer[]
): string {
  const route = routes.get(key);
  const parts = [key];
  if (route) {
    parts.push(`length ${route.length}`);
    if (route.mountainous) parts.push('mountainous');
  }
  if (indieOwner) parts.push(indieOwner);
  for (const id of owners ?? []) parts.push(players.find((p) => p.id === id)?.name ?? `Player ${id}`);
  return parts.join(' · ');
}

/** Lay out n discs side by side inside a Regional Office space of radius r. */
function regionalOfficeDiscs(n: number, r: number): { dx: number; r: number }[] {
  const discR = n === 1 ? r * 0.55 : r * 0.38;
  const step = discR * 1.6;
  return Array.from({ length: n }, (_, i) => ({ dx: (i - (n - 1) / 2) * step, r: discR }));
}

export function BoardMap({
  G,
  players,
  track,
  zoomPan,
  onRouteClick,
  tokens,
  dragging,
  snapCity,
  onTokenPointerDown,
}: BoardMapProps): React.ReactElement {
  const indieOwners = React.useMemo(() => getIndieRouteOwners(G), [G]);

  const colorById = new Map(players.map((p) => [p.id, p.color]));
  const playerById = new Map(players.map((p) => [p.id, p]));

  const handleRouteClick = (event: React.MouseEvent<SVGPathElement>, routeKey: string, contextMenu: boolean) => {
    if (contextMenu) event.preventDefault();
    if (zoomPan.didPan()) return;
    onRouteClick({ routeKey, clientX: event.clientX, clientY: event.clientY, forcePopover: contextMenu || event.shiftKey });
  };

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
        {/* Same trimmed geometry as player track, so indie strokes stop at the city circles too. */}
        {[...indieOwners.keys()].map((key) => {
          const d = trackPathD(key, 0);
          return d ? <path key={key} className="boardMap__indieRoute" d={d} /> : null;
        })}
      </g>

      <g className="boardMap__track">
        {Object.entries(track).map(([key, owners]) => {
          const strokes = ownerSlots(owners.length, indieOwners.has(key))
            .map((slot, i) => ({ owner: owners[i], d: trackPathD(key, slot) }))
            .filter((s): s is { owner: string; d: string } => s.d !== null);
          return (
            <g key={key} data-track={key}>
              {strokes.map(({ owner, d }) => (
                <path key={`casing-${owner}`} className="boardMap__trackCasing" d={d} />
              ))}
              {strokes.map(({ owner, d }) => (
                <path
                  key={owner}
                  className="boardMap__trackStroke"
                  d={d}
                  stroke={colorById.get(owner) ?? UNKNOWN_OWNER_COLOR}
                  data-owner={owner}
                />
              ))}
            </g>
          );
        })}
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
          <path
            key={key}
            className="boardMap__routeHit"
            d={d}
            data-route={key}
            onClick={(event) => handleRouteClick(event, key, false)}
            onContextMenu={(event) => handleRouteClick(event, key, true)}
          >
            <title>{routeTooltip(key, indieOwners.get(key), track[key], players)}</title>
          </path>
        ))}
      </g>

      {/* Tokens sit above the route hit areas so they can be grabbed where routes meet at a city. */}
      {snapCity && CITY_POINTS[snapCity] && (
        <circle
          className="boardMap__snapTarget"
          cx={CITY_POINTS[snapCity].x}
          cy={CITY_POINTS[snapCity].y}
          r={CITY_POINTS[snapCity].r + SNAP_RING_GAP}
        />
      )}
      <g className="boardMap__tokens">
        {tokens.map(({ token, city, x, y }) => {
          const player = playerById.get(token.playerID);
          if (!player) return null;
          const fill = tokenFill(token, player);
          const classes = ['boardMap__token'];
          if (onTokenPointerDown) classes.push('boardMap__token--movable');
          if (sameToken(dragging, token)) classes.push('boardMap__token--dragging');
          return (
            <g
              key={tokenId(token)}
              className={classes.join(' ')}
              data-token={tokenId(token)}
              data-city={city}
              onPointerDown={onTokenPointerDown ? (event) => onTokenPointerDown(token, event) : undefined}
            >
              <title>{`${player.name}'s ${tokenLabel(token)}: ${city}`}</title>
              {token.kind === 'engine' ? (
                <rect
                  x={x - ENGINE_WIDTH / 2}
                  y={y - ENGINE_HEIGHT / 2}
                  width={ENGINE_WIDTH}
                  height={ENGINE_HEIGHT}
                  rx={8}
                  fill={fill}
                />
              ) : (
                <circle cx={x} cy={y} r={RAILYARD_RADIUS} fill={fill} />
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
