import { create } from 'zustand';

/** Join form prefill for error/return flows and URL-based auto-join. */
interface JoinFormPrefill {
  code: string | null;
  error: string | null;
  /** When true and code is set with no error, LobbyScreen should attempt join (e.g. from /g/:code URL). */
  autoJoin?: boolean;
}

/** Lobby store state. */
export interface LobbyStoreState {
  isLobbyMode: boolean;
  selectedGameCode: string | null;
  lobbyState: Record<string, unknown>;
  joinFormPrefill: JoinFormPrefill;
  setLobbyMode: (isLobby: boolean) => void;
  setSelectedGame: (code: string | null) => void;
  clearSelection: () => void;
  setJoinFormPrefill: (code: string | null, error: string | null, autoJoin?: boolean) => void;
  clearJoinFormPrefill: () => void;
}

/**
 * Zustand store for lobby state management
 * Manages lobby mode, selected game, and lobby-specific UI state
 */
export const useLobbyStore = create<LobbyStoreState>((set) => ({
  isLobbyMode: true,
  selectedGameCode: null,
  lobbyState: {},
  joinFormPrefill: { code: null, error: null, autoJoin: false },

  setLobbyMode: (isLobby) => {
    set({ isLobbyMode: isLobby });
  },

  setSelectedGame: (code) => {
    set({
      selectedGameCode: code,
      isLobbyMode: code === null,
    });
  },

  clearSelection: () => {
    set({
      selectedGameCode: null,
      isLobbyMode: true,
    });
  },

  setJoinFormPrefill: (code, error, autoJoin = false) => {
    set({
      joinFormPrefill: {
        code: code || null,
        error: error || null,
        autoJoin: autoJoin === true,
      },
    });
  },

  clearJoinFormPrefill: () => {
    set({ joinFormPrefill: { code: null, error: null, autoJoin: false } });
  },
}));

// Expose store to window for console debugging (development only)
if (typeof window !== 'undefined' && !import.meta.env.PROD) {
  (window as unknown as { __lobbyStore?: typeof useLobbyStore }).__lobbyStore = useLobbyStore;
  (window as unknown as { __getLobbyState?: () => LobbyStoreState }).__getLobbyState = () =>
    useLobbyStore.getState();
  console.log('🏠 Lobby store available in console:');
  console.log('  - window.__lobbyStore - Zustand store hook');
  console.log('  - window.__getLobbyState() - Get current state');
}
