import { useEffect, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';

/**
 * Custom hook that syncs state from boardgame.io Client to Zustand store
 * One-way synchronization: bgio → Zustand
 * 
 * This hook should be used in a component that receives G and ctx props
 * from the bgio Client component.
 * 
 * @param {Object} G - Game state from bgio Client
 * @param {Object} ctx - Context from bgio Client
 */
export function useBgioSync(G, ctx) {
  const syncFromBgio = useGameStore((state) => state.syncFromBgio);
  const prevStateRef = useRef({ G: null, ctx: null });
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    // Only sync if G and ctx are defined
    if (!G || !ctx) {
      return;
    }

    // On initial mount, always sync
    if (isInitialMountRef.current) {
      syncFromBgio(G, ctx);
      prevStateRef.current = { G, ctx };
      isInitialMountRef.current = false;
      return;
    }

    // Check if state references have changed (shallow comparison)
    // bgio creates new objects when state changes, so reference equality is sufficient
    const prevState = prevStateRef.current;
    const stateChanged = prevState.G !== G || prevState.ctx !== ctx;

    if (stateChanged) {
      // Sync state to Zustand store
      syncFromBgio(G, ctx);
      
      // Update ref with current state references
      prevStateRef.current = { G, ctx };
    }
  }, [G, ctx, syncFromBgio]);
}
