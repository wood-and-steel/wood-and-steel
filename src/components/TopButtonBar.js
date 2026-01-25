import React from "react";

// Available starting city pairs
const STARTING_CITY_PAIRS = [
  ["Quebec City", "Montreal"],
  ["Boston", "Portland ME"],
  ["Philadelphia", "New York"],
  ["Washington", "Philadelphia"],
  ["Raleigh", "Norfolk"],
  ["Charleston", "Savannah"]
];

// Top Button Bar Component
export function TopButtonBar({ input, setInput, startingContractExists, currentPhase, G, gameManager, onNavigateToLobby, onOpenEditPlaytest, activeTab, onTabChange }) {
  // Get available starting pairs (filter out already chosen ones)
  const getAvailableStartingPairs = () => {
    if (currentPhase !== 'setup') return STARTING_CITY_PAIRS;
    
    // Get all starting cities that have been chosen
    const chosenCities = new Set();
    G.players.forEach(([id, player]) => {
      player.activeCities.forEach(city => chosenCities.add(city));
    });
    
    // Filter out pairs where any city has been chosen
    return STARTING_CITY_PAIRS.filter(pair => 
      !chosenCities.has(pair[0]) && !chosenCities.has(pair[1])
    );
  };
  
  const availablePairs = getAvailableStartingPairs();
  
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

      {/* End turn button - not shown during setup (auto-advances) */}
      <button 
        name="endTurn" 
        className={`button ${currentPhase === 'play' ? '' : 'button--hidden'}`}
      >End Turn</button>

      <div className="buttonBar__section">
        <span className={`buttonBar__label ${currentPhase === 'setup' ? '' : 'hidden'}`}>
          <b>Choose starting cities:</b>
        </span>
      </div>
      
      {/* Dropdown for setup phase */}
      {currentPhase === 'setup' && (
        <select
          value={input}
          onChange={e => setInput(e.target.value)}
          name="startingPairSelector"
          className="buttonBar__input--large"
        >
          <option value="">-- Select a pair --</option>
          {availablePairs.map((pair, index) => (
            <option key={index} value={pair.join(', ')}>
              {pair.join(' & ')}
            </option>
          ))}
        </select>
      )}
      
      <button 
        name="startingContract" 
        className={`button ${currentPhase === 'setup' ? '' : 'button--hidden'}`}
        disabled={!input || currentPhase !== 'setup'}
      >Choose Starting Cities</button>
      
      <button 
        type="button"
        onClick={onOpenEditPlaytest}
        className={`button ${currentPhase === 'play' ? '' : 'button--hidden'}`}
      >Edit Playtest</button>
    </div>
  );
}
