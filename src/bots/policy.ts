/**
 * A policy decides a bot's next action (docs/BOT_PLAN.md, Heuristic player). It builds its own
 * candidates from the engine (listActions is too slow to call for every decision), and may
 * update the bot's multi-turn plan, which is saved with the action.
 */
import type { Action } from './engine/actions';
import type { BotWorld } from './engine/world';
import type { Rng } from './rng';
import type { BotPlan } from './state/botStates';

export interface PolicyDecision {
  action: Action;
  /** The bot's plan after this decision; undefined keeps the current one, null clears it. */
  plan?: BotPlan | null;
}

export type Policy = (world: BotWorld, rng: Rng) => PolicyDecision;
