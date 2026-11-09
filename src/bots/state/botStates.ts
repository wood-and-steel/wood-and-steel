/**
 * Bot-private state, one `bot_states` row per game (docs/BOT_PLAN.md, Bot state). It holds
 * what a human keeps on paper or in their head: cash, debt, plans, and the narration log.
 * It never holds G/ctx data; physical-table state (track, engines, upgrades) is in board_states.
 */
import { commodities } from '../../data';
import type { PlayerSeat } from '../../utils/gameManager';
import { isStrategyId, type StrategyId } from '../heuristic/strategies';
import { WEIGHT_KEYS, defaultWeights, drawWeights, type Weights } from '../heuristic/weights';
import { createRng, randomSeed } from '../rng';
import type { Effect } from '../engine/actions';

export const BOT_STATES_VERSION = 1;
/** Every player starts with $10,000 (rules, Set Up). Money is in dollars, like moneyValue(). */
export const STARTING_CASH = 10_000;
/** Turns of narration kept per bot; the board shows only the last. */
export const MAX_LOG_TURNS = 20;

export interface BotTurnLog {
  round: number;
  turn: number;
  lines: string[];
}

/**
 * The bot's turn so far, so a reload can resume without repeating a move. A turn is identified
 * by ctx.turn and ctx.playOrderPos. `pending` holds the effects of the action being carried out;
 * it is saved before they run and cleared after, so a resume re-runs only those not yet done.
 */
export interface TurnInProgress {
  turn: number;
  playOrderPos: number;
  steps: string[];
  pending: { step: string; effects: Effect[] } | null;
}

/** The heuristic's multi-turn intent; its shape is defined with the heuristic player (M5). */
export type BotPlan = Record<string, unknown>;

export interface BotRecord {
  name: string;
  strategy: StrategyId;
  weights: Weights;
  /** Seeded generator state; advanced and saved after each use. */
  rngState: number;
  cash: number;
  debt: number;
  /** One-time debt service on the first Central-region delivery has been paid. */
  centralDebtServicePaid: boolean;
  /** A Western-region delivery has been made; debt service is due on every delivery from then on. */
  westernDeliveryMade: boolean;
  /** Deliveries per commodity, for breadth and depth bonuses. */
  deliveries: Record<string, number>;
  /** The Commodities Exchange commodity; the board records only bought or not. */
  exchangeCommodity: string | null;
  plan: BotPlan | null;
  turnInProgress: TurnInProgress | null;
  /** Oldest first; at most MAX_LOG_TURNS. */
  log: BotTurnLog[];
  /** Heartbeat from the host's runner (ISO time), for the board's "waiting for the host" status. */
  runnerSeenAt: string | null;
}

export interface BotStates {
  version: typeof BOT_STATES_VERSION;
  /** playerID -> record */
  bots: Record<string, BotRecord>;
}

export function emptyBotStates(): BotStates {
  return { version: BOT_STATES_VERSION, bots: {} };
}

/** A new bot's record: weights drawn from its strategy, starting cash, empty log. */
export function createBotRecord(info: { name: string; strategy: StrategyId }, seed: number): BotRecord {
  const rng = createRng(seed);
  const weights = drawWeights(info.strategy, rng);
  return {
    name: info.name,
    strategy: info.strategy,
    weights,
    rngState: rng.state(),
    cash: STARTING_CASH,
    debt: 0,
    centralDebtServicePaid: false,
    westernDeliveryMade: false,
    deliveries: {},
    exchangeCommodity: null,
    plan: null,
    turnInProgress: null,
    log: [],
    runnerSeenAt: null,
  };
}

/** Bot seats that have a playerID (the game has started), keyed by playerID. */
export function botSeatsByPlayerID(
  seats: Record<string, PlayerSeat>
): Record<string, { name: string; strategy: StrategyId }> {
  const bots: Record<string, { name: string; strategy: StrategyId }> = {};
  for (const seat of Object.values(seats)) {
    if (seat.bot && seat.playerID !== undefined && isStrategyId(seat.bot.strategy)) {
      bots[seat.playerID] = { name: seat.bot.name, strategy: seat.bot.strategy };
    }
  }
  return bots;
}

/** Add a record for every started bot seat that doesn't have one. Re-appliable. */
export function addMissingBots(
  states: BotStates,
  seats: Record<string, PlayerSeat>,
  seed: () => number = randomSeed
): BotStates {
  const missing = Object.entries(botSeatsByPlayerID(seats)).filter(([id]) => !states.bots[id]);
  if (missing.length === 0) return states;
  const bots = { ...states.bots };
  for (const [id, info] of missing) bots[id] = createBotRecord(info, seed());
  return { ...states, bots };
}

// ---------------------------------------------------------------------------
// Normalization: coerce a stored row into BotStates, dropping malformed entries.

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === 'string');

function normalizeWeights(raw: unknown, strategy: StrategyId): Weights {
  const weights = defaultWeights(strategy);
  if (!isRecord(raw)) return weights;
  for (const key of WEIGHT_KEYS) {
    const value = raw[key];
    if (isFiniteNumber(value) && value >= 0 && value <= 1) weights[key] = value;
  }
  return weights;
}

function normalizeDeliveries(raw: unknown): Record<string, number> {
  const deliveries: Record<string, number> = {};
  if (!isRecord(raw)) return deliveries;
  for (const [commodity, count] of Object.entries(raw)) {
    if (commodities.has(commodity) && isFiniteNumber(count) && count > 0) {
      deliveries[commodity] = Math.floor(count);
    }
  }
  return deliveries;
}

function normalizePending(raw: unknown): TurnInProgress['pending'] {
  if (!isRecord(raw) || typeof raw.step !== 'string' || !Array.isArray(raw.effects)) return null;
  // Effects are written only by the runner; keep the well-formed ones.
  const effects = raw.effects.filter((e): e is Effect => isRecord(e) && typeof e.kind === 'string');
  return { step: raw.step, effects: structuredClone(effects) };
}

function normalizeTurnInProgress(raw: unknown): TurnInProgress | null {
  if (!isRecord(raw) || !isFiniteNumber(raw.turn) || !isStringArray(raw.steps)) return null;
  return {
    turn: raw.turn,
    playOrderPos: isFiniteNumber(raw.playOrderPos) ? raw.playOrderPos : -1,
    steps: [...raw.steps],
    pending: normalizePending(raw.pending),
  };
}

function normalizeLog(raw: unknown): BotTurnLog[] {
  if (!Array.isArray(raw)) return [];
  const log = raw
    .filter(
      (entry): entry is BotTurnLog =>
        isRecord(entry) && isFiniteNumber(entry.round) && isFiniteNumber(entry.turn) && isStringArray(entry.lines)
    )
    .map((entry) => ({ round: entry.round, turn: entry.turn, lines: [...entry.lines] }));
  return log.slice(-MAX_LOG_TURNS);
}

function normalizeBotRecord(raw: unknown): BotRecord | null {
  if (!isRecord(raw) || typeof raw.name !== 'string' || raw.name.trim() === '' || !isStrategyId(raw.strategy)) {
    return null;
  }
  const strategy = raw.strategy;
  return {
    name: raw.name,
    strategy,
    weights: normalizeWeights(raw.weights, strategy),
    rngState: isFiniteNumber(raw.rngState) ? raw.rngState >>> 0 : 1,
    cash: isFiniteNumber(raw.cash) ? raw.cash : STARTING_CASH,
    debt: isFiniteNumber(raw.debt) && raw.debt >= 0 ? raw.debt : 0,
    centralDebtServicePaid: raw.centralDebtServicePaid === true,
    westernDeliveryMade: raw.westernDeliveryMade === true,
    deliveries: normalizeDeliveries(raw.deliveries),
    exchangeCommodity:
      typeof raw.exchangeCommodity === 'string' && commodities.has(raw.exchangeCommodity) ? raw.exchangeCommodity : null,
    plan: isRecord(raw.plan) ? structuredClone(raw.plan) : null,
    turnInProgress: normalizeTurnInProgress(raw.turnInProgress),
    log: normalizeLog(raw.log),
    runnerSeenAt: typeof raw.runnerSeenAt === 'string' ? raw.runnerSeenAt : null,
  };
}

/**
 * Coerce a stored row into BotStates, dropping malformed bots and fields.
 * Throws if the row was written by a newer version.
 */
export function normalizeBotStates(raw: unknown): BotStates {
  if (!isRecord(raw)) return emptyBotStates();
  if (isFiniteNumber(raw.version) && raw.version > BOT_STATES_VERSION) {
    throw new Error(`Bot state version ${raw.version} is newer than this app (${BOT_STATES_VERSION}). Reload the page.`);
  }
  const states = emptyBotStates();
  if (isRecord(raw.bots)) {
    for (const [playerID, record] of Object.entries(raw.bots)) {
      const normalized = normalizeBotRecord(record);
      if (normalized) states.bots[playerID] = normalized;
    }
  }
  return states;
}
