import { create } from 'zustand';

/**
 * Zustand store for lobby state management
 * Manages lobby mode, selected game, and lobby-specific UI state
 */
export const useLobbyStore = create((set) => ({
  // State
  isLobbyMode: true, // Default to lobby mode (entry point)
  selectedGameCode: null, // Currently selected/active game code
  lobbyState: {}, // Placeholder for future lobby UI state (filters, sort preferences, etc.)
  // Prefill for Join form when returning from "device not playing" error
  joinFormPrefill: { code: null, error: null },

  // Actions
  /**
   * Set lobby mode
   * @param {boolean} isLobby - Whether app is in lobby mode
   */
  setLobbyMode: (isLobby) => {
    set({ isLobbyMode: isLobby });
  },

  /**
   * Set selected game code
   * @param {string|null} code - Game code to set as selected, or null to clear
   */
  setSelectedGame: (code) => {
    set({ 
      selectedGameCode: code,
      isLobbyMode: code === null // Auto-set lobby mode when clearing selection
    });
  },

  /**
   * Clear selection and return to lobby mode
   */
  clearSelection: () => {
    set({ 
      selectedGameCode: null,
      isLobbyMode: true
    });
  },

  /**
   * Prefill Join form with code and error (e.g. when device is not playing a BYOD game)
   * @param {string|null} code - Game code to show in input
   * @param {string|null} error - Error message to show
   */
  setJoinFormPrefill: (code, error) => {
    set({ joinFormPrefill: { code: code || null, error: error || null } });
  },

  /**
   * Clear Join form prefill
   */
  clearJoinFormPrefill: () => {
    set({ joinFormPrefill: { code: null, error: null } });
  },
}));

// Expose store to window for console debugging (development only)
if (typeof window !== 'undefined' && !import.meta.env.PROD) {
  window.__lobbyStore = useLobbyStore;
  window.__getLobbyState = () => useLobbyStore.getState();
  console.log('🏠 Lobby store available in console:');
  console.log('  - window.__lobbyStore - Zustand store hook');
  console.log('  - window.__getLobbyState() - Get current state');
}
