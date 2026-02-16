import { growIndependentRailroads } from '../independentRailroads';
import type { PhaseName } from './moveValidation';
import type { GameState, GameContext } from './gameStore';

/**
 * Phase configuration: phase structure, transitions, and hooks for turn/phase management.
 * Each phase has: next (phase to transition to), endIf (when phase ends), onEnd (phase-end hook), turn.onEnd (turn-end hook).
 */

/** Params passed to phase endIf/onEnd and turn onEnd hooks. */
interface PhaseParams {
  G: GameState;
  ctx: GameContext;
}

/** Turn config for a phase. */
interface PhaseTurnConfig {
  onEnd: ((params: PhaseParams) => void) | null;
}

/** Single phase config: next phase, endIf, onEnd, turn. */
interface PhaseConfigEntry {
  next: string;
  endIf?: (params: PhaseParams) => boolean;
  onEnd?: ((params: PhaseParams) => void) | null;
  turn: PhaseTurnConfig;
}

export const phaseConfig: Record<PhaseName, PhaseConfigEntry> = {
  // Phase 0: Waiting for Players (BYOD only). Players join; host starts the game. Hotseat skips this and starts in 'setup'.
  waiting_for_players: {
    next: 'setup',
    // End when host has started the game (G.byodGameStarted set after assignRandomPlayerIDs).
    endIf: ({ G }) => G.byodGameStarted === true,
    onEnd: ({ G, ctx }) => {
      console.log('[waiting_for_players] All players joined. Starting game setup.');
      console.log(`[waiting_for_players] Number of players: ${ctx.numPlayers}`);
    },
    turn: { onEnd: null },
  },

  // Phase 1: Setup. Each player chooses starting cities and gets a starting contract.
  setup: {
    next: 'play',
    // End when all players have at least one private contract.
    endIf: ({ G, ctx }) => {
      const playersWithContracts = new Set(
        G.contracts
          .filter((c) => c.playerID !== null)
          .map((c) => c.playerID as string)
      );
      return playersWithContracts.size >= ctx.numPlayers;
    },
    onEnd: () => {
      console.log('Setup phase complete. Starting main game.');
    },
    turn: { onEnd: null },
  },

  // Phase 2: Play. Main game with all normal actions
  play: {
    next: 'scoring',
    endIf: () => false,
    onEnd: null,
    turn: {
      // Increment turnsHeld for unfulfilled market contracts held by current player
      onEnd: ({ G, ctx }) => {
        G.contracts = G.contracts.map((c) =>
          c.type === 'market' && !c.fulfilled && c.playerID === ctx.currentPlayer
            ? { ...c, turnsHeld: (c.turnsHeld ?? 0) + 1 }
            : c
        );
        // End-of-round actions when last player's turn ends
        if (ctx.playOrderPos === ctx.playOrder.length - 1) {
          console.log(growIndependentRailroads(G));
        }
      },
    },
  },

  // Phase 3: Scoring. Stub for future implementation.
  scoring: {
    next: 'scoring', // Loops back to itself (end game)
    endIf: () => false,
    onEnd: null,
    turn: { onEnd: null },
  },
};

/**
 * Get phase configuration for a phase name.
 *
 * @param phaseName - Phase name ('waiting_for_players', 'setup', 'play', 'scoring')
 * @returns Phase config or undefined
 */
export function getPhaseConfig(phaseName: PhaseName | string): PhaseConfigEntry | undefined {
  return phaseConfig[phaseName as PhaseName];
}

/**
 * Run the phase's onEnd hook if defined.
 *
 * @param phaseName - Current phase name
 * @param G - Game state
 * @param ctx - Game context
 */
export function executePhaseOnEnd(
  phaseName: string,
  G: GameState,
  ctx: GameContext
): void {
  const config = getPhaseConfig(phaseName);
  if (config?.onEnd) {
    config.onEnd({ G, ctx });
  }
}

/**
 * Run the phase's turn.onEnd hook if defined (e.g. end-of-round logic).
 *
 * @param phaseName - Current phase name
 * @param G - Game state
 * @param ctx - Game context
 */
export function executeTurnOnEnd(
  phaseName: string,
  G: GameState,
  ctx: GameContext
): void {
  const config = getPhaseConfig(phaseName);
  if (config?.turn?.onEnd) {
    config.turn.onEnd({ G, ctx });
  }
}
