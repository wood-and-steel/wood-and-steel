/**
 * What purchases are worth (docs/BOT_PLAN.md, Heuristic player). Each engine, upgrade, and
 * independent railroad gets a value over the bot's planning horizon, from its current income
 * rate and plans. A purchase is worth making when its value beats its cost and it pays back
 * within the bot's patience. The estimates are deliberately simple; M7's tournament tunes them.
 */
import { commodities } from '../../data';
import type { EngineSlot } from '../../board/boardOps';
import { engineDistance } from '../../board/playerBoardData';
import type { Action } from '../engine/actions';
import {
  enginePurchases,
  indiePurchases,
  ownsEngineAtLeast,
  trackCost,
  upgradePurchases,
  type EnginePurchase,
  type UpgradePurchase,
} from '../engine/costs';
import { mapDistance, networkCities, routeCities } from '../engine/network';
import { MARKET_CONTRACT_MIN_ENGINE, MONOPOLY_TIES, UPGRADED_STATIONS_BONUS } from '../engine/rulesData';
import { engineTypes, fulfilledContracts, hasUpgrade, openMarketContracts, type BotWorld } from '../engine/world';
import { moneyValue, railroadTieValue } from '../../Contract';
import { engineLevel } from '../engine/world';
import type { Params } from './params';
import { affinity, type Affinity } from './strategies';
import { cityDegree, commoditiesNear, type DeliveryPlan } from './plans';

export interface Investment {
  action: Action;
  cost: number;
  /** Value over the planning horizon, in dollars. */
  value: number;
  /** Turns to earn back the cost. */
  payback: number;
  label: string;
}

/** What the bot has earned per turn so far (payments and ties), over at least a few turns. */
export function historicalRate(world: BotWorld, p: Params): number {
  const earned = fulfilledContracts(world).reduce((sum, c) => sum + moneyValue(c) + railroadTieValue(c) * p.tieDollars, 0);
  return earned / Math.max(4, world.turn);
}

/**
 * The bot's income per turn and deliveries per turn. A plan near completion has a high rate, so
 * income is estimated over a whole pickup-and-delivery cycle, and capped by the bot's record so far.
 */
export function incomeEstimate(world: BotWorld, p: Params, best: DeliveryPlan | null): { perTurn: number; deliveriesPerTurn: number } {
  if (!best) return { perTurn: 1000, deliveriesPerTurn: 0.15 };
  const cycle = best.turns + 2;
  const cap = 2 * historicalRate(world, p) + 3000;
  return {
    perTurn: Math.min(cap, Math.max(1000, (best.utility - best.path.buildCost * p.trackCostShare) / cycle)),
    deliveriesPerTurn: Math.min(0.6, Math.max(0.1, 1 / cycle)),
  };
}

function reachOf(world: BotWorld, engine: Parameters<typeof engineDistance>[0]): number {
  return engineDistance(engine, hasUpgrade(world, 'service-yard')).total;
}

/** A network city near where the best plan picks up (or delivers), for a new engine. */
function placementCity(world: BotWorld, best: DeliveryPlan | null): string {
  const network = [...networkCities(world)].sort();
  const goal = best?.pickup ?? best?.destination;
  if (!goal) return network[0];
  return network.reduce((a, b) => ((mapDistance(b, goal) ?? 99) < (mapDistance(a, goal) ?? 99) ? b : a));
}

function engineValue(world: BotWorld, p: Params, w: BotWorld['bot']['weights'], purchase: EnginePurchase, perTurn: number): number {
  const newReach = reachOf(world, purchase.engine);
  let value: number;
  if (purchase.tradeIn) {
    const oldReach = reachOf(world, purchase.tradeIn);
    // Most of a delivery cycle is moving; a longer reach shortens that share.
    value = perTurn * p.horizon * 0.8 * (1 - oldReach / newReach);
  } else {
    // A second engine adds capacity, limited by two actions a turn.
    value = perTurn * p.horizon * 0.25;
  }
  // The Mogul opens market contracts; money-minded bots care more.
  if (!ownsEngineAtLeast(world, MARKET_CONTRACT_MIN_ENGINE) && engineLevel(purchase.engine) >= engineLevel(MARKET_CONTRACT_MIN_ENGINE)) {
    const markets = openMarketContracts(world).length;
    value += perTurn * p.horizon * 0.15 * (2 - w.tiesOverMoney) * Math.min(1, markets);
  }
  if (purchase.engine === 'mountain' || purchase.engine === 'challenger') value += perTurn * p.horizon * 0.2;
  if (purchase.engine === 'challenger') value += 2 * p.tieDollars;
  return value;
}

function upgradeValue(
  world: BotWorld,
  p: Params,
  purchase: UpgradePurchase,
  best: DeliveryPlan | null,
  income: { perTurn: number; deliveriesPerTurn: number }
): number {
  const { perTurn, deliveriesPerTurn } = income;
  const types = engineTypes(world).filter((t): t is NonNullable<typeof t> => t !== null);
  switch (purchase.upgrade) {
    case 'upgraded-stations':
      return UPGRADED_STATIONS_BONUS * deliveriesPerTurn * p.horizon;
    case 'timetable':
      return perTurn * p.horizon * 0.12;
    case 'service-yard': {
      const helped = types.filter((t) => ownsEngineAtLeastType(t, 'consolidation'));
      if (helped.length === 0) return 0;
      const reach = Math.max(...helped.map((t) => reachOf(world, t)));
      return perTurn * p.horizon * 0.5 * (1 / (reach + 1));
    }
    case 'roundhouse':
      return types.length === 2 ? perTurn * p.horizon * 0.08 : 0;
    case 'employment-office':
      return best && best.path.toBuild.length >= 2 ? perTurn * p.horizon * 0.08 : perTurn * p.horizon * 0.03;
    case 'hub': {
      const city = purchase.city!;
      const onPlan = best?.path.cities.includes(city) ? 1 : 0;
      const discount = p.horizon * 0.5 * 1000 * Math.min(1, cityDegree(city) / 5);
      // A third offer after each private delivery, cheaper track nearby, and a claim on the city.
      return perTurn * p.horizon * 0.15 + discount + (onPlan + p.competition) * p.tieDollars * 0.5;
    }
    case 'railyard': {
      const wanted = best ? [best.commodity] : [];
      const near = commoditiesNear(purchase.city!);
      const covers = wanted.filter((c) => near.has(c)).length + near.size / 10;
      return perTurn * p.horizon * 0.06 * Math.min(2, covers);
    }
    case 'regional-office':
      return 2 * p.tieDollars * (1 + p.competition);
    case 'commodities-exchange': {
      const size = commodities.get(purchase.commodity!)?.cities.length ?? 0;
      return (MONOPOLY_TIES[size] ?? 0) * p.tieDollars * (1 + p.competition) + perTurn * p.horizon * 0.05;
    }
  }
}

function ownsEngineAtLeastType(engine: Parameters<typeof engineLevel>[0], than: Parameters<typeof engineLevel>[0]): boolean {
  return engineLevel(engine) >= engineLevel(than);
}

/**
 * An independent railroad is worth the track it saves building (more on the plan's path), plus
 * the build actions it saves (two routes an action), each worth half a turn of income.
 */
function indieValue(world: BotWorld, p: Params, routeKeys: string[], best: DeliveryPlan | null, perTurn: number): number {
  const planCities = new Set(best?.path.cities ?? []);
  const track = routeKeys.reduce((sum, key) => {
    const useful = routeCities(key).some((c) => planCities.has(c)) ? 1.3 : 0.8;
    return sum + trackCost(world, key) * useful;
  }, 0);
  const actionsSaved = routeKeys.length / 2;
  return (track + actionsSaved * (perTurn / 2)) * p.indieFactor;
}

/** Every purchase open to the bot, valued. Includes unaffordable ones (the policy may borrow). */
export function investments(world: BotWorld, p: Params, best: DeliveryPlan | null): Investment[] {
  const income = incomeEstimate(world, p, best);
  const w = world.bot.weights;
  const used = new Set(world.turnState.actions);
  const list: Investment[] = [];
  const add = (action: Action, cost: number, value: number, label: string) => {
    const payback = value > 0 ? cost / (value / p.horizon) : Infinity;
    list.push({ action, cost, value, payback, label });
  };

  const like = (kind: Affinity) => affinity(world.bot.strategy, kind);
  if (!used.has('buyEngine')) {
    for (const purchase of enginePurchases(world)) {
      const slot: EngineSlot = purchase.slot;
      const action: Action = purchase.tradeIn
        ? { type: 'buyEngine', engine: purchase.engine, slot }
        : { type: 'buyEngine', engine: purchase.engine, slot, city: placementCity(world, best) };
      add(action, purchase.cost, engineValue(world, p, w, purchase, income.perTurn) * like('engines'), `engine ${purchase.engine}`);
    }
  }
  if (!used.has('buyUpgrade')) {
    for (const purchase of upgradePurchases(world)) {
      const action: Action = { type: 'buyUpgrade', upgrade: purchase.upgrade };
      if (purchase.city) action.city = purchase.city;
      if (purchase.region) action.region = purchase.region;
      if (purchase.commodity) action.commodity = purchase.commodity;
      const value = upgradeValue(world, p, purchase, best, income) * like(UPGRADE_AFFINITY[purchase.upgrade]);
      add(action, purchase.cost, value, `upgrade ${purchase.upgrade}`);
    }
  }
  if (!used.has('acquireRailroad')) {
    for (const purchase of indiePurchases(world)) {
      const value = indieValue(world, p, purchase.routes, best, income.perTurn) * like('railroads');
      add({ type: 'acquireRailroad', name: purchase.name }, purchase.cost, value, `railroad ${purchase.name}`);
    }
  }
  return list;
}

const UPGRADE_AFFINITY: Record<UpgradePurchase['upgrade'], Affinity> = {
  'service-yard': 'movement',
  timetable: 'movement',
  roundhouse: 'movement',
  'upgraded-stations': 'stations',
  'employment-office': 'building',
  hub: 'hub',
  railyard: 'railyard',
  'regional-office': 'regionalOffice',
  'commodities-exchange': 'exchange',
};

/** Cash beyond this sits idle; the more of it, the longer a payback the bot accepts. */
export const IDLE_CASH = 20000;

/** Worthwhile purchases: value beats cost and pays back within the bot's patience. Best first. */
export function worthwhile(list: Investment[], p: Params, cash = 0): Investment[] {
  const patience = p.maxPayback * (1 + Math.max(0, cash - IDLE_CASH) / IDLE_CASH);
  return list
    .filter((i) => i.value > i.cost && i.payback <= patience)
    .sort((a, b) => b.value - b.cost - (a.value - a.cost));
}
