/**
 * Turning a bot's weights (0–1) into the numbers its decisions use (docs/BOT_PLAN.md, Weights).
 * Every bot does the same arithmetic; the weights only change which trade-offs it accepts.
 */
import { cities } from '../../data';
import { BORROW_STEP, CENTRAL_REGIONS, GAME_END_TIES, WESTERN_REGIONS } from '../engine/rulesData';
import { fulfillmentTies } from '../engine/scoring';
import type { BotWorld } from '../engine/world';
import type { RegionCode } from '../../stores/gameStore';
import type { Weights } from './weights';

export interface Params {
  /** Most debt the bot will carry. */
  maxDebt: number;
  /** Turns ahead the bot values purchases over. */
  horizon: number;
  /** Longest payback (in turns) the bot accepts for a purchase. */
  maxPayback: number;
  /** Dollars one railroad tie is worth to the bot. */
  tieDollars: number;
  /** Share of a plan's track cost charged against that plan (the rest is an asset for later). */
  trackCostShare: number;
  /** Multiplier on what acquiring an independent railroad is worth. */
  indieFactor: number;
  /** 0–1: extra value for racing others to Hubs, Regional Offices, and monopolies. */
  competition: number;
  /** Fraction of the best score within which a choice is random. */
  band: number;
  /** Utility multiplier for a destination's region (reach). */
  regionFactor: (city: string) => number;
  /** The game is nearly over: someone is close to 30 fulfillment ties. */
  endgame: boolean;
}

/** Fulfillment ties at which the bot starts playing for the end of the game. */
export const ENDGAME_TIES = GAME_END_TIES - 6;

export function params(world: BotWorld): Params {
  const w = world.bot.weights;
  const endgame = world.players.some(([id]) => fulfillmentTies(world, id) >= ENDGAME_TIES);
  return paramsFromWeights(w, endgame);
}

export function paramsFromWeights(w: Weights, endgame = false): Params {
  const horizon = Math.round(3 + 12 * w.planningHorizon);
  const reach = w.reach - 0.5;
  return {
    maxDebt: Math.round((10000 + w.debtTolerance * 50000) / BORROW_STEP) * BORROW_STEP,
    horizon: endgame ? Math.min(horizon, 4) : horizon,
    maxPayback: 2 + 10 * w.paybackPatience,
    tieDollars: (2000 + 6000 * w.tiesOverMoney) * (endgame ? 1.5 : 1),
    trackCostShare: 0.8 - 0.5 * w.planningHorizon,
    indieFactor: 0.4 + 1.6 * w.indieAppetite,
    competition: w.competitiveness,
    band: 0.03 + 0.3 * w.variability,
    regionFactor: (city) => {
      const region = cities.get(city)?.region as RegionCode | undefined;
      if (region && WESTERN_REGIONS.includes(region)) return 1 + 0.8 * reach;
      if (region && CENTRAL_REGIONS.includes(region)) return 1 + 0.4 * reach;
      return 1 - 0.2 * reach;
    },
    endgame,
  };
}

/**
 * Pick among scored options: any within `band` of the best, uniformly at random. Higher is better.
 * Deterministic for a given Rng state.
 */
export function chooseWithinBand<T extends { score: number }>(options: T[], band: number, next: () => number): T | null {
  if (options.length === 0) return null;
  const best = Math.max(...options.map((o) => o.score));
  const floor = best - Math.abs(best) * band;
  const near = options.filter((o) => o.score >= floor);
  return near[Math.min(near.length - 1, Math.floor(next() * near.length))];
}
