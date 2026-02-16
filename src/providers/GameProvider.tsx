import React from 'react';
import { useGameStore } from '../stores/gameStore';
import type { GameState, GameContext } from '../stores/gameStore';
import { createMoves } from '../stores/moves';
import type { Moves } from '../stores/moves';

/** Game context value provided by GameProvider. */
export interface GameContextValue {
  G: GameState;
  ctx: GameContext;
  moves: Moves;
  playerID: string;
}

const GameContext = React.createContext<GameContextValue | null>(null);

export interface GameProviderProps {
  /** Player ID ("0", "1", etc.) */
  playerID: string;
  children: React.ReactNode;
}

/**
 * GameProvider component that provides game state and moves to child components.
 *
 * Uses Zustand store as the single source of truth for game state.
 * All player instances share the same store, but each provider instance
 * has its own playerID.
 */
export function GameProvider({ playerID, children }: GameProviderProps): React.ReactElement {
  // Subscribe to Zustand store - this will trigger re-renders when state changes
  const G = useGameStore((state) => state.G);
  const ctx = useGameStore((state) => state.ctx);

  // Create moves object - memoized to avoid recreating on every render
  // The moves object itself doesn't need to change, only the state it operates on
  const moves = React.useMemo(() => createMoves(useGameStore), []);

  // Create context value - memoized to avoid recreating on every render
  // The context value itself doesn't need to change, only the state it operates on
  const contextValue = React.useMemo<GameContextValue>(
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
 * Hook to access game context.
 * Returns null if used outside GameProvider.
 */
export function useGameContext(): GameContextValue | null {
  return React.useContext(GameContext);
}
