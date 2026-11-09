/**
 * A minimal placeholder policy for M4 (docs/BOT_PLAN.md, Milestones): enough to prove the turn
 * loop end to end. It picks starting cities, places its engine, picks up and delivers what it
 * can reach, takes the best-paying offer, and ends its turn. The heuristic player replaces it in M5.
 */
import { moneyValue } from '../../Contract';
import type { Rng } from '../rng';
import type { Action } from '../engine/actions';
import type { BotWorld } from '../engine/world';
import { deliverableContracts } from '../engine/world';

/** Chooses one of `actions` (never empty) for the bot to take next. */
export type Policy = (world: BotWorld, actions: Action[], rng: Rng) => Action;

function pick<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng.next() * items.length)];
}

export const basicPolicy: Policy = (world, actions, rng) => {
  function of<T extends Action['type']>(type: T): Extract<Action, { type: T }>[] {
    return actions.filter((a): a is Extract<Action, { type: T }> => a.type === type);
  }

  const starts = of('chooseStartingCities');
  if (starts.length > 0) return pick(starts, rng);

  const offers = of('choosePrivateContract');
  if (offers.length > 0) return offers.reduce((best, a) => (moneyValue(a.offer) > moneyValue(best.offer) ? a : best));

  const placements = of('placeEngine');
  if (placements.length > 0) return pick(placements, rng);

  const runs = of('runTrains');
  const delivering = runs.filter((a) => a.runs.some((r) => r.events.some((e) => e.kind === 'deliver')));
  if (delivering.length > 0) return delivering[0];

  const wanted = new Set(deliverableContracts(world).map((c) => c.commodity));
  const pickUp = of('pickUp').find((a) => !a.claim && wanted.has(a.commodity));
  if (pickUp) return pickUp;

  const fetching = runs.filter((a) => a.runs.some((r) => r.events.some((e) => e.kind === 'pickup' && !e.claim)));
  if (fetching.length > 0) return pick(fetching, rng);

  return of('endTurn')[0] ?? actions[0];
};
