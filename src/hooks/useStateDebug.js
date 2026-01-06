import { useEffect } from 'react';
import { useGameStore } from '../stores/gameStore';
import { logStateComparison } from '../utils/stateDebug';

/**
 * Debug hook to compare Zustand store with bgio state
 * Logs comparison results to console whenever state changes
 * 
 * @param {Object} G - Game state from bgio Client
 * @param {Object} ctx - Context from bgio Client
 * @param {boolean} enabled - Whether debug logging is enabled (default: false)
 */
export function useStateDebug(G, ctx, enabled = false) {
  const zustandState = useGameStore();

  useEffect(() => {
    if (!enabled || !G || !ctx) {
      return;
    }

    // Log comparison whenever bgio state changes
    logStateComparison(G, ctx);
  }, [G, ctx, enabled]);

  return zustandState;
}
