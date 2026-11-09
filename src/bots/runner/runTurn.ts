/**
 * Plays one bot's turn through the ports (docs/BOT_PLAN.md, Runner). Each action is chosen by
 * the policy, checked by the engine, recorded in bot_states with its effects (`pending`), then
 * carried out: app moves, board ops, and narration. After a reload the pending effects are
 * re-run, skipping moves G already shows, so nothing is done twice.
 */
import { applyAction, listActions, needsPrivateContract, setOffers, type Action, type Effect } from '../engine/actions';
import { buildWorld } from '../engine/world';
import { createRng } from '../rng';
import { MAX_LOG_TURNS, type BotRecord, type BotStates, type TurnInProgress } from '../state/botStates';
import type { BotPorts } from '../ports';
import { basicPolicy, type Policy } from './basicPolicy';
import { isMoveDone, stepKey, turnStateFromSteps } from './steps';

export type TurnOutcome =
  /** The bot finished its turn (ended it, or chose starting cities). */
  | 'done'
  /** It isn't this bot's turn (or the phase has no bot turns). */
  | 'not-my-turn'
  /** shouldStop() said to stop, e.g. the runner was unmounted. */
  | 'stopped';

export interface RunTurnOptions {
  playerID: string;
  ports: BotPorts;
  policy?: Policy;
  /** Pause between actions so people can follow along (ms). */
  paceMs?: number;
  shouldStop?: () => boolean;
  /** Safety limit on actions in one turn; the bot ends its turn when reached. */
  maxSteps?: number;
}

const BOT_PHASES = new Set(['setup', 'play']);

interface TurnId {
  turn: number;
  playOrderPos: number;
  round: number;
}

function currentTurn(ports: BotPorts, playerID: string): TurnId | null {
  const { ctx } = ports.game.getState();
  if (ctx.currentPlayer !== playerID || !BOT_PHASES.has(ctx.phase)) return null;
  return { turn: ctx.turn, playOrderPos: ctx.playOrderPos, round: ctx.round ?? 0 };
}

function sameTurn(a: TurnId | null, b: Pick<TurnInProgress, 'turn' | 'playOrderPos'> | null): boolean {
  return !!a && !!b && a.turn === b.turn && a.playOrderPos === b.playOrderPos;
}

/** Change one bot's record (re-appliable). */
function withRecord(states: BotStates, playerID: string, change: (record: BotRecord) => BotRecord): BotStates {
  const record = states.bots[playerID];
  if (!record) return states;
  return { ...states, bots: { ...states.bots, [playerID]: change(structuredClone(record)) } };
}

/** Add narration lines to this turn's log entry, starting the entry if needed. */
function appendLog(record: BotRecord, id: TurnId, lines: string[]): BotRecord {
  const log = [...record.log];
  const last = log[log.length - 1];
  if (last && last.turn === id.turn && last.round === id.round) {
    log[log.length - 1] = { ...last, lines: [...last.lines, ...lines] };
  } else {
    log.push({ round: id.round, turn: id.turn, lines });
  }
  return { ...record, log: log.slice(-MAX_LOG_TURNS) };
}

/** Carry out effects in order, skipping moves already reflected in G. Returns the narration lines. */
async function runEffects(ports: BotPorts, playerID: string, id: TurnId, effects: Effect[]): Promise<string[]> {
  const lines: string[] = [];
  for (const effect of effects) {
    switch (effect.kind) {
      case 'move': {
        const { G, ctx } = ports.game.getState();
        if (!isMoveDone(effect.move, G, ctx, playerID, id)) await ports.game.applyMove(effect.move);
        break;
      }
      case 'boardOp':
        await ports.board.apply(effect.op);
        break;
      case 'narrate':
        lines.push(effect.line);
        break;
      case 'requestOffers':
        // The loop fetches offers whenever the bot has no private contract.
        break;
    }
  }
  return lines;
}

/** Finish the pending action: save its narration and clear `pending` in one write. */
async function finishPending(ports: BotPorts, playerID: string, id: TurnId, lines: string[], turnOver: boolean): Promise<BotRecord> {
  const states = await ports.bots.update((s) =>
    withRecord(s, playerID, (r) => ({
      ...appendLog(r, id, lines),
      turnInProgress: turnOver || !r.turnInProgress ? null : { ...r.turnInProgress, pending: null },
    }))
  );
  return states.bots[playerID];
}

function endsTurn(effects: Effect[]): boolean {
  return effects.some((e) => e.kind === 'move' && (e.move.name === 'endTurn' || e.move.name === 'generateStartingContract'));
}

export async function runBotTurn({
  playerID,
  ports,
  policy = basicPolicy,
  paceMs = 1500,
  shouldStop = () => false,
  maxSteps = 40,
}: RunTurnOptions): Promise<TurnOutcome> {
  const id = currentTurn(ports, playerID);
  if (!id) return 'not-my-turn';

  const stored = await ports.bots.load();
  let record = stored?.bots[playerID];
  if (!record) throw new Error(`No bot record for player ${playerID}.`);

  // Resume an action a reload interrupted, or start this turn's bookkeeping.
  if (sameTurn(id, record.turnInProgress) && record.turnInProgress!.pending) {
    const { effects } = record.turnInProgress!.pending;
    const lines = await runEffects(ports, playerID, id, effects);
    record = await finishPending(ports, playerID, id, lines, endsTurn(effects));
    if (endsTurn(effects)) return 'done';
  } else if (!sameTurn(id, record.turnInProgress)) {
    const states = await ports.bots.update((s) =>
      withRecord(s, playerID, (r) => ({
        ...r,
        turnInProgress: { turn: id.turn, playOrderPos: id.playOrderPos, steps: [], pending: null },
      }))
    );
    record = states.bots[playerID];
  }

  for (let step = 0; ; step++) {
    if (shouldStop()) return 'stopped';
    if (!sameTurn(currentTurn(ports, playerID), id)) return 'done';

    const { G, ctx } = ports.game.getState();
    let world = buildWorld({
      G,
      ctx,
      board: await ports.board.load(),
      bot: record,
      playerID,
      turnState: turnStateFromSteps(record.turnInProgress?.steps ?? []),
    });
    if (needsPrivateContract(world)) {
      // If generation fails (no offers), the bot plays on without a private contract.
      const offers = ports.game.privateContractOffers();
      if (offers.length > 0) world = setOffers(world, offers);
    }

    const rng = createRng(record.rngState);
    const actions = listActions(world);
    let action: Action =
      step >= maxSteps || actions.length === 0 ? { type: 'endTurn' } : policy(world, actions, rng);
    let result = applyAction(world, action);
    if (!result.ok) {
      console.error(`[runBotTurn] ${record.name}: ${result.error}; ending the turn.`, action);
      action = { type: 'endTurn' };
      result = applyAction(world, action);
      if (!result.ok) throw new Error(`${record.name} can't end the turn: ${result.error}`);
    }
    const { effects, world: predicted } = result;
    const key = stepKey(action);

    // Record the action and its effects before carrying them out.
    const states = await ports.bots.update((s) =>
      withRecord(s, playerID, (r) => ({
        ...r,
        cash: predicted.bot.cash,
        debt: predicted.bot.debt,
        centralDebtServicePaid: predicted.bot.centralDebtServicePaid,
        westernDeliveryMade: predicted.bot.westernDeliveryMade,
        deliveries: predicted.bot.deliveries,
        exchangeCommodity: predicted.bot.exchangeCommodity,
        rngState: rng.state(),
        turnInProgress: {
          turn: id.turn,
          playOrderPos: id.playOrderPos,
          steps: [...(r.turnInProgress?.steps ?? []), key],
          pending: { step: key, effects },
        },
      }))
    );
    record = states.bots[playerID];

    const lines = await runEffects(ports, playerID, id, effects);
    const over = endsTurn(effects);
    record = await finishPending(ports, playerID, id, lines, over);
    if (over) return 'done';
    if (lines.length > 0 && paceMs > 0) await ports.clock.sleep(paceMs);
  }
}
