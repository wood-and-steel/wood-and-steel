/**
 * Plays bot "0" for many rounds through the real runner, moves, and store, against a stand-in
 * human who only ends turns, once per strategy. Checks that bots keep making legal progress.
 */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { STARTING_CITY_PAIRS } from '../../data/startingRoutes';
import { initializeIndependentRailroads } from '../../independentRailroads';
import { endTurn, generateMarketContract, generateStartingContract } from '../../stores/gameActions';
import { useGameStore } from '../../stores/gameStore';
import { saveGameState } from '../../utils/gameManager';
import { createRng } from '../rng';
import { runBotTurn } from '../runner/runTurn';
import { setUpHostGame } from '../runner/hostGame.testHelper';
import { normalizeBotStates } from '../state/botStates';
import { fulfillmentTies } from '../engine/scoring';
import { buildWorld } from '../engine/world';
import { STRATEGIES, type StrategyId } from './strategies';
import { drawWeights } from './weights';
import { EMERGENCY_DEBT, heuristicPolicy } from './policy';
import { params } from './params';

afterEach(() => {
  vi.restoreAllMocks();
});

async function playGame(strategy: StrategyId, rounds: number, seed = 11) {
  // Contract offers and independent railroads use Math.random; seed it so each game is reproducible.
  const random = createRng(seed);
  vi.spyOn(Math, 'random').mockImplementation(() => random.next());
  const game = await setUpHostGame({ phase: 'setup' });
  useGameStore.setState((s) => ({ G: { ...s.G, independentRailroads: initializeIndependentRailroads() } }));
  const { G, ctx } = useGameStore.getState();
  await saveGameState(game.code, G, ctx);
  const states = normalizeBotStates(game.botAdapter.rows.get(game.code)!.state);
  states.bots['0'] = { ...states.bots['0'], strategy, weights: drawWeights(strategy, createRng(7)) };
  game.botAdapter.write(game.code, states);

  const outcomes: string[] = [];
  let marketsMade = false;
  for (let i = 0; i < rounds * 2; i++) {
    const { ctx: c, G: g } = useGameStore.getState();
    if (c.currentPlayer === '0') {
      outcomes.push(await runBotTurn({ playerID: '0', ports: game.ports, policy: heuristicPolicy, paceMs: 0 }));
    } else if (c.phase === 'setup') {
      const taken = new Set(g.players.flatMap(([, p]) => p.activeCities));
      const pair = STARTING_CITY_PAIRS.find(([a, b]) => !taken.has(a) && !taken.has(b))!;
      generateStartingContract([pair[0], pair[1]], '1');
    } else {
      if (!marketsMade) {
        generateMarketContract();
        generateMarketContract();
        marketsMade = true;
      }
      endTurn();
    }
  }
  const record = normalizeBotStates(game.botAdapter.rows.get(game.code)!.state).bots['0'];
  const { G: endG, ctx: endCtx } = useGameStore.getState();
  const world = buildWorld({ G: endG, ctx: endCtx, board: game.boardAdapter.rows.get(game.code)?.state ?? null, bot: record, playerID: '0' });
  return { record, outcomes, world };
}

describe('heuristic playthrough', () => {
  test.each(STRATEGIES.map((s) => s.id))(
    '%s plays 20 rounds legally and delivers',
    async (strategy) => {
      const { record, outcomes, world } = await playGame(strategy, 20);
      expect(outcomes.every((o) => o === 'done')).toBe(true);
      expect(record.cash).toBeGreaterThanOrEqual(0);
      // Bots may borrow past their limit only to deliver cargo already aboard.
      expect(record.debt).toBeLessThanOrEqual(params(world).maxDebt + EMERGENCY_DEBT);
      expect(fulfillmentTies(world)).toBeGreaterThan(0);
      const lines = record.log.flatMap((l) => l.lines);
      // Set BOT_LOG=1 to see each strategy's results and last moves (BOT_LOG_ALL=1 for every move).
      if (process.env.BOT_LOG || process.env.BOT_LOG_ALL) console.log(
        `${strategy}: ties ${fulfillmentTies(world)}, cash ${record.cash}, debt ${record.debt}, engines ${JSON.stringify(world.board.engineTypes['0'])}, ` +
          `upgrades ${JSON.stringify(world.board.upgrades['0'] ?? [])}, routes ${Object.values(world.board.track).filter((o) => o.includes('0')).length}, ` +
          `hub ${world.players[0][1].hubCity}, railyard ${world.board.railyards['0'] ?? null}, office ${world.players[0][1].regionalOffice}, ` +
          `acquired ${lines.filter((l) => l.includes(' acquired ')).length}, borrowed ${lines.filter((l) => l.includes(' borrowed ')).length}, redrew ${lines.filter((l) => l.includes(' discarded ')).length}\n  ` +
          lines.slice(process.env.BOT_LOG_ALL ? 0 : -8).join('\n  ')
      );
    },
    60000
  );
});
