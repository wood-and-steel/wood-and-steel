/** Type declarations for NavBar.js so TS consumers (e.g. Board.tsx) get full props including showRailroadHint/onDismissHint. */
import type * as React from 'react';
import type { GameState } from '../stores/gameStore';

export interface NavBarProps {
  input: string;
  setInput: (value: string) => void;
  startingContractExists: boolean;
  currentPhase: 'play' | 'setup' | 'scoring';
  G: GameState;
  gameManager: { currentGameCode?: string };
  onNavigateToLobby: () => void;
  onOpenEditPlaytest: () => void;
  activeTab: 'board' | 'commodities' | 'cities' | 'indies';
  onTabChange: (tabId: 'board' | 'commodities' | 'cities' | 'indies') => void;
  showRailroadHint?: boolean;
  onDismissHint?: () => void;
}

export function NavBar(props: NavBarProps): React.ReactNode;
