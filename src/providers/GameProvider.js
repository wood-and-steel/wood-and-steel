import React, { createContext, useContext, useMemo } from 'react';
import { useGameStore } from '../stores/gameStore.ts';
import { createMoves } from '../stores/moves';

/**
 * Game Context that provides G, ctx, moves, and playerID to child components
 * Provides the same interface that components expect for accessing game state
 */
const GameContext = createContext(null);

/**
 * GameProvider component that provides game state and moves to child components
 * 
 * Uses Zustand store as the single source of truth for game state.
 * All player instances share the same store, but each provider instance
 * has its own playerID.
 * 
 * @param {Object} props
 * @param {string} props.playerID - Player ID ("0", "1", etc.)
 * @param {React.ReactNode} props.children - Child components
 */
export function GameProvider({ playerID, children }) {
  // Subscribe to Zustand store - this will trigger re-renders when state changes
  const G = useGameStore((state) => state.G);
  const ctx = useGameStore((state) => state.ctx);

  // Create moves object - memoized to avoid recreating on every render
  // The moves object itself doesn't need to change, only the state it operates on
  const moves = useMemo(() => createMoves(useGameStore), []);

  // Context value - memoized to avoid unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      G,
      ctx,
      moves,
      playerID,
    }),
    [G, ctx, moves, playerID]
  );

  return (
    <GameContext.Provider value={contextValue}>
      {children}
    </GameContext.Provider>
  );
}

/**
 * Hook to access game context
 * This is exported separately so useGame hook can use it
 * @returns {Object|null} Game context value or null if used outside provider
 */
export function useGameContext() {
  return useContext(GameContext);
}
