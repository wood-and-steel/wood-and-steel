/**
 * Live bot_states for one game, read-only (docs/BOT_PLAN.md, Narration). A missing table or any
 * load error just means no narration: board errors stay local and never block the board.
 */
import React from 'react';
import { getBotStatesAdapter } from '../bots/state/botStatesAdapter';
import { normalizeBotStates, type BotStates } from '../bots/state/botStates';

/** How often to re-check whether a bot's runner has gone quiet. */
const CLOCK_MS = 5_000;

export function useBotNarration(code: string | null, enabled: boolean): { states: BotStates | null; now: number } {
  const [states, setStates] = React.useState<BotStates | null>(null);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (!code || !enabled) return;
    let cancelled = false;
    let latest = '';
    const accept = (raw: unknown, updatedAt: string) => {
      if (cancelled || updatedAt < latest) return;
      latest = updatedAt;
      try {
        setStates(normalizeBotStates(raw));
      } catch (err) {
        console.info('[board] Ignoring bot state:', err instanceof Error ? err.message : err);
      }
    };
    let unsubscribe = () => {};
    try {
      const adapter = getBotStatesAdapter();
      unsubscribe = adapter.subscribe(code, (record) => accept(record.state, record.updatedAt));
      adapter
        .load(code)
        .then((record) => record && accept(record.state, record.updatedAt))
        .catch((err: unknown) => console.info('[board] No bot narration:', err instanceof Error ? err.message : err));
    } catch (err) {
      console.info('[board] No bot narration:', err instanceof Error ? err.message : err);
    }
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [code, enabled]);

  React.useEffect(() => {
    if (!states || Object.keys(states.bots).length === 0) return;
    const timer = setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => clearInterval(timer);
  }, [states]);

  return { states, now };
}
