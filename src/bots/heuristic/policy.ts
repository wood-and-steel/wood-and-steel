/**
 * The heuristic player (docs/BOT_PLAN.md, Heuristic player). Each call decides one action:
 *
 *  1. Required choices: starting cities, a private contract from the offers, placing an engine.
 *  2. Free pickups for a planned delivery.
 *  3. A delivery that can happen right now.
 *  4. A purchase, if it's worth more than an action spent on the plan (borrowing for it if allowed).
 *  5. The next step of the best delivery plan: run toward it, or build the track it lacks.
 *  6. Otherwise: redraw a hopeless private contract, repay debt, or end the turn.
 *
 * Choices among near-equal options are random within the bot's variability band, using its
 * seeded Rng, so a bot's play is reproducible for a given state.
 */
import { applyAction, availableStartingPairs, type Action } from '../engine/actions';
import { buildLimit, unplacedEngineSlots } from '../engine/costs';
import { repayOptions } from '../engine/finance';
import { runOptions, runnableSlots, suppliedAt, type EngineRun } from '../engine/movement';
import { bfs, canBuildRoute, networkCities, routeCities, trackAdjacency } from '../engine/network';
import { BORROW_STEP } from '../engine/rulesData';
import { trackCost } from '../engine/costs';
import {
  actionsLeft,
  cargo,
  engineCities,
  openPrivateContracts,
  type BotWorld,
} from '../engine/world';
import type { Policy, PolicyDecision } from '../policy';
import type { Rng } from '../rng';
import type { BotPlan } from '../state/botStates';
import { investments, worthwhile } from './invest';
import { chooseWithinBand, params, type Params } from './params';
import { commoditiesNear, planForOffer, rankPlans, type DeliveryPlan } from './plans';

/** A plan the bot keeps between turns gets this bonus, so it doesn't flip-flop. */
export const STICKINESS = 1.25;
/** How far past its usual limit a bot borrows to deliver cargo it is already carrying. */
export const EMERGENCY_DEBT = 15000;

const valid = (world: BotWorld, action: Action) => applyAction(world, action).ok;
const endTurn: PolicyDecision = { action: { type: 'endTurn' } };

function toRecord(plan: DeliveryPlan): BotPlan {
  return { contractId: plan.contractId, commodity: plan.commodity, destination: plan.destination, slot: plan.slot, pickup: plan.pickup };
}

// --- Required choices -----------------------------------------------------------------

function chooseStart(world: BotWorld, p: Params, rng: Rng): PolicyDecision | null {
  const pairs = availableStartingPairs(world);
  if (pairs.length === 0) return null;
  const scored = pairs.map((pair) => {
    const near = new Set([...commoditiesNear(pair[0]), ...commoditiesNear(pair[1])]);
    return { pair, score: near.size };
  });
  const choice = chooseWithinBand(scored, p.band, () => rng.next())!;
  return { action: { type: 'chooseStartingCities', pair: choice.pair }, plan: null };
}

function chooseOffer(world: BotWorld, p: Params, rng: Rng): PolicyDecision | null {
  const offers = world.turnState.offers ?? [];
  if (offers.length === 0) return null;
  const scored = offers.map((offer) => ({ offer, score: planForOffer(world, p, offer)?.rate ?? -Infinity }));
  const finite = scored.filter((s) => Number.isFinite(s.score));
  const choice = chooseWithinBand(finite.length > 0 ? finite : scored.map((s) => ({ ...s, score: 0 })), p.band, () => rng.next())!;
  return { action: { type: 'choosePrivateContract', offer: choice.offer } };
}

function choosePlacement(world: BotWorld, p: Params): PolicyDecision | null {
  const slot = unplacedEngineSlots(world)[0];
  if (slot === undefined) return null;
  const best = rankPlans(world, p).find((plan) => plan.slot === slot);
  const network = [...networkCities(world)].sort();
  const city = best && network.includes(best.start) ? best.start : network[0];
  return { action: { type: 'placeEngine', slot, city } };
}

// --- Plan steps --------------------------------------------------------------------------

/** Free pickup: an empty engine sitting in a city that supplies a planned commodity. */
function freePickup(world: BotWorld, plans: DeliveryPlan[]): PolicyDecision | null {
  const places = engineCities(world);
  const loads = cargo(world);
  for (const plan of plans) {
    for (const slot of [plan.slot, plan.slot === 0 ? 1 : 0] as const) {
      const city = places[slot];
      if (!city || loads[slot] !== null || !suppliedAt(world, city).has(plan.commodity)) continue;
      const claim = plan.claim ? plan.contractId ?? undefined : undefined;
      const action: Action = { type: 'pickUp', slot, commodity: plan.commodity, ...(claim ? { claim } : {}) };
      if (valid(world, action)) return { action, plan: toRecord(plan) };
    }
  }
  return null;
}

/** Any delivery possible now, best-paying first. */
function deliverNow(world: BotWorld): PolicyDecision | null {
  let best: { action: Action; payment: number } | null = null;
  for (const slot of runnableSlots(world)) {
    for (const run of runOptions(world, slot)) {
      if (!run.events.some((e) => e.kind === 'deliver')) continue;
      const action: Action = { type: 'runTrains', runs: [run] };
      const result = applyAction(world, action);
      if (!result.ok) continue;
      const payment = result.world.bot.cash - world.bot.cash;
      if (!best || payment > best.payment) best = { action, payment };
    }
  }
  return best ? { action: best.action, plan: null } : null;
}

/** Cash the bot wants to keep after a purchase: the best plan's next track, and a cushion. */
function reserve(world: BotWorld, best: DeliveryPlan | null): number {
  const next = best?.path.toBuild.slice(0, buildLimit(world)) ?? [];
  const cost = next.reduce((sum, r) => sum + trackCost(world, r), 0);
  return Math.max(Math.min(cost, 8000), 3000) * (1 - world.bot.weights.debtTolerance);
}

/** Borrow enough for `cost`, if the bot's tolerance (plus any `extra` room) and this turn's actions allow it. */
function borrowFor(world: BotWorld, p: Params, cost: number, extra = 0, needActions = 2): PolicyDecision | null {
  if (world.turnState.actions.includes('borrow') || actionsLeft(world) < needActions) return null;
  const short = cost - world.bot.cash;
  if (short <= 0) return null;
  const amount = Math.ceil(short / BORROW_STEP) * BORROW_STEP;
  if (world.bot.debt + amount > p.maxDebt + extra || amount > 30000) return null;
  const action: Action = { type: 'borrow', amount };
  return valid(world, action) ? { action } : null;
}

function invest(world: BotWorld, p: Params, best: DeliveryPlan | null, rng: Rng): PolicyDecision | null {
  const options = worthwhile(investments(world, p, best), p, world.bot.cash);
  if (options.length === 0) return null;
  // A purchase must be worth more than one action spent on the plan.
  const actionWorth = best ? best.rate / 2 : 0;
  const scored = options
    .filter((i) => i.value - i.cost > actionWorth)
    .map((i) => ({ ...i, score: i.value - i.cost }));
  const choice = chooseWithinBand(scored, p.band, () => rng.next());
  if (!choice) return null;
  // Try the chosen purchase first, then the rest best first: buy it, or borrow for it if allowed.
  const ordered = [choice, ...scored.filter((i) => i !== choice).sort((a, b) => b.score - a.score)];
  const keep = reserve(world, best);
  for (const option of ordered) {
    if (world.bot.cash - option.cost >= keep && valid(world, option.action)) return { action: option.action };
    const borrow = borrowFor(world, p, option.cost + keep);
    if (borrow) return borrow;
  }
  return null;
}

/** Own-track distance to `target` from every city the engine might stop at. */
function trackDistances(world: BotWorld, target: string): Map<string, number> {
  return bfs(target, trackAdjacency(world)).dist;
}

/** The next action for a plan: run toward its pickup or destination, or build what's missing. */
export function advance(world: BotWorld, p: Params, plan: DeliveryPlan): PolicyDecision | null {
  const record = toRecord(plan);
  const slot = plan.slot;
  const runnable = runnableSlots(world).includes(slot);
  if (runnable) {
    const runs = runOptions(world, slot);
    const delivers = runs.find((r) => r.events.some((e) => e.kind === 'deliver' && e.contractId === plan.contractId));
    if (delivers && valid(world, { type: 'runTrains', runs: [delivers] })) return { action: { type: 'runTrains', runs: [delivers] }, plan: record };

    const carrying = cargo(world)[slot] === plan.commodity;
    const target = carrying ? plan.destination : plan.pickup ?? plan.destination;
    const distance = trackDistances(world, plan.destination);
    const toTarget = trackDistances(world, target);
    const end = (r: EngineRun) => r.path[r.path.length - 1];
    if (!carrying) {
      // Pick up on the way, preferring runs that end nearer the destination.
      const pickups = runs
        .filter((r) => r.events.some((e) => e.kind === 'pickup' && e.commodity === plan.commodity && (!plan.claim || e.claim === plan.contractId)))
        .sort((a, b) => (distance.get(end(a)) ?? 99) - (distance.get(end(b)) ?? 99));
      for (const run of pickups) {
        const action: Action = { type: 'runTrains', runs: [run] };
        if (valid(world, action)) return { action, plan: record };
      }
    }
    // Otherwise move closer to the target along own track.
    const here = toTarget.get(engineCities(world)[slot]!) ?? Infinity;
    const closer = runs
      .filter((r) => r.events.length === 0 && (toTarget.get(end(r)) ?? Infinity) < here)
      .sort((a, b) => (toTarget.get(end(a)) ?? 99) - (toTarget.get(end(b)) ?? 99));
    for (const run of closer) {
      const action: Action = { type: 'runTrains', runs: [run] };
      if (valid(world, action)) return { action, plan: record };
    }
  }

  // Build the next missing routes along the plan, in order, as far as cash allows.
  if (plan.path.toBuild.length > 0 && !world.turnState.actions.includes('buildTrack')) {
    const connected = new Set(networkCities(world));
    const chosen: string[] = [];
    let cost = 0;
    for (const route of plan.path.toBuild) {
      if (chosen.length >= buildLimit(world) || !canBuildRoute(world, route, connected)) break;
      const price = trackCost(world, route);
      if (cost + price > world.bot.cash) break;
      chosen.push(route);
      cost += price;
      routeCities(route).forEach((c) => connected.add(c));
    }
    if (chosen.length > 0) {
      const action: Action = { type: 'buildTrack', routes: chosen };
      if (valid(world, action)) return { action, plan: record };
    }
    const first = plan.path.toBuild[0];
    if (first && canBuildRoute(world, first, networkCities(world))) {
      // Cargo already aboard can't be dropped, so borrow past the usual limit to deliver it.
      const aboard = cargo(world)[slot] === plan.commodity;
      const borrow = borrowFor(world, p, trackCost(world, first), aboard ? EMERGENCY_DEBT : 0);
      if (borrow) return { ...borrow, plan: record };
    }
  }
  return null;
}

// --- The policy ------------------------------------------------------------------------

export const heuristicPolicy: Policy = (world, rng) => {
  const p = params(world);
  if (world.phase === 'setup') return chooseStart(world, p, rng) ?? endTurn;
  if (world.turnState.offers) return chooseOffer(world, p, rng) ?? endTurn;
  const placement = choosePlacement(world, p);
  if (placement) return placement;

  // Rank plans, favoring the one the bot already committed to.
  const kept = world.bot.plan?.contractId;
  const plans = rankPlans(world, p)
    .map((plan) => ({ plan, score: plan.contractId === kept ? plan.rate * (plan.rate > 0 ? STICKINESS : 1 / STICKINESS) : plan.rate }))
    .sort((a, b) => b.score - a.score);
  const chosen = chooseWithinBand(plans, p.band, () => rng.next());
  const ordered = chosen ? [chosen.plan, ...plans.map((x) => x.plan).filter((plan) => plan !== chosen.plan)] : [];
  const best = ordered[0] ?? null;
  // Commit only to plans the bot can pay for, or that deliver cargo already aboard.
  const loads = cargo(world);
  const usable = ordered.filter((plan) => plan.affordable || loads[plan.slot] === plan.commodity);

  const pickup = freePickup(world, usable.slice(0, 3));
  if (pickup) return pickup;
  if (actionsLeft(world) <= 0) return { ...endTurn, plan: best ? toRecord(best) : undefined };

  const delivery = deliverNow(world);
  if (delivery) return delivery;

  const purchase = invest(world, p, best, rng);
  if (purchase) return purchase;

  for (const plan of usable.slice(0, 4)) {
    const step = advance(world, p, plan);
    if (step) return step;
  }

  // A private contract the bot can't realistically deliver: draw new ones, unless an engine
  // already carries its commodity (there's no way to drop a load).
  const contract = openPrivateContracts(world)[0];
  const privatePlan = ordered.find((plan) => plan.contractId === contract?.id);
  const hopeless = !privatePlan || !privatePlan.affordable || privatePlan.turns > p.horizon + 2;
  const carried = contract && cargo(world).includes(contract.commodity);
  if (contract && hopeless && !carried && !world.turnState.actions.includes('redrawPrivateContract')) {
    return { action: { type: 'redrawPrivateContract', contractId: contract.id }, plan: null };
  }

  // Pay down debt when there's nothing better to do, if the bot dislikes debt.
  if (!world.turnState.actions.includes('repay') && world.bot.weights.debtTolerance < 0.5) {
    const amounts = repayOptions(world.bot).filter((a) => world.bot.cash - a >= Math.max(8000, reserve(world, best)));
    if (amounts.length > 0) return { action: { type: 'repay', amount: Math.max(...amounts) } };
  }

  return { ...endTurn, plan: best ? toRecord(best) : undefined };
};
