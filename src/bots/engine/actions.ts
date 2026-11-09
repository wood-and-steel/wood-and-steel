/**
 * Bot actions (docs/BOT_PLAN.md, Actions mapped to effects). listActions returns the legal
 * actions now; applyAction checks one and returns the predicted next world plus its effects:
 * the app moves, board ops, and narration the runner carries out, in order.
 *
 * Never offered: "Go first next round" (not in the app). Bankrupting deliveries are refused.
 */
import { routes } from '../../data';
import { STARTING_CITY_PAIRS } from '../../data/startingRoutes';
import type { Contract, PrivateContractSpec } from '../../Contract';
import type { BoardOp, EngineSlot } from '../../board/boardOps';
import type { EngineTypeId } from '../../board/playerBoardData';
import type { RegionCode } from '../../stores/gameStore';
import {
  buildLimit,
  enginePurchases,
  indiePurchases,
  trackCost,
  unplacedEngineSlots,
  upgradePurchases,
  type UpgradePurchase,
} from './costs';
import { borrowOptions, debtServiceForDelivery, deliveryPayment, repayOptions } from './finance';
import {
  canClaimMarket,
  checkPath,
  engineReach,
  roundhouseOptions,
  runOptions,
  runnableSlots,
  suppliesCommodity,
  wants,
  type EngineRun,
  type RunTrains,
} from './movement';
import { canBuildRoute, networkCities, routeCities } from './network';
import { commodityName, engineName, list, money, regionName, routeLabel, slotLabel, upgradeLabel } from './narration';
import { ROUNDHOUSE_APPROACH, UPGRADE_PRICES, type UpgradeKey } from './rulesData';
import {
  actionsLeft,
  cargo,
  deliverableContracts,
  emptyTurnState,
  engineCities,
  engineTypes,
  hasUpgrade,
  openPrivateContracts,
  playerProps,
  type ActionKind,
  type BotWorld,
} from './world';

// --- Types -------------------------------------------------------------------

export type Action =
  | { type: 'chooseStartingCities'; pair: [string, string] }
  /** Free: put an engine that isn't on the board yet (the starting John Bull) on a network city. */
  | { type: 'placeEngine'; slot: EngineSlot; city: string }
  | ({ type: 'runTrains' } & RunTrains)
  | { type: 'buildTrack'; routes: string[] }
  /**
   * `city` places a new token, which may pick up a commodity there (and claim a market contract
   * for it). A trade-in keeps the old engine's city and cargo.
   */
  | { type: 'buyEngine'; engine: EngineTypeId; slot: EngineSlot; city?: string; pickup?: { commodity: string; claim?: string } }
  | { type: 'acquireRailroad'; name: string }
  | { type: 'borrow'; amount: number }
  | { type: 'repay'; amount: number }
  | { type: 'buyUpgrade'; upgrade: UpgradeKey; city?: string; region?: RegionCode; commodity?: string }
  | { type: 'redrawPrivateContract'; contractId: string }
  /** Free: pick one of the offers after a private contract was fulfilled or discarded. */
  | { type: 'choosePrivateContract'; offer: PrivateContractSpec }
  | { type: 'endTurn' };

/** App moves, with the arguments the runner passes (GamePort). */
export type GameMove =
  | { name: 'generateStartingContract'; args: [[string, string], string] }
  | { name: 'toggleContractFulfilled'; args: [string] }
  | { name: 'claimMarketContract'; args: [string] }
  | { name: 'addContract'; args: [string, string, 'private'] }
  | { name: 'deleteContract'; args: [string] }
  | { name: 'acquireIndependentRailroad'; args: [string] }
  | { name: 'claimHubCity'; args: [string] }
  | { name: 'claimRegionalOffice'; args: [string] }
  | { name: 'endTurn'; args: [] };

export type Effect =
  | { kind: 'move'; move: GameMove }
  | { kind: 'boardOp'; op: BoardOp }
  /** The runner fetches private contract offers (generatePrivateContractOffers) and sets them with setOffers. */
  | { kind: 'requestOffers' }
  | { kind: 'narrate'; line: string };

export type ApplyResult = { ok: true; world: BotWorld; effects: Effect[] } | { ok: false; error: string };

/** Which counted action kind an action is, or null for free ones. */
export function actionKind(action: Action): ActionKind | null {
  switch (action.type) {
    case 'runTrains':
    case 'buildTrack':
    case 'buyEngine':
    case 'acquireRailroad':
    case 'borrow':
    case 'repay':
    case 'buyUpgrade':
    case 'redrawPrivateContract':
      return action.type;
    default:
      return null;
  }
}

// --- Helpers -------------------------------------------------------------------

const fail = (error: string): ApplyResult => ({ ok: false, error });

function nameOf(world: BotWorld): string {
  return world.bot.name;
}

function contractLabel(c: Pick<Contract, 'commodity' | 'destinationKey'>): string {
  return `${commodityName(c.commodity)} to ${c.destinationKey}`;
}

function setPlayer(world: BotWorld, change: (p: NonNullable<ReturnType<typeof playerProps>>) => void): void {
  const props = playerProps(world);
  if (props) change(props);
}

function addActiveCity(world: BotWorld, city: string): void {
  setPlayer(world, (p) => {
    if (!p.activeCities.includes(city)) p.activeCities.push(city);
  });
}

function setEngineCity(world: BotWorld, slot: EngineSlot, city: string | null): void {
  const pair: [string | null, string | null] = [...engineCities(world)];
  pair[slot] = city;
  world.board.engines[world.playerID] = pair;
}

function setCargoIn(world: BotWorld, slot: EngineSlot, commodity: string | null): void {
  const pair: [string | null, string | null] = [...cargo(world)];
  pair[slot] = commodity;
  world.board.cargo[world.playerID] = pair;
}

function claimRouteIn(world: BotWorld, routeKey: string): void {
  const owners = world.board.track[routeKey] ?? [];
  if (!owners.includes(world.playerID)) world.board.track[routeKey] = [...owners, world.playerID];
}

let placeholderCount = 0;
function placeholderContract(spec: PrivateContractSpec, playerID: string): Contract {
  placeholderCount += 1;
  return {
    id: `pending-${placeholderCount}`,
    destinationKey: spec.destinationKey,
    commodity: spec.commodity,
    type: 'private',
    fulfilled: false,
    playerID,
    creationTime: 0,
    turnsHeld: 0,
  };
}

/** Give the world the private contract offers the runner fetched. */
export function setOffers(world: BotWorld, offers: PrivateContractSpec[]): BotWorld {
  const next = structuredClone(world);
  next.turnState.offers = structuredClone(offers);
  return next;
}

/** The bot has no private contract (e.g. after a reload mid-choice) and needs offers. */
export function needsPrivateContract(world: BotWorld): boolean {
  return world.phase === 'play' && openPrivateContracts(world).length === 0;
}

// --- listActions ----------------------------------------------------------------

/** Starting pairs no other player has taken a city of. */
export function availableStartingPairs(world: BotWorld): [string, string][] {
  const taken = new Set(world.players.filter(([id]) => id !== world.playerID).flatMap(([, p]) => p.activeCities));
  return STARTING_CITY_PAIRS.filter(([a, b]) => !taken.has(a) && !taken.has(b)).map(([a, b]) => [a, b]);
}

function buildCombos(world: BotWorld): string[][] {
  const limit = buildLimit(world);
  const combos: string[][] = [];
  const seen = new Set<string>();
  const extend = (chosen: string[], connected: Set<string>) => {
    if (chosen.length > 0) {
      const key = [...chosen].sort().join('|');
      if (seen.has(key)) return;
      seen.add(key);
      combos.push(chosen);
    }
    if (chosen.length >= limit || combos.length >= 600) return;
    const candidates = new Set<string>();
    for (const city of connected) {
      for (const key of routes.keys()) if (routeCities(key).includes(city)) candidates.add(key);
    }
    for (const key of [...candidates].sort()) {
      if (chosen.includes(key) || !canBuildRoute(world, key, connected)) continue;
      extend([...chosen, key], new Set([...connected, ...routeCities(key)]));
    }
  };
  extend([], networkCities(world));
  return combos;
}

/** Every legal action now. Free actions come first when they're required. */
export function listActions(world: BotWorld): Action[] {
  if (world.currentPlayer !== world.playerID) return [];

  if (world.phase === 'setup') {
    const props = playerProps(world);
    if (props && props.activeCities.length === 0) {
      return availableStartingPairs(world).map((pair) => ({ type: 'chooseStartingCities', pair }));
    }
    return [];
  }
  if (world.phase !== 'play') return [];

  const ts = world.turnState;
  if (ts.offers) return ts.offers.map((offer) => ({ type: 'choosePrivateContract', offer }));
  if (ts.awaitingOffers) return [];

  const unplaced = unplacedEngineSlots(world);
  if (unplaced.length > 0) {
    const cityChoices = [...networkCities(world)].sort();
    return cityChoices.map((city) => ({ type: 'placeEngine', slot: unplaced[0], city }));
  }

  const actions: Action[] = [];
  const used = new Set(ts.actions);
  const cash = world.bot.cash;
  if (actionsLeft(world) > 0) {
    // Run trains (may repeat, each engine once a turn)
    // Generated runs are checked in full, so e.g. a delivery that would bankrupt the bot is left out.
    const legal = (a: Action) => applyAction(world, a).ok;
    const slots = runnableSlots(world);
    const singles = slots.flatMap((slot) => runOptions(world, slot)).filter((run) => legal({ type: 'runTrains', runs: [run] }));
    for (const run of singles) actions.push({ type: 'runTrains', runs: [run] });
    if (slots.length === 2) {
      const eventful = (slot: EngineSlot) => singles.filter((r) => r.slot === slot && r.events.length > 0);
      for (const a of eventful(slots[0])) {
        for (const b of eventful(slots[1])) {
          const pair: Action = { type: 'runTrains', runs: [a, b] };
          if (legal(pair)) actions.push(pair);
        }
      }
    }
    for (const option of roundhouseOptions(world)) {
      const action: Action = { type: 'runTrains', ...option };
      if (legal(action)) actions.push(action);
    }

    if (!used.has('buildTrack')) {
      for (const combo of buildCombos(world)) {
        if (combo.reduce((sum, key) => sum + trackCost(world, key), 0) <= cash) actions.push({ type: 'buildTrack', routes: combo });
      }
    }
    if (!used.has('buyEngine')) {
      const network = [...networkCities(world)].sort();
      for (const p of enginePurchases(world)) {
        if (p.cost > cash) continue;
        if (p.tradeIn) {
          actions.push({ type: 'buyEngine', engine: p.engine, slot: p.slot });
          continue;
        }
        // What the new engine might pick up where it's placed (buying a Mogul can open market claims).
        const withEngine = structuredClone(world);
        const types: [EngineTypeId | null, EngineTypeId | null] = [...engineTypes(world)];
        types[p.slot] = p.engine;
        withEngine.board.engineTypes[world.playerID] = types;
        const wanted = wants(withEngine);
        for (const city of network) {
          actions.push({ type: 'buyEngine', engine: p.engine, slot: p.slot, city });
          for (const want of wanted) {
            if (suppliesCommodity(world, city, want.commodity)) {
              actions.push({ type: 'buyEngine', engine: p.engine, slot: p.slot, city, pickup: { ...want } });
            }
          }
        }
      }
    }
    if (!used.has('acquireRailroad')) {
      for (const p of indiePurchases(world)) if (p.cost <= cash) actions.push({ type: 'acquireRailroad', name: p.name });
    }
    if (!used.has('borrow')) for (const amount of borrowOptions()) actions.push({ type: 'borrow', amount });
    if (!used.has('repay')) for (const amount of repayOptions(world.bot)) actions.push({ type: 'repay', amount });
    if (!used.has('buyUpgrade')) {
      for (const p of upgradePurchases(world)) {
        if (p.cost <= cash) actions.push({ type: 'buyUpgrade', ...upgradeFields(p) });
      }
    }
    if (!used.has('redrawPrivateContract')) {
      for (const c of openPrivateContracts(world)) actions.push({ type: 'redrawPrivateContract', contractId: c.id });
    }
  }
  actions.push({ type: 'endTurn' });
  return actions;
}

function upgradeFields(p: UpgradePurchase): Omit<Extract<Action, { type: 'buyUpgrade' }>, 'type'> {
  const fields: Omit<Extract<Action, { type: 'buyUpgrade' }>, 'type'> = { upgrade: p.upgrade };
  if (p.city) fields.city = p.city;
  if (p.region) fields.region = p.region;
  if (p.commodity) fields.commodity = p.commodity;
  return fields;
}

// --- applyAction -----------------------------------------------------------------

/** Check an action and return the predicted world and its effects. Doesn't change `world`. */
export function applyAction(world: BotWorld, action: Action): ApplyResult {
  if (world.currentPlayer !== world.playerID) return fail('not this bot’s turn');
  const next = structuredClone(world);
  const effects: Effect[] = [];
  const narrate = (line: string) => effects.push({ kind: 'narrate', line });
  const move = (m: GameMove) => effects.push({ kind: 'move', move: m });
  const boardOp = (op: BoardOp) => effects.push({ kind: 'boardOp', op });
  const name = nameOf(world);
  const ts = next.turnState;

  if (action.type === 'chooseStartingCities') {
    if (world.phase !== 'setup') return fail('starting cities are chosen in setup');
    if ((playerProps(world)?.activeCities.length ?? 0) > 0) return fail('starting cities already chosen');
    const pair = availableStartingPairs(world).find(([a, b]) => a === action.pair[0] && b === action.pair[1]);
    if (!pair) return fail('that starting pair is taken');
    setPlayer(next, (p) => {
      p.activeCities = [...pair];
    });
    move({ name: 'generateStartingContract', args: [[pair[0], pair[1]], world.playerID] });
    narrate(`${name} chose ${pair[0]} and ${pair[1]} as starting cities.`);
    // The move ends the turn itself.
    next.turnState = emptyTurnState();
    next.currentPlayer = '';
    return { ok: true, world: next, effects };
  }

  if (world.phase !== 'play') return fail(`no bot actions in phase ${world.phase}`);

  if (action.type === 'choosePrivateContract') {
    const offer = world.turnState.offers?.find(
      (o) => o.commodity === action.offer.commodity && o.destinationKey === action.offer.destinationKey
    );
    if (!offer) return fail('not one of the offers');
    next.contracts.unshift(placeholderContract(offer, world.playerID));
    ts.offers = null;
    ts.awaitingOffers = false;
    move({ name: 'addContract', args: [offer.commodity, offer.destinationKey, 'private'] });
    narrate(`${name} chose a private contract: ${contractLabel(offer)}.`);
    return { ok: true, world: next, effects };
  }
  if (world.turnState.offers || world.turnState.awaitingOffers) return fail('choose a private contract first');

  if (action.type === 'endTurn') {
    move({ name: 'endTurn', args: [] });
    narrate(`${name} ended the turn.`);
    next.turnState = emptyTurnState();
    next.currentPlayer = '';
    return { ok: true, world: next, effects };
  }

  if (action.type === 'placeEngine') {
    if (!unplacedEngineSlots(world).includes(action.slot)) return fail('that engine is already on the board');
    if (!networkCities(world).has(action.city)) return fail(`${action.city} is not on the network`);
    setEngineCity(next, action.slot, action.city);
    boardOp({ type: 'moveEngine', playerID: world.playerID, slot: action.slot, city: action.city });
    narrate(`${name} placed the ${engineName(engineTypes(world)[action.slot]!)} in ${action.city}.`);
    return { ok: true, world: next, effects };
  }

  // Counted actions
  const kind = actionKind(action)!;
  if (actionsLeft(world) <= 0) return fail('no actions left this turn');
  if (kind !== 'runTrains' && world.turnState.actions.includes(kind)) return fail(`already did ${kind} this turn`);
  ts.actions.push(kind);

  switch (action.type) {
    case 'runTrains': {
      const error = applyRuns(world, next, action, effects);
      return error ? fail(error) : { ok: true, world: next, effects };
    }

    case 'buildTrack': {
      if (action.routes.length === 0) return fail('no routes');
      if (action.routes.length > buildLimit(world)) return fail('too many routes');
      if (new Set(action.routes).size !== action.routes.length) return fail('a route is listed twice');
      const connected = networkCities(world);
      let total = 0;
      for (const key of action.routes) {
        if (!canBuildRoute(next, key, connected)) return fail(`can't build ${key}`);
        total += trackCost(next, key);
        claimRouteIn(next, key);
        routeCities(key).forEach((c) => connected.add(c));
        boardOp({ type: 'claimRoute', routeKey: key, playerID: world.playerID });
      }
      if (total > world.bot.cash) return fail('not enough cash');
      next.bot.cash -= total;
      narrate(`${name} built ${list(action.routes.map(routeLabel))} for ${money(total)}.`);
      return { ok: true, world: next, effects };
    }

    case 'buyEngine': {
      const purchase = enginePurchases(world).find((p) => p.engine === action.engine && p.slot === action.slot);
      if (!purchase) return fail('that engine purchase is not allowed');
      if (purchase.cost > world.bot.cash) return fail('not enough cash');
      if (purchase.tradeIn && action.pickup) return fail('only a new engine picks up where it is placed');
      next.bot.cash -= purchase.cost;
      const types: [EngineTypeId | null, EngineTypeId | null] = [...engineTypes(world)];
      types[action.slot] = action.engine;
      next.board.engineTypes[world.playerID] = types;
      boardOp({ type: 'setEngineType', playerID: world.playerID, slot: action.slot, engineType: action.engine });
      const label = `${engineName(action.engine)}`;
      if (purchase.tradeIn) {
        narrate(`${name} bought a ${label} for ${money(purchase.cost)}, trading in the ${engineName(purchase.tradeIn)}.`);
      } else {
        if (!action.city || !networkCities(world).has(action.city)) return fail('a new engine needs a city on the network');
        setEngineCity(next, action.slot, action.city);
        boardOp({ type: 'moveEngine', playerID: world.playerID, slot: action.slot, city: action.city });
        const bought = `bought a ${label} for ${money(purchase.cost)}`;
        if (action.pickup) {
          const { commodity, claim } = action.pickup;
          if (!suppliesCommodity(next, action.city, commodity)) return fail(`${action.city} doesn't supply ${commodity}`);
          let claimed = '';
          if (claim) {
            const market = claimMarket(next, claim, commodity, effects);
            if (typeof market === 'string') return fail(market);
            claimed = `, claiming the market contract for ${contractLabel(market)}`;
          }
          setCargoIn(next, action.slot, commodity);
          boardOp({ type: 'setCargo', playerID: world.playerID, slot: action.slot, commodity });
          narrate(`${name} ${bought}, placed it in ${action.city}, and picked up ${commodityName(commodity)}${claimed}.`);
        } else {
          narrate(`${name} ${bought} and placed it in ${action.city}.`);
        }
      }
      return { ok: true, world: next, effects };
    }

    case 'acquireRailroad': {
      const purchase = indiePurchases(world).find((p) => p.name === action.name);
      if (!purchase) return fail(`can't acquire ${action.name}`);
      if (purchase.cost > world.bot.cash) return fail('not enough cash');
      next.bot.cash -= purchase.cost;
      delete next.independentRailroads[action.name];
      for (const key of purchase.routes) {
        claimRouteIn(next, key);
        routeCities(key).forEach((c) => addActiveCity(next, c));
      }
      move({ name: 'acquireIndependentRailroad', args: [action.name] });
      const remaining = Object.fromEntries(
        Object.entries(next.independentRailroads).map(([n, r]) => [n, r.routes.map((x) => x.key)])
      );
      boardOp({ type: 'reconcileIndependentRailroads', railroads: remaining, acquirers: { [action.name]: world.playerID } });
      narrate(`${name} acquired the ${action.name} for ${money(purchase.cost)}.`);
      return { ok: true, world: next, effects };
    }

    case 'borrow': {
      if (!borrowOptions().includes(action.amount)) return fail('borrow in steps of $5,000');
      next.bot.cash += action.amount;
      next.bot.debt += action.amount;
      narrate(`${name} borrowed ${money(action.amount)}.`);
      return { ok: true, world: next, effects };
    }

    case 'repay': {
      if (!repayOptions(world.bot).includes(action.amount)) return fail('that repayment is not allowed');
      next.bot.cash -= action.amount;
      next.bot.debt -= action.amount;
      narrate(`${name} repaid ${money(action.amount)} of debt.`);
      return { ok: true, world: next, effects };
    }

    case 'buyUpgrade': {
      const purchase = upgradePurchases(world).find(
        (p) =>
          p.upgrade === action.upgrade &&
          (p.city ?? null) === (action.city ?? null) &&
          (p.region ?? null) === (action.region ?? null) &&
          (p.commodity ?? null) === (action.commodity ?? null)
      );
      if (!purchase) return fail(`can't buy ${action.upgrade} that way`);
      const price = UPGRADE_PRICES[action.upgrade];
      if (price > world.bot.cash) return fail('not enough cash');
      next.bot.cash -= price;
      const label = upgradeLabel(action.upgrade);
      switch (action.upgrade) {
        case 'hub':
          setPlayer(next, (p) => {
            p.hubCity = action.city!;
          });
          addActiveCity(next, action.city!);
          move({ name: 'claimHubCity', args: [action.city!] });
          narrate(`${name} bought ${label} in ${action.city} for ${money(price)}.`);
          break;
        case 'railyard':
          next.board.railyards[world.playerID] = action.city!;
          boardOp({ type: 'moveRailyard', playerID: world.playerID, city: action.city! });
          narrate(`${name} bought ${label} in ${action.city} for ${money(price)}.`);
          break;
        case 'regional-office':
          setPlayer(next, (p) => {
            p.regionalOffice = action.region!;
          });
          move({ name: 'claimRegionalOffice', args: [action.region!] });
          narrate(`${name} bought ${label} in ${regionName(action.region!)} for ${money(price)}.`);
          break;
        default: {
          const owned = next.board.upgrades[world.playerID] ?? [];
          next.board.upgrades[world.playerID] = [...owned, action.upgrade];
          boardOp({ type: 'setUpgrade', playerID: world.playerID, upgrade: action.upgrade, owned: true });
          if (action.upgrade === 'commodities-exchange') {
            next.bot.exchangeCommodity = action.commodity!;
            narrate(`${name} bought ${label} for ${commodityName(action.commodity!)} for ${money(price)}.`);
          } else {
            narrate(`${name} bought ${label} for ${money(price)}.`);
          }
        }
      }
      return { ok: true, world: next, effects };
    }

    case 'redrawPrivateContract': {
      const contract = openPrivateContracts(world).find((c) => c.id === action.contractId);
      if (!contract) return fail('not one of the bot’s private contracts');
      next.contracts = next.contracts.filter((c) => c.id !== contract.id);
      ts.awaitingOffers = true;
      move({ name: 'deleteContract', args: [contract.id] });
      effects.push({ kind: 'requestOffers' });
      narrate(`${name} discarded the private contract for ${contractLabel(contract)}.`);
      return { ok: true, world: next, effects };
    }
  }
}

// --- Running trains ----------------------------------------------------------------

/** Claim an open market contract for `commodity` in `next`; returns it, or an error message. */
function claimMarket(next: BotWorld, contractId: string, commodity: string, effects: Effect[]): Contract | string {
  const market = next.contracts.find((c) => c.id === contractId);
  if (!market || market.type !== 'market' || market.playerID !== null || market.fulfilled) return 'that market contract is not open';
  if (market.commodity !== commodity) return 'the claimed contract is for another commodity';
  if (!canClaimMarket(next)) return 'can’t claim a market contract now';
  market.playerID = next.playerID;
  market.turnsHeld = 1;
  effects.push({ kind: 'move', move: { name: 'claimMarketContract', args: [market.id] } });
  return market;
}

/** Apply a Run Trains action to `next`, appending effects; returns an error message or null. */
function applyRuns(world: BotWorld, next: BotWorld, action: RunTrains, effects: Effect[]): string | null {
  const narrate = (line: string) => effects.push({ kind: 'narrate', line });
  const name = nameOf(world);
  if (action.runs.length === 0 || action.runs.length > 2) return 'run one or two engines';
  if (new Set(action.runs.map((r) => r.slot)).size !== action.runs.length) return 'an engine is listed twice';
  const runnable = runnableSlots(world);
  for (const run of action.runs) if (!runnable.includes(run.slot)) return `the ${slotLabel(run.slot)} engine can't run`;

  if (action.roundhouse) {
    if (!hasUpgrade(world, 'roundhouse')) return 'no Roundhouse';
    if (action.runs.length !== 2) return 'a Roundhouse run needs both engines';
    const [carrier, receiver] = action.runs;
    const loads = cargo(world);
    if (loads[carrier.slot] === null) return 'the first engine must carry a commodity';
    if (loads[receiver.slot] !== null) return 'the second engine must be empty';
    if (carrier.events.length > 0) return 'the carrier hands its commodity over, so it has no stops';
    const approach = action.roundhouse.approach;
    const meet = carrier.path[carrier.path.length - 1];
    if (approach[0] !== engineCities(world)[receiver.slot] || approach[approach.length - 1] !== meet) {
      return 'the second engine must go from its city to where the first stops';
    }
    if (approach.length - 1 > ROUNDHOUSE_APPROACH) return 'the second engine may move at most 4 segments to meet';
    const pathError = checkPath(world, approach);
    if (pathError) return pathError;
    if (receiver.path[0] !== meet) return 'the second engine continues from the meeting city';
    if (receiver.events.some((e) => e.kind === 'pickup' && e.at === 0)) return 'the second engine takes the handed-over commodity';
    // Carrier moves, then hands over.
    const commodity = loads[carrier.slot]!;
    const carrierError = runOne(world, next, { ...carrier }, effects, true);
    if (carrierError) return carrierError;
    setCargoIn(next, carrier.slot, null);
    effects.push({ kind: 'boardOp', op: { type: 'setCargo', playerID: world.playerID, slot: carrier.slot, commodity: null } });
    setEngineCity(next, receiver.slot, meet);
    setCargoIn(next, receiver.slot, commodity);
    effects.push({ kind: 'boardOp', op: { type: 'moveEngine', playerID: world.playerID, slot: receiver.slot, city: meet } });
    effects.push({ kind: 'boardOp', op: { type: 'setCargo', playerID: world.playerID, slot: receiver.slot, commodity } });
    narrate(`${name} used the Roundhouse to hand ${commodityName(commodity)} to the ${slotLabel(receiver.slot)} engine in ${meet}.`);
    return runOne(next, next, receiver, effects, false);
  }

  for (const run of action.runs) {
    const error = runOne(next, next, run, effects, false);
    if (error) return error;
  }
  return null;
}

/**
 * Check and apply one engine's run. `from` is the world to check against (the start of this
 * run), `next` receives the changes. `handOver`: Roundhouse carrier, which keeps its load to the end.
 */
function runOne(from: BotWorld, next: BotWorld, run: EngineRun, effects: Effect[], handOver: boolean): string | null {
  const narrate = (line: string) => effects.push({ kind: 'narrate', line });
  const boardOp = (op: BoardOp) => effects.push({ kind: 'boardOp', op });
  const name = nameOf(from);
  const start = engineCities(from)[run.slot];
  const engine = engineTypes(from)[run.slot];
  if (!engine) return `the ${slotLabel(run.slot)} token has no engine`;
  // A Roundhouse receiver starts from the meeting city (already set in `next`).
  if (run.path[0] !== start && run.path[0] !== engineCities(next)[run.slot]) return 'the run must start where the engine is';
  if (run.path.length - 1 > engineReach(from, run.slot)) return `the ${engineName(engine)} can't move that far`;
  const pathError = checkPath(from, run.path);
  if (pathError) return pathError;

  const events = [...run.events].sort((a, b) => a.at - b.at);
  const initialLoad = cargo(next)[run.slot];
  let carrying = initialLoad;
  const timetable = hasUpgrade(from, 'timetable');
  const lines: string[] = [];
  let end = run.path[run.path.length - 1];
  for (const event of events) {
    if (event.at < 0 || event.at >= run.path.length) return 'a stop is off the path';
    const city = run.path[event.at];
    if (event.kind === 'pickup') {
      if (carrying !== null) return `the engine already carries ${carrying}`;
      if (!suppliesCommodity(next, city, event.commodity)) return `${city} doesn't supply ${event.commodity}`;
      if (event.claim) {
        const market = claimMarket(next, event.claim, event.commodity, effects);
        if (typeof market === 'string') return market;
        lines.push(`picked up ${commodityName(event.commodity)} in ${city} and claimed the market contract for ${contractLabel(market)}`);
      } else {
        lines.push(`picked up ${commodityName(event.commodity)} in ${city}`);
      }
      carrying = event.commodity;
    } else {
      const contract = deliverableContracts(next).find((c) => c.id === event.contractId);
      if (!contract) return 'that contract can’t be delivered by this bot';
      if (contract.destinationKey !== city) return `that contract is for ${contract.destinationKey}`;
      if (carrying !== contract.commodity) return `the engine doesn't carry ${contract.commodity}`;
      if (!timetable && event.at !== run.path.length - 1) return 'a delivery ends the move without a Timetable';
      const payment = deliveryPayment(contract, engine, hasUpgrade(from, 'upgraded-stations'));
      const service = debtServiceForDelivery(next.bot, city);
      const cashAfter = next.bot.cash + payment - service.service;
      if (cashAfter < 0) return 'that delivery would bankrupt the bot';
      next.bot.cash = cashAfter;
      next.bot.centralDebtServicePaid = service.centralDebtServicePaid;
      next.bot.westernDeliveryMade = service.westernDeliveryMade;
      next.bot.deliveries[contract.commodity] = (next.bot.deliveries[contract.commodity] ?? 0) + 1;
      contract.fulfilled = true;
      addActiveCity(next, city);
      carrying = null;
      effects.push({ kind: 'move', move: { name: 'toggleContractFulfilled', args: [contract.id] } });
      const paid = service.service > 0 ? `${money(payment)} less ${money(service.service)} debt service` : money(payment);
      lines.push(`delivered ${commodityName(contract.commodity)} to ${city} for ${paid}`);
      if (contract.type === 'private') {
        next.turnState.awaitingOffers = true;
        effects.push({ kind: 'requestOffers' });
      }
      if (!timetable) end = city;
    }
  }
  if (handOver && carrying === null) return 'the carrier has nothing to hand over';

  setEngineCity(next, run.slot, end);
  setCargoIn(next, run.slot, carrying);
  next.turnState.enginesRun.push(run.slot);
  boardOp({ type: 'moveEngine', playerID: from.playerID, slot: run.slot, city: end });
  if (initialLoad !== carrying) boardOp({ type: 'setCargo', playerID: from.playerID, slot: run.slot, commodity: carrying });
  const moved = run.path.length > 1 ? `ran the ${slotLabel(run.slot)} engine from ${run.path[0]} to ${end}` : `used the ${slotLabel(run.slot)} engine in ${end}`;
  narrate(`${name} ${list([moved, ...lines])}.`);
  return null;
}
