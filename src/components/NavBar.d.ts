/** Type declarations for NavBar.js so TS consumers (e.g. Board.tsx) get full props. */
import type * as React from 'react';

export interface NavBarProps {
  gameManager: { currentGameCode?: string };
  onNavigateToLobby: () => void;
  onOpenEditPlaytest: () => void;
  activeTab: 'board' | 'commodities' | 'cities' | 'indies';
  onTabChange: (tabId: 'board' | 'commodities' | 'cities' | 'indies') => void;
  showRailroadHint?: boolean;
  onDismissHint?: () => void;
}

export function NavBar(props: NavBarProps): React.ReactNode;
