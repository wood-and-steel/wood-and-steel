import React from "react";

// Top Button Bar Component
export function TopButtonBar({ input, setInput, startingContractExists, currentPhase, G, gameManager, onNavigateToLobby, onOpenEditPlaytest, activeTab, onTabChange }) {
  
  return (
    <div className="buttonBar">
      {/* Game code display - clickable to navigate to lobby */}
      {gameManager && (
        <span 
          onClick={onNavigateToLobby}
          className="buttonBar__gameCode"
          title="Click to return to lobby"
        >
          Game: {gameManager.currentGameCode}
        </span>
      )}

      {/* Tab switcher */}
      <div className="buttonBar__tabs">
        <button
          type="button"
          className={`buttonBar__tab ${activeTab === 'board' ? 'buttonBar__tab--active' : ''}`}
          onClick={() => onTabChange('board')}
        >
          Board
        </button>
        <button
          type="button"
          className={`buttonBar__tab ${activeTab === 'commodities' ? 'buttonBar__tab--active' : ''}`}
          onClick={() => onTabChange('commodities')}
        >
          Commodities
        </button>
        <button
          type="button"
          className={`buttonBar__tab ${activeTab === 'cities' ? 'buttonBar__tab--active' : ''}`}
          onClick={() => onTabChange('cities')}
        >
          Cities
        </button>
      </div>

      
      <div className="buttonBar__right">
        <button 
          type="button"
          onClick={onOpenEditPlaytest}
          className={`button button--icon-square ${currentPhase === 'play' ? '' : 'button--hidden'}`}
          title="Edit Playtest"
        >⚙️</button>
      </div>
    </div>
  );
}
