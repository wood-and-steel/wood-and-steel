/**
 * Read-modify-write for bot_states with conditional saves: on conflict the fresh row is
 * loaded, the same change is applied to it again, and the save is retried. Changes must
 * therefore be re-appliable, like board ops.
 */
import type { PlayerSeat } from '../../utils/gameManager';
import { addMissingBots, emptyBotStates, normalizeBotStates, type BotStates } from './botStates';
import { getBotStatesAdapter, type BotStatesAdapter } from './botStatesAdapter';

export const MAX_SAVE_ATTEMPTS = 5;

export interface SavedBotStates {
  states: BotStates;
  updatedAt: string;
}

export interface UpdateOptions {
  adapter?: BotStatesAdapter;
  /** Create the row (starting from empty) if it doesn't exist; otherwise a missing row is an error. */
  createIfMissing?: boolean;
}

/** Load and normalize the row, or null if there is none. */
export async function loadBotStates(
  code: string,
  adapter: BotStatesAdapter = getBotStatesAdapter()
): Promise<SavedBotStates | null> {
  const record = await adapter.load(code);
  return record ? { states: normalizeBotStates(record.state), updatedAt: record.updatedAt } : null;
}

/**
 * Apply `change` to the current row and save it. A change that returns its input unchanged
 * (same object) skips the save. Throws after MAX_SAVE_ATTEMPTS conflicts.
 */
export async function updateBotStates(
  code: string,
  change: (states: BotStates) => BotStates,
  { adapter = getBotStatesAdapter(), createIfMissing = false }: UpdateOptions = {}
): Promise<SavedBotStates> {
  for (let attempt = 0; attempt < MAX_SAVE_ATTEMPTS; attempt++) {
    const current = await loadBotStates(code, adapter);
    if (!current && !createIfMissing) throw new Error(`No bot state for game ${code}.`);
    const before = current?.states ?? emptyBotStates();
    const after = change(before);
    if (current && after === before) return current;
    const result = await adapter.save(code, after, current?.updatedAt ?? null);
    if (result.ok) return { states: after, updatedAt: result.updatedAt };
  }
  throw new Error(`Could not save bot state for game ${code} after ${MAX_SAVE_ATTEMPTS} attempts.`);
}

/**
 * Create the game's bot_states row, or add records for bots it lacks. Called by the host's
 * runner once the game has left waiting_for_players (bot seats have playerIDs by then).
 */
export async function ensureBotStates(
  code: string,
  seats: Record<string, PlayerSeat>,
  options: { adapter?: BotStatesAdapter; seed?: () => number } = {}
): Promise<SavedBotStates> {
  return updateBotStates(code, (states) => addMissingBots(states, seats, options.seed), {
    adapter: options.adapter,
    createIfMissing: true,
  });
}
