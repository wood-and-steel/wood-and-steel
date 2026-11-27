/**
 * State serialization utilities for game state persistence.
 * Serialize and deserialize game state (G) and context (ctx) for localStorage, server sync, etc.
 */

import type { LedgerEntry, ReportedContract, RoundReport, TurnLedger } from '../stores/gameStore';
import { normalizePlayers } from '../stores/playerDefaults';

/** Serialized state shape: G and ctx as stored (validated by isValidSerializedState). */
export interface SerializedState {
  G: {
    contracts: unknown[];
    players: unknown[];
    independentRailroads: Record<string, unknown>;
    marketRoundsWithoutExpirationStart?: number;
    turnLedger?: unknown;
    roundReport?: unknown;
  };
  ctx: Record<string, unknown>;
}

/**
 * Serialize game state (G) and context (ctx) to a JSON-serializable format.
 * Deep clone; result can be safely passed to JSON.stringify().
 */
export function serializeState(
  G: Record<string, unknown>,
  ctx: Record<string, unknown>
): SerializedState {
  if (!G || typeof G !== 'object') {
    throw new Error('serializeState: G must be a valid object');
  }
  if (!ctx || typeof ctx !== 'object') {
    throw new Error('serializeState: ctx must be a valid object');
  }

  const serializedG: SerializedState['G'] = {
    contracts: deepClone(G.contracts || []) as unknown[],
    players: deepClone(G.players || []) as unknown[],
    independentRailroads: deepClone(G.independentRailroads || {}) as Record<string, unknown>,
    ...(typeof G.marketRoundsWithoutExpirationStart === 'number' && {
      marketRoundsWithoutExpirationStart: G.marketRoundsWithoutExpirationStart,
    }),
    ...(isRecord(G.turnLedger) && { turnLedger: deepClone(G.turnLedger) }),
    ...(isRecord(G.roundReport) && { roundReport: deepClone(G.roundReport) }),
  };

  const serializedCtx: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(ctx)) {
    if (key.startsWith('_')) continue;
    serializedCtx[key] = deepClone(value);
  }

  return {
    G: serializedG,
    ctx: serializedCtx,
  };
}

/**
 * Deserialize game state from a serialized data object.
 * Deep clone so returned state is independent of input.
 */
export function deserializeState(data: unknown): SerializedState {
  if (!data || typeof data !== 'object') {
    throw new Error('deserializeState: data must be a valid object');
  }

  const obj = data as Record<string, unknown>;
  const G = obj.G;
  const ctx = obj.ctx;

  if (!G || typeof G !== 'object') {
    throw new Error('deserializeState: data.G must be a valid object');
  }
  if (!ctx || typeof ctx !== 'object') {
    throw new Error('deserializeState: data.ctx must be a valid object');
  }

  const gObj = G as Record<string, unknown>;
  const rawRailroads = deepClone(gObj.independentRailroads || {}) as Record<
    string,
    { name?: string; routes?: unknown[] }
  >;
  const independentRailroads: Record<string, unknown> = {};
  for (const [key, railroad] of Object.entries(rawRailroads)) {
    if (!railroad || typeof railroad !== 'object') continue;
    const routes = Array.isArray(railroad.routes) ? railroad.routes : [];
    independentRailroads[key] = {
      name: railroad.name ?? key,
      routes: routes.map((r) =>
        typeof r === 'object' && r !== null && 'key' in r && 'addedInRound' in r
          ? { key: (r as { key: string }).key, addedInRound: (r as { addedInRound: number }).addedInRound }
          : { key: String(r), addedInRound: 0 }
      ),
    };
  }
  const marketRoundsWithoutExpirationStart =
    typeof gObj.marketRoundsWithoutExpirationStart === 'number'
      ? gObj.marketRoundsWithoutExpirationStart
      : undefined;

  const turnLedger = normalizeTurnLedger(gObj.turnLedger);
  const roundReport = normalizeRoundReport(gObj.roundReport);

  return {
    G: {
      contracts: deepClone(gObj.contracts || []) as unknown[],
      // Fills in money, engines and upgrades for players saved before the app tracked them.
      players: normalizePlayers(deepClone(gObj.players || [])),
      independentRailroads,
      ...(marketRoundsWithoutExpirationStart !== undefined && { marketRoundsWithoutExpirationStart }),
      ...(turnLedger && { turnLedger }),
      ...(roundReport && { roundReport }),
      ...(typeof gObj.goFirstNextRound === 'string' && { goFirstNextRound: gObj.goFirstNextRound }),
    },
    ctx: deepClone(ctx) as Record<string, unknown>,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A saved turn ledger, or undefined if it's missing or malformed. Bad entries are dropped. */
function normalizeTurnLedger(raw: unknown): TurnLedger | undefined {
  if (!isRecord(raw) || typeof raw.playerID !== 'string' || !Array.isArray(raw.entries)) return undefined;
  const entries = raw.entries.filter(
    (e): e is LedgerEntry =>
      isRecord(e) && typeof e.label === 'string' && typeof e.amount === 'number' && Number.isFinite(e.amount)
  );
  return { playerID: raw.playerID, entries: entries.map((e) => ({ label: e.label, amount: e.amount })) };
}

function reportedContracts(raw: unknown): ReportedContract[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (c): c is ReportedContract =>
        isRecord(c) && typeof c.id === 'string' && typeof c.commodity === 'string' && typeof c.destinationKey === 'string'
    )
    .map((c) => ({ id: c.id, commodity: c.commodity, destinationKey: c.destinationKey }));
}

/** A saved round report, or undefined if it's missing or malformed. */
function normalizeRoundReport(raw: unknown): RoundReport | undefined {
  if (!isRecord(raw) || typeof raw.round !== 'number') return undefined;
  const routesAdded: Record<string, string[]> = {};
  if (isRecord(raw.routesAdded)) {
    for (const [name, keys] of Object.entries(raw.routesAdded)) {
      if (Array.isArray(keys)) routesAdded[name] = keys.filter((k): k is string => typeof k === 'string');
    }
  }
  return {
    round: raw.round,
    routesAdded,
    marketExpired: reportedContracts(raw.marketExpired),
    marketAdded: reportedContracts(raw.marketAdded),
    marketLastRound: reportedContracts(raw.marketLastRound),
    ...(typeof raw.goFirst === 'string' && { goFirst: raw.goFirst }),
  };
}

function deepClone(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item));
  }
  if (value instanceof Date) {
    return new Date(value.getTime());
  }
  const cloned: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    cloned[key] = deepClone(val);
  }
  return cloned;
}

/** Convenience: serializeState + JSON.stringify */
export function serializeStateToJSON(
  G: Record<string, unknown>,
  ctx: Record<string, unknown>
): string {
  const serialized = serializeState(G, ctx);
  return JSON.stringify(serialized);
}

/** Convenience: JSON.parse + deserializeState */
export function deserializeStateFromJSON(jsonString: string): SerializedState {
  if (typeof jsonString !== 'string') {
    throw new Error('deserializeStateFromJSON: jsonString must be a string');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`deserializeStateFromJSON: Invalid JSON string - ${msg}`);
  }
  return deserializeState(parsed);
}

/** Type guard: data has the expected serialized state structure. */
export function isValidSerializedState(data: unknown): data is SerializedState {
  if (!data || typeof data !== 'object') return false;

  const obj = data as Record<string, unknown>;
  const G = obj.G;
  const ctx = obj.ctx;

  if (!G || typeof G !== 'object') return false;
  const gObj = G as Record<string, unknown>;
  if (!Array.isArray(gObj.contracts)) return false;
  if (!Array.isArray(gObj.players)) return false;
  if (!gObj.independentRailroads || typeof gObj.independentRailroads !== 'object') return false;

  if (!ctx || typeof ctx !== 'object') return false;
  const ctxObj = ctx as Record<string, unknown>;
  if (typeof ctxObj.phase !== 'string') return false;
  if (typeof ctxObj.currentPlayer !== 'string') return false;
  if (typeof ctxObj.numPlayers !== 'number') return false;
  if (!Array.isArray(ctxObj.playOrder)) return false;
  if (typeof ctxObj.playOrderPos !== 'number') return false;
  if (typeof ctxObj.turn !== 'number') return false;

  return true;
}
