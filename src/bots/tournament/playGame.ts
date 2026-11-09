/**
 * One headless bot-only game (docs/BOT_PLAN.md, Tournament): every seat is a bot, playing through
 * the real runner, heuristic, moves, and store, until someone reaches 30 fulfillment ties or the
 * round limit. Math.random (contract offers, independent railroads) is seeded per game.
 */
import { railroadTieValue } from '../../Contract';
import { initializeIndependentRailroads } from '../../independentRailroads';
import { generateMarketContract, endTurn } from '../../stores/gameActions';
import { useGameStore, type GameState } from '../../stores/gameStore';
import { getPlayerAvatarColorForIndex } from '../../utils/playerAvatar';
import { GAME_END_TIES } from '../engine/rulesData';
import { tieBreakdown } from '../engine/scoring';
import { buildWorld, engineLevel, type BotWorld } from '../engine/world';
import { heuristicPolicy } from '../heuristic/policy';
import type { StrategyId } from '../heuristic/strategies';
import type { Policy } from '../policy';
import { createRng } from '../rng';
import { runBotTurn } from '../runner/runTurn';
import { createBotRecord, emptyBotStates, type BotStates } from '../state/botStates';
import { BOT_NAMES } from '../names';
import { createMemoryPorts } from './memoryPorts';

export interface GameOptions {
  strategies: StrategyId[];
  seed: number;
  maxRounds?: number;
  /** Market contracts put on the table when play starts. */
  markets?: number;
  policy?: Policy;
}

export interface SeatResult {
  playerID: string;
  strategy: StrategyId;
  /** Final ties including end-of-game bonuses. */
  ties: number;
  fulfillmentTies: number;
  deliveries: number;
  cash: number;
  debt: number;
  bestEngine: string | null;
  upgrades: string[];
  hub: boolean;
  railyard: boolean;
  regionalOffice: boolean;
  exchange: boolean;
  routes: number;
  acquisitions: number;
  borrows: number;
  redraws: number;
  /** Turns in which the bot did nothing. */
  idleTurns: number;
  /** Turns that failed (the runner threw) and were ended for it. */
  errors: number;
  won: boolean;
}

export interface GameResult {
  seed: number;
  rounds: number;
  /** Someone reached 30 fulfillment ties (otherwise the round limit ended it). */
  finished: boolean;
  seats: SeatResult[];
}

function fulfillmentTiesOf(G: GameState, playerID: string): number {
  return G.contracts.filter((c) => c.playerID === playerID && c.fulfilled).reduce((s, c) => s + railroadTieValue(c), 0);
}

export async function playGame({ strategies, seed, maxRounds = 80, markets = 3, policy = heuristicPolicy }: GameOptions): Promise<GameResult> {
  const random = createRng(seed);
  const realRandom = Math.random;
  Math.random = () => random.next();
  try {
    const n = strategies.length;
    const ids = strategies.map((_, i) => String(i));
    const order = [...ids].sort(() => random.next() - 0.5);
    const names = [...BOT_NAMES].sort(() => random.next() - 0.5).slice(0, n);

    useGameStore.getState().resetState(n);
    useGameStore.setState({
      G: {
        contracts: [],
        players: ids.map((id, i) => [
          id,
          { name: `${names[i]} (bot)`, activeCities: [], hubCity: null, regionalOffice: null, avatarColor: getPlayerAvatarColorForIndex(i) },
        ]),
        independentRailroads: initializeIndependentRailroads(),
        byodGameStarted: true,
      },
      ctx: { phase: 'setup', currentPlayer: order[0], numPlayers: n, playOrder: order, playOrderPos: 0, turn: 0, round: 0 },
    });

    const states: BotStates = emptyBotStates();
    ids.forEach((id, i) => {
      states.bots[id] = createBotRecord({ name: names[i], strategy: strategies[i] }, (seed * 31 + i * 7919) >>> 0);
    });
    const ports = createMemoryPorts(states);

    // Tally every decision (the bot's own log keeps only its last 20 turns).
    const tally: Record<string, Record<string, number>> = Object.fromEntries(ids.map((id) => [id, {}]));
    const idle: Record<string, number> = {};
    let acted = false;
    const counting: Policy = (world, rng) => {
      const decision = policy(world, rng);
      const type = decision.action.type;
      const counts = tally[world.playerID];
      counts[type] = (counts[type] ?? 0) + 1;
      if (type !== 'endTurn') acted = true;
      return decision;
    };

    let marketsPlaced = false;
    const errors: Record<string, number> = {};
    const maxTurns = maxRounds * n + n;
    for (let t = 0; t < maxTurns; t++) {
      const { ctx, G } = useGameStore.getState();
      if (ctx.phase === 'play' && !marketsPlaced) {
        for (let m = 0; m < markets; m++) generateMarketContract();
        marketsPlaced = true;
      }
      if (ids.some((id) => fulfillmentTiesOf(G, id) >= GAME_END_TIES)) break;
      const player = ctx.currentPlayer;
      acted = false;
      try {
        await runBotTurn({ playerID: player, ports, policy: counting, paceMs: 0 });
        if (!acted && ctx.phase === 'play') idle[player] = (idle[player] ?? 0) + 1;
      } catch (e) {
        errors[player] = (errors[player] ?? 0) + 1;
        if (useGameStore.getState().ctx.currentPlayer === player) endTurn();
        if (errors[player] === 1) console.error(`[tournament] seed ${seed}, player ${player}:`, e instanceof Error ? e.message : e);
      }
    }

    const { G, ctx } = useGameStore.getState();
    const finished = ids.some((id) => fulfillmentTiesOf(G, id) >= GAME_END_TIES);
    const board = ports.boardState();
    const records = ports.botStates().bots;
    const seats: SeatResult[] = ids.map((id, i) => {
      const record = records[id];
      const world: BotWorld = buildWorld({ G, ctx, board, bot: record, playerID: id });
      const types = (board?.engineTypes[id] ?? ['john-bull', null]).filter((t): t is NonNullable<typeof t> => t !== null);
      const best = types.sort((a, b) => engineLevel(b) - engineLevel(a))[0] ?? null;
      const props = G.players.find(([pid]) => pid === id)![1];
      return {
        playerID: id,
        strategy: strategies[i],
        ties: tieBreakdown(world).total,
        fulfillmentTies: fulfillmentTiesOf(G, id),
        deliveries: G.contracts.filter((c) => c.playerID === id && c.fulfilled).length,
        cash: record.cash,
        debt: record.debt,
        bestEngine: best,
        upgrades: board?.upgrades[id] ?? [],
        hub: props.hubCity !== null,
        railyard: !!board?.railyards[id],
        regionalOffice: props.regionalOffice !== null,
        exchange: record.exchangeCommodity !== null,
        routes: Object.values(board?.track ?? {}).filter((o) => o.includes(id)).length,
        acquisitions: tally[id].acquireRailroad ?? 0,
        borrows: tally[id].borrow ?? 0,
        redraws: tally[id].redrawPrivateContract ?? 0,
        idleTurns: idle[id] ?? 0,
        errors: errors[id] ?? 0,
        won: false,
      };
    });
    const top = Math.max(...seats.map((s) => s.ties));
    const winners = seats.filter((s) => s.ties === top);
    // Ties split the win; break exact ties by fulfillment ties.
    const bestFulfillment = Math.max(...winners.map((s) => s.fulfillmentTies));
    for (const s of winners) s.won = s.fulfillmentTies === bestFulfillment;
    return { seed, rounds: ctx.round ?? 0, finished, seats };
  } finally {
    Math.random = realRandom;
  }
}
