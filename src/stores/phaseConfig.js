import { growIndependentRailroads } from '../independentRailroads';

/**
 * Phase configuration that defines phase structure, transitions, and hooks for turn/phase management
 */

/**
 * Phase configuration object
 * Each phase has:
 * - next: Name of next phase to transition to
 * - endIf: Function that returns true when phase should end
 * - onEnd: Hook called when phase ends
 * - turn.onEnd: Hook called at end of turn (for round-end logic)
 */
export const phaseConfig = {
  // Phase 1: Setup - Each player chooses starting cities and gets a starting contract
  setup: {
    next: 'play',
    
    /**
     * End setup phase when all players have a private contract
     * @param {Object} params
     * @param {Object} params.G - Game state
     * @param {Object} params.ctx - Game context
     * @returns {boolean} True if phase should end
     */
    endIf: ({ G, ctx }) => {
      // Count how many players have at least one private contract
      const playersWithContracts = new Set(
        G.contracts
          .filter(c => c.playerID !== null)
          .map(c => c.playerID)
      );
      return playersWithContracts.size >= ctx.numPlayers;
    },
    
    /**
     * Hook called when setup phase ends
     * @param {Object} params
     * @param {Object} params.G - Game state
     * @param {Object} params.ctx - Game context
     */
    onEnd: ({ G }) => {
      console.log('Setup phase complete. Starting main game.');
    },
    
    turn: {
      // No turn onEnd hook for setup phase
      onEnd: null
    }
  },

  // Phase 2: Play - Main game with all normal actions
  play: {
    next: 'scoring',
    
    /**
     * No automatic end condition yet - game continues indefinitely
     * @param {Object} params
     * @param {Object} params.G - Game state
     * @param {Object} params.ctx - Game context
     * @returns {boolean} Always returns false (phase never ends automatically)
     */
    endIf: ({ G, ctx }) => {
      return false;
    },
    
    /**
     * Hook called when play phase ends (not currently used)
     * @param {Object} params
     * @param {Object} params.G - Game state
     * @param {Object} params.ctx - Game context
     */
    onEnd: null,
    
    turn: {
      /**
       * Hook called at end of turn in play phase
       * Executes end-of-round actions (e.g., growIndependentRailroads) if this is the last player's turn
       * @param {Object} params
       * @param {Object} params.G - Game state
       * @param {Object} params.ctx - Game context
       */
      onEnd: ({ G, ctx }) => {
        // Do end of round actions if this is the end of the last player's turn
        if (ctx.playOrderPos === ctx.playOrder.length - 1) {
          console.log(growIndependentRailroads(G));
        }
      }
    }
  },

  // Phase 3: Scoring - Stub for future implementation
  scoring: {
    next: 'scoring', // Loops back to itself (end game)
    
    /**
     * End condition for scoring phase (not yet implemented)
     * @param {Object} params
     * @param {Object} params.G - Game state
     * @param {Object} params.ctx - Game context
     * @returns {boolean} Always returns false (stub)
     */
    endIf: ({ G, ctx }) => {
      return false;
    },
    
    /**
     * Hook called when scoring phase begins (not currently used)
     * @param {Object} params
     * @param {Object} params.G - Game state
     * @param {Object} params.ctx - Game context
     */
    onEnd: null,
    
    turn: {
      // No turn onEnd hook for scoring phase
      onEnd: null
    }
  }
};

/**
 * Get phase configuration for a given phase name
 * @param {string} phaseName - Name of the phase ('setup', 'play', 'scoring')
 * @returns {Object|undefined} Phase configuration object or undefined if not found
 */
export function getPhaseConfig(phaseName) {
  return phaseConfig[phaseName];
}

/**
 * Execute phase onEnd hook if defined
 * @param {string} phaseName - Name of the phase
 * @param {Object} G - Game state
 * @param {Object} ctx - Game context
 */
export function executePhaseOnEnd(phaseName, G, ctx) {
  const config = getPhaseConfig(phaseName);
  if (config && config.onEnd) {
    config.onEnd({ G, ctx });
  }
}

/**
 * Execute turn onEnd hook for a phase if defined
 * @param {string} phaseName - Name of the phase
 * @param {Object} G - Game state
 * @param {Object} ctx - Game context
 */
export function executeTurnOnEnd(phaseName, G, ctx) {
  const config = getPhaseConfig(phaseName);
  if (config && config.turn && config.turn.onEnd) {
    config.turn.onEnd({ G, ctx });
  }
}
