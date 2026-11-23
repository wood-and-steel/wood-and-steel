/**
 * What a bot's tray card shows (docs/BOT_PLAN.md, Narration): its latest turn's narration, and a
 * notice when it's the bot's turn but the host's app hasn't been running it lately. Read-only:
 * the board only reads bot_states.
 */
import type { GameContext } from '../stores/gameStore';
import type { BotStates } from '../bots/state/botStates';

/** The host's runner writes a heartbeat every 10 seconds; older than this means it isn't running. */
export const RUNNER_STALE_MS = 30_000;

const BOT_PHASES = new Set(['setup', 'play']);

export interface BotTrayInfo {
  /** The bot has played at least one turn. */
  played: boolean;
  /** Its latest turn's narration (the current turn while it plays). */
  lines: string[];
  /** It's the bot's turn but the host's app isn't running it. */
  waiting: boolean;
}

/** Dollars in thousands, e.g. 13000 → "$13k", -2000 → "-$2k". */
export function formatThousands(amount: number): string {
  const k = Math.abs(amount) / 1000;
  return `${amount < 0 && k > 0 ? '-' : ''}$${k}k`;
}

/** A player's money for their tray header, e.g. "$13k ($15k)" with the debt in parentheses; debt only when they have some. */
export function formatMoney({ cash, debt }: { cash: number; debt: number }): string {
  return debt > 0 ? `${formatThousands(cash)} (${formatThousands(debt)})` : formatThousands(cash);
}

/** Tray info for every bot in bot_states, by playerID. */
export function botTrayInfo(states: BotStates | null, ctx: GameContext, now: number): Record<string, BotTrayInfo> {
  const info: Record<string, BotTrayInfo> = {};
  for (const [playerID, record] of Object.entries(states?.bots ?? {})) {
    const current = ctx.currentPlayer === playerID && BOT_PHASES.has(ctx.phase);
    const last = record.log[record.log.length - 1];
    const seen = record.runnerSeenAt ? Date.parse(record.runnerSeenAt) : NaN;
    info[playerID] = {
      played: !!last,
      lines: last?.lines ?? [],
      waiting: current && (Number.isNaN(seen) || now - seen > RUNNER_STALE_MS),
    };
  }
  return info;
}
