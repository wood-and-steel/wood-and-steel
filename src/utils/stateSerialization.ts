/**
 * State serialization utilities for game state persistence.
 * Serialize and deserialize game state (G) and context (ctx) for localStorage, server sync, etc.
 */

/** Serialized state shape: G and ctx as stored (validated by isValidSerializedState). */
export interface SerializedState {
  G: {
    contracts: unknown[];
    players: unknown[];
    independentRailroads: Record<string, unknown>;
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
  return {
    G: {
      contracts: deepClone(gObj.contracts || []) as unknown[],
      players: deepClone(gObj.players || []) as unknown[],
      independentRailroads: deepClone(gObj.independentRailroads || {}) as Record<string, unknown>,
    },
    ctx: deepClone(ctx) as Record<string, unknown>,
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
