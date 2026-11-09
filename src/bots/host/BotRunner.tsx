/**
 * Host-side bot runner (docs/BOT_PLAN.md, Runner). Lazy-mounted by App.tsx in playtest builds
 * while a game is open. It does nothing unless this device is the host and the game has bots.
 *
 * M2: once the game leaves waiting_for_players, creates the bot_states row (one record per bot,
 * with its weights drawn and starting cash). Taking turns arrives in M4.
 */
import React from 'react';
import { useStorage } from '../../providers/StorageProvider';
import { useGameStore } from '../../stores/gameStore';
import type { PlayerSeat } from '../../utils/gameManager';
import { botSeatsByPlayerID } from '../state/botStates';
import { ensureBotStates } from '../state/botStatesSync';

export interface BotRunnerProps {
  gameCode: string;
}

export function BotRunner({ gameCode }: BotRunnerProps): null {
  const storage = useStorage();
  const phase = useGameStore((state) => state.ctx?.phase);
  const startedForCode = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!gameCode || !phase || phase === 'waiting_for_players') return;
    if (startedForCode.current === gameCode) return;
    startedForCode.current = gameCode;

    let cancelled = false;
    void (async () => {
      try {
        if (!(await storage.amIHost(gameCode))) return;
        const seats = ((await storage.getPlayerSeatsForGame(gameCode)) ?? {}) as Record<string, PlayerSeat>;
        if (cancelled || Object.keys(botSeatsByPlayerID(seats)).length === 0) return;
        await ensureBotStates(gameCode, seats);
      } catch (e) {
        console.error('[BotRunner] Could not set up bot state:', e);
        // Allow a retry on the next phase change or remount.
        if (startedForCode.current === gameCode) startedForCode.current = null;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gameCode, phase, storage]);

  return null;
}
