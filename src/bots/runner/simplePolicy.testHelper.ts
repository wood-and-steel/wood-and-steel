/**
 * A tiny, predictable policy for runner tests: choose starting cities, place the engine, deliver
 * what it can, take the best-paying offer, pick up for its contracts, and end the turn.
 */
import { moneyValue } from '../../Contract';
import { listActions, type Action } from '../engine/actions';
import { deliverableContracts } from '../engine/world';
import type { Policy } from '../policy';

export const simplePolicy: Policy = (world, rng) => {
  const actions = listActions(world);
  function of<T extends Action['type']>(type: T): Extract<Action, { type: T }>[] {
    return actions.filter((a): a is Extract<Action, { type: T }> => a.type === type);
  }
  const first = <T,>(items: T[]): T | undefined => items[Math.floor(rng.next() * items.length)];

  const start = first(of('chooseStartingCities'));
  if (start) return { action: start };
  const offers = of('choosePrivateContract');
  if (offers.length > 0) return { action: offers.reduce((best, a) => (moneyValue(a.offer) > moneyValue(best.offer) ? a : best)) };
  const placement = first(of('placeEngine'));
  if (placement) return { action: placement };
  const runs = of('runTrains');
  const delivery = runs.find((a) => a.runs.some((r) => r.events.some((e) => e.kind === 'deliver')));
  if (delivery) return { action: delivery };
  const wanted = new Set(deliverableContracts(world).map((c) => c.commodity));
  const pickUp = of('pickUp').find((a) => !a.claim && wanted.has(a.commodity));
  if (pickUp) return { action: pickUp };
  return { action: { type: 'endTurn' } };
};
