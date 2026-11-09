/**
 * Choosing a new bot's name and strategy on the waiting screen (docs/BOT_PLAN.md, Seats).
 * Pure: randomness is passed in so tests are deterministic.
 */
import { BOT_NAMES } from './names';
import { STRATEGIES, isStrategyId, type StrategyId } from './heuristic/strategies';

/** Host's choice in the strategy select. */
export type StrategyChoice = StrategyId | 'random';

/** Returns a number in [0, 1), like Math.random. */
export type RandomFn = () => number;

/** The seat fields used here; matches both PlayerSeat and the waiting screen's PlayerSeatDisplay. */
interface SeatLike {
  playerName?: string | null;
  bot?: { name: string; strategy: string } | null;
}

const BOT_SUFFIX = /\s*\(bot\)\s*$/i;

function baseName(seat: SeatLike): string {
  const name = seat.bot?.name ?? seat.playerName ?? '';
  return name.replace(BOT_SUFFIX, '').trim().toLowerCase();
}

function pick<T>(items: readonly T[], random: RandomFn): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}

/** A name from BOT_NAMES that no seat already uses (case-insensitive, ignoring "(bot)"). */
export function pickBotName(seats: Record<string, SeatLike>, random: RandomFn = Math.random): string {
  const taken = new Set(Object.values(seats).map(baseName));
  const available = BOT_NAMES.filter((name) => !taken.has(name.toLowerCase()));
  if (available.length > 0) return pick(available, random);
  // Unreachable with five seats and 74 names; keep names unique anyway.
  const fallback = pick(BOT_NAMES, random);
  let n = 2;
  while (taken.has(`${fallback} ${n}`.toLowerCase())) n += 1;
  return `${fallback} ${n}`;
}

/**
 * The host's choice, or for 'random' a strategy no bot in the game has yet
 * (any strategy once all six are taken).
 */
export function resolveStrategy(
  choice: StrategyChoice,
  seats: Record<string, SeatLike>,
  random: RandomFn = Math.random
): StrategyId {
  if (choice !== 'random') return choice;
  const used = new Set(
    Object.values(seats)
      .map((seat) => seat.bot?.strategy)
      .filter(isStrategyId)
  );
  const unused = STRATEGIES.filter((s) => !used.has(s.id));
  return pick(unused.length > 0 ? unused : STRATEGIES, random).id;
}
