/**
 * Live bot_states for one game, read-only (docs/BOT_PLAN.md, Narration). A missing table or any
 * load error just means no narration: board errors stay local and never block the board.
 */
import React from 'react';
import { getBotStatesAdapter } from '../bots/state/botStatesAdapter';
import { normalizeBotStates, type BotStates } from '../bots/state/botStates';

/** How often to re-check whether a bot's runner has gone quiet. */
const CLOCK_MS = 5_000;

/**
 * Re-read bot_states this often as well as listening for realtime changes. Realtime can miss
 * updates: for example, when the board was opened before the table existed or before the game's
 * row was created, the subscription never delivers anything.
 */
let pollMs = 10_000;

/** For tests: how often to re-read bot_states. */
export function setBotNarrationPollMs(ms: number): void {
  pollMs = ms;
}

export function useBotNarration(code: string | null, enabled: boolean): { states: BotStates | null; now: number } {
  const [states, setStates] = React.useState<BotStates | null>(null);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (!code || !enabled) return;
    let cancelled = false;
    let latest = -Infinity;
    const accept = (raw: unknown, updatedAt: string) => {
      // Compare as times: realtime and queries may format updated_at differently.
      const time = Date.parse(updatedAt);
      if (cancelled || (!Number.isNaN(time) && time < latest)) return;
      if (!Number.isNaN(time)) latest = time;
      try {
        setStates(normalizeBotStates(raw));
      } catch (err) {
        console.warn('[board] Ignoring bot state:', err instanceof Error ? err.message : err);
      }
    };
    let unsubscribe = () => {};
    let timer: ReturnType<typeof setInterval> | null = null;
    try {
      const adapter = getBotStatesAdapter();
      unsubscribe = adapter.subscribe(code, (record) => accept(record.state, record.updatedAt));
      const load = () =>
        adapter
          .load(code)
          .then((record) => record && accept(record.state, record.updatedAt))
          .catch((err: unknown) => console.warn('[board] No bot narration yet:', err instanceof Error ? err.message : err));
      void load();
      timer = setInterval(() => void load(), pollMs);
    } catch (err) {
      console.warn('[board] No bot narration:', err instanceof Error ? err.message : err);
    }
    return () => {
      cancelled = true;
      unsubscribe();
      if (timer) clearInterval(timer);
    };
  }, [code, enabled]);

  React.useEffect(() => {
    if (!states || Object.keys(states.bots).length === 0) return;
    const timer = setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => clearInterval(timer);
  }, [states]);

  return { states, now };
}
