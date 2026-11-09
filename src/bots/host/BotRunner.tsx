/**
 * Host-side bot runner (docs/BOT_PLAN.md, Runner). Lazy-mounted by App.tsx in playtest builds
 * while a game is open. It does nothing unless this device is the host and the game has bots.
 *
 * Once the game leaves waiting_for_players it creates the bot_states row, then plays each bot's
 * turn when the bot becomes the current player, one turn at a time. While mounted it updates
 * each bot's heartbeat so board screens can tell when the host's app isn't running.
 */
import React from 'react';
import { useStorage } from '../../providers/StorageProvider';
import { useGameStore } from '../../stores/gameStore';
import type { PlayerSeat } from '../../utils/gameManager';
import type { Policy } from '../policy';
import { runBotTurn } from '../runner/runTurn';
import type { BotPorts } from '../ports';
import { botSeatsByPlayerID, type BotStates } from '../state/botStates';
import { ensureBotStates } from '../state/botStatesSync';
import { getBotStatesAdapter } from '../state/botStatesAdapter';
import { createHostPorts } from './hostPorts';

export const HEARTBEAT_MS = 10_000;
const RETRY_MS = 5_000;
const BOT_PHASES = new Set(['setup', 'play']);

export interface BotRunnerProps {
  gameCode: string;
  /** Pause between a bot's actions (ms). */
  paceMs?: number;
  /** For tests: ports and policy other than the host defaults. */
  ports?: BotPorts;
  policy?: Policy;
}

export function BotRunner({ gameCode, paceMs = 1500, ports: portsOverride, policy }: BotRunnerProps): null {
  const storage = useStorage();
  const phase = useGameStore((state) => state.ctx?.phase);
  const currentPlayer = useGameStore((state) => state.ctx?.currentPlayer);
  const [botIDs, setBotIDs] = React.useState<string[] | null>(null);
  const [tick, setTick] = React.useState(0);
  const running = React.useRef(false);
  const unmounted = React.useRef(false);
  const setupFor = React.useRef<string | null>(null);

  const ports = React.useMemo(() => portsOverride ?? createHostPorts(gameCode), [portsOverride, gameCode]);

  React.useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
    };
  }, []);

  // Set up bot state once the game has started (host only).
  React.useEffect(() => {
    if (!gameCode || !phase || phase === 'waiting_for_players') return;
    if (setupFor.current === gameCode) return;
    setupFor.current = gameCode;

    let cancelled = false;
    void (async () => {
      try {
        if (!(await storage.amIHost(gameCode))) return;
        const seats = ((await storage.getPlayerSeatsForGame(gameCode)) ?? {}) as Record<string, PlayerSeat>;
        const bots = Object.keys(botSeatsByPlayerID(seats));
        if (cancelled || bots.length === 0) return;
        await ensureBotStates(gameCode, seats, { adapter: getBotStatesAdapter() });
        if (!cancelled) setBotIDs(bots);
      } catch (e) {
        console.error('[BotRunner] Could not set up bot state:', e);
        // Allow a retry on the next phase change or remount.
        if (setupFor.current === gameCode) setupFor.current = null;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gameCode, phase, storage]);

  // Play the current bot's turn.
  React.useEffect(() => {
    if (!botIDs || !phase || !BOT_PHASES.has(phase) || !currentPlayer || !botIDs.includes(currentPlayer)) return;
    if (running.current) return;
    running.current = true;
    void (async () => {
      let retry = false;
      try {
        await runBotTurn({ playerID: currentPlayer, ports, policy, paceMs, shouldStop: () => unmounted.current });
      } catch (e) {
        console.error('[BotRunner] Bot turn failed; retrying shortly:', e);
        retry = true;
      } finally {
        running.current = false;
      }
      if (unmounted.current) return;
      if (retry) await ports.clock.sleep(RETRY_MS);
      // Re-check: the next player may be a bot too, and the store may have changed while we ran.
      if (!unmounted.current) setTick((t: number) => t + 1);
    })();
  }, [botIDs, phase, currentPlayer, tick, ports, policy, paceMs]);

  // Heartbeat, so board screens can show when the host's app isn't running the bots.
  React.useEffect(() => {
    if (!botIDs) return;
    const beat = () => {
      const now = ports.clock.now();
      ports.bots
        .update((states: BotStates) => {
          const bots = { ...states.bots };
          for (const id of botIDs) if (bots[id]) bots[id] = { ...bots[id], runnerSeenAt: now };
          return { ...states, bots };
        })
        .catch((e: unknown) => console.error('[BotRunner] Heartbeat failed:', e));
    };
    beat();
    const interval = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, [botIDs, ports]);

  return null;
}
