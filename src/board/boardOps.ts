/**
 * Board-only state and the pure ops that edit it (docs/BOARD_APP_PLAN.md, Board state).
 * Every edit is a serializable BoardOp so it can be re-applied to fresh state after a save
 * conflict. Ops never touch G/ctx and never enforce game rules.
 */

export const BOARD_STATE_VERSION = 1;
/** Owners per route: one primary plus up to three parallel. */
export const MAX_ROUTE_OWNERS = 4;

export type EngineSlot = 0 | 1;

export interface BoardState {
  version: 1;
  seeded: boolean;
  /** routeKey -> owners as playerIDs: [primary, ...parallel], at most MAX_ROUTE_OWNERS */
  track: Record<string, string[]>;
  /** playerID -> [lightEngineCity, darkEngineCity]; null = in tray */
  engines: Record<string, [string | null, string | null]>;
  /** playerID -> city key or null (one Railyard per player) */
  railyards: Record<string, string | null>;
  /** last-seen G.independentRailroads (name -> route keys), for acquisition detection */
  seenIndependentRailroads: Record<string, string[]>;
}

export type BoardOp =
  | { type: 'claimRoute'; routeKey: string; playerID: string }
  | { type: 'setRouteOwners'; routeKey: string; owners: string[] }
  | { type: 'unclaimRoute'; routeKey: string; playerID?: string }
  | { type: 'moveEngine'; playerID: string; slot: EngineSlot; city: string | null }
  | { type: 'moveRailyard'; playerID: string; city: string | null }
  | { type: 'applyAcquisition'; railroad: string; playerID: string | null; routeKeys: string[] }
  | { type: 'snapshotIndependentRailroads'; railroads: Record<string, string[]> }
  | {
      type: 'reconcileIndependentRailroads';
      /** G.independentRailroads now, as name -> route keys */
      railroads: Record<string, string[]>;
      /** Acquirer per railroad that disappeared from G (null: unknown, just forget it) */
      acquirers: Record<string, string | null>;
    };

export function emptyBoardState(): BoardState {
  return {
    version: BOARD_STATE_VERSION,
    seeded: false,
    track: {},
    engines: {},
    railyards: {},
    seenIndependentRailroads: {},
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === 'string');

const cityOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/**
 * Coerce a stored row into a BoardState, dropping malformed entries.
 * Throws if the row was written by a newer board version.
 */
export function normalizeBoardState(raw: unknown): BoardState {
  if (!isRecord(raw)) return emptyBoardState();
  if (typeof raw.version === 'number' && raw.version > BOARD_STATE_VERSION) {
    throw new Error(`Board state version ${raw.version} is newer than this board (${BOARD_STATE_VERSION}). Reload the page.`);
  }
  const state = emptyBoardState();
  state.seeded = raw.seeded === true;
  if (isRecord(raw.track)) {
    for (const [key, owners] of Object.entries(raw.track)) {
      const cleaned = cleanOwners(isStringArray(owners) ? owners : []);
      if (cleaned.length > 0) state.track[key] = cleaned;
    }
  }
  if (isRecord(raw.engines)) {
    for (const [id, pair] of Object.entries(raw.engines)) {
      if (Array.isArray(pair)) state.engines[id] = [cityOrNull(pair[0]), cityOrNull(pair[1])];
    }
  }
  if (isRecord(raw.railyards)) {
    for (const [id, city] of Object.entries(raw.railyards)) state.railyards[id] = cityOrNull(city);
  }
  if (isRecord(raw.seenIndependentRailroads)) {
    for (const [name, keys] of Object.entries(raw.seenIndependentRailroads)) {
      if (isStringArray(keys)) state.seenIndependentRailroads[name] = [...keys];
    }
  }
  return state;
}

/** Dedupe (keeping first occurrence) and cap at MAX_ROUTE_OWNERS. */
function cleanOwners(owners: string[]): string[] {
  return [...new Set(owners)].slice(0, MAX_ROUTE_OWNERS);
}

function withTrack(state: BoardState, routeKey: string, owners: string[]): BoardState {
  const cleaned = cleanOwners(owners);
  const track = { ...state.track };
  if (cleaned.length > 0) track[routeKey] = cleaned;
  else delete track[routeKey];
  return { ...state, track };
}

/** Unclaimed: playerID becomes primary. Claimed by others: playerID is added as a parallel owner (up to the cap). */
export function claimRoute(state: BoardState, routeKey: string, playerID: string): BoardState {
  const owners = state.track[routeKey] ?? [];
  if (owners.includes(playerID) || owners.length >= MAX_ROUTE_OWNERS) return state;
  return withTrack(state, routeKey, [...owners, playerID]);
}

/** Replace a route's owners outright; an empty list unclaims it. */
export function setRouteOwners(state: BoardState, routeKey: string, owners: string[]): BoardState {
  return withTrack(state, routeKey, owners);
}

/** Remove one owner (the next owner becomes primary), or every owner when playerID is omitted. */
export function unclaimRoute(state: BoardState, routeKey: string, playerID?: string): BoardState {
  if (!state.track[routeKey]) return state;
  const owners = playerID === undefined ? [] : state.track[routeKey].filter((id) => id !== playerID);
  return withTrack(state, routeKey, owners);
}

/** Put an engine on a city, or back in its tray with null. */
export function moveEngine(state: BoardState, playerID: string, slot: EngineSlot, city: string | null): BoardState {
  const pair: [string | null, string | null] = [...(state.engines[playerID] ?? [null, null])];
  pair[slot] = city;
  return { ...state, engines: { ...state.engines, [playerID]: pair } };
}

/** Put a player's Railyard on a city, or back in its tray with null. */
export function moveRailyard(state: BoardState, playerID: string, city: string | null): BoardState {
  return { ...state, railyards: { ...state.railyards, [playerID]: city } };
}

/**
 * An independent railroad was acquired: add its routes to the acquirer's track (primary if
 * the route is unclaimed, otherwise parallel) and drop it from the snapshot. With no
 * acquirer (playerID null) only the snapshot changes.
 */
export function applyAcquisition(
  state: BoardState,
  railroad: string,
  playerID: string | null,
  routeKeys: string[]
): BoardState {
  let next = state;
  if (playerID !== null) {
    for (const key of routeKeys) next = claimRoute(next, key, playerID);
  }
  const seen = { ...next.seenIndependentRailroads };
  delete seen[railroad];
  return { ...next, seenIndependentRailroads: seen };
}

/** Replace the last-seen independent railroads (e.g. after end-of-round growth). */
export function snapshotIndependentRailroads(state: BoardState, railroads: Record<string, string[]>): BoardState {
  return { ...state, seenIndependentRailroads: structuredClone(railroads) };
}

/**
 * Catch the snapshot up with G: every snapshotted railroad missing from `railroads` was
 * acquired and is converted to track for its acquirer; then the snapshot is replaced.
 * Idempotent: re-applied to a state where another screen already converted a railroad,
 * that railroad is no longer in the snapshot, so it isn't converted twice.
 */
export function reconcileIndependentRailroads(
  state: BoardState,
  railroads: Record<string, string[]>,
  acquirers: Record<string, string | null>
): BoardState {
  let next = state;
  for (const [name, routeKeys] of Object.entries(state.seenIndependentRailroads)) {
    if (!(name in railroads)) next = applyAcquisition(next, name, acquirers[name] ?? null, routeKeys);
  }
  return snapshotIndependentRailroads(next, railroads);
}

export function applyBoardOp(state: BoardState, op: BoardOp): BoardState {
  switch (op.type) {
    case 'claimRoute':
      return claimRoute(state, op.routeKey, op.playerID);
    case 'setRouteOwners':
      return setRouteOwners(state, op.routeKey, op.owners);
    case 'unclaimRoute':
      return unclaimRoute(state, op.routeKey, op.playerID);
    case 'moveEngine':
      return moveEngine(state, op.playerID, op.slot, op.city);
    case 'moveRailyard':
      return moveRailyard(state, op.playerID, op.city);
    case 'applyAcquisition':
      return applyAcquisition(state, op.railroad, op.playerID, op.routeKeys);
    case 'snapshotIndependentRailroads':
      return snapshotIndependentRailroads(state, op.railroads);
    case 'reconcileIndependentRailroads':
      return reconcileIndependentRailroads(state, op.railroads, op.acquirers);
  }
}
