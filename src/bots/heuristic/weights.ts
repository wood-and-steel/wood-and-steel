/**
 * Strategy weights (docs/BOT_PLAN.md, Weights and Strategies). Each weight is 0–1. A strategy
 * gives a band per weight; a bot's weights are drawn once, within its strategy's bands, when
 * its bot_states record is created. How each weight feeds the heuristic is set in M5.
 */
import type { Rng } from '../rng';
import type { StrategyId } from './strategies';

export const WEIGHT_KEYS = [
  'debtTolerance',
  'planningHorizon',
  'paybackPatience',
  'reach',
  'tiesOverMoney',
  'indieAppetite',
  'competitiveness',
  'variability',
] as const;

export type WeightKey = (typeof WEIGHT_KEYS)[number];
export type Weights = Record<WeightKey, number>;

export type Band = 'low' | 'lowMed' | 'medium' | 'medHigh' | 'high';

export const BANDS: Record<Band, readonly [number, number]> = {
  low: [0, 0.3],
  lowMed: [0.15, 0.5],
  medium: [0.35, 0.65],
  medHigh: [0.5, 0.85],
  high: [0.7, 1],
};

export const STRATEGY_BANDS: Record<StrategyId, Record<WeightKey, Band>> = {
  builder: {
    debtTolerance: 'low',
    planningHorizon: 'high',
    paybackPatience: 'medium',
    reach: 'low',
    tiesOverMoney: 'medium',
    indieAppetite: 'lowMed',
    competitiveness: 'low',
    variability: 'low',
  },
  speculator: {
    debtTolerance: 'high',
    planningHorizon: 'medHigh',
    paybackPatience: 'high',
    reach: 'high',
    tiesOverMoney: 'high',
    indieAppetite: 'low',
    competitiveness: 'medium',
    variability: 'medHigh',
  },
  consolidator: {
    debtTolerance: 'medium',
    planningHorizon: 'high',
    paybackPatience: 'high',
    reach: 'medium',
    tiesOverMoney: 'medium',
    indieAppetite: 'high',
    competitiveness: 'medHigh',
    variability: 'lowMed',
  },
  express: {
    debtTolerance: 'medium',
    planningHorizon: 'lowMed',
    paybackPatience: 'medHigh',
    reach: 'medHigh',
    tiesOverMoney: 'lowMed',
    indieAppetite: 'low',
    competitiveness: 'low',
    variability: 'medium',
  },
  merchant: {
    debtTolerance: 'lowMed',
    planningHorizon: 'lowMed',
    paybackPatience: 'low',
    reach: 'lowMed',
    tiesOverMoney: 'low',
    indieAppetite: 'lowMed',
    competitiveness: 'medium',
    variability: 'medHigh',
  },
  regionalist: {
    debtTolerance: 'lowMed',
    planningHorizon: 'high',
    paybackPatience: 'medium',
    reach: 'low',
    tiesOverMoney: 'high',
    indieAppetite: 'medium',
    competitiveness: 'high',
    variability: 'low',
  },
};

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/** Draw each weight uniformly within the strategy's band for it. */
export function drawWeights(strategy: StrategyId, rng: Rng): Weights {
  const bands = STRATEGY_BANDS[strategy];
  const weights = {} as Weights;
  for (const key of WEIGHT_KEYS) {
    const [lo, hi] = BANDS[bands[key]];
    weights[key] = round3(lo + rng.next() * (hi - lo));
  }
  return weights;
}

/** Midpoint of each weight's band; used when a stored record has a missing or malformed weight. */
export function defaultWeights(strategy: StrategyId): Weights {
  const bands = STRATEGY_BANDS[strategy];
  const weights = {} as Weights;
  for (const key of WEIGHT_KEYS) {
    const [lo, hi] = BANDS[bands[key]];
    weights[key] = round3((lo + hi) / 2);
  }
  return weights;
}
