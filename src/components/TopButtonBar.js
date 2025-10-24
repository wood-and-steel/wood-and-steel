import React from "react";
import ThemeToggle from "./ThemeToggle";

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
export function TopButtonBar({ input, setInput, cityInput, setCityInput, startingContractExists, currentPhase, G, gameManager, onShowGameList, theme, onThemeToggle }) {
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
      {/* Game code display - clickable to open game list */}
      {gameManager && (
        <span 
          onClick={onShowGameList}
          className="buttonBar__gameCode"
          title="Click to view all games"
        >
          Game: {gameManager.currentGameCode}
        </span>
      )}

      {/* End turn button - not shown during setup (auto-advances) */}
      <button 
        name="endTurn" 
        className={`button ${currentPhase === 'play' ? '' : 'button--hidden'}`}
      >End Turn</button>

      <div className="buttonBar__section">
        <span className={`buttonBar__label ${currentPhase === 'setup' ? '' : 'hidden'}`}>
          <b>Choose starting cities:</b>
        </span>
        <span className={`buttonBar__label ${currentPhase === 'play' ? '' : 'hidden'}`}>
          <b>Manual</b> commodity, destination, type:
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
      
      {/* Text input for play phase */}
      <input 
        value={input}
        onChange={e => setInput(e.target.value)}
        name="inputParameters" 
        className={`buttonBar__input ${currentPhase === 'play' ? '' : 'hidden'}`}
      />
      
      <button 
        name="startingContract" 
        className={`button ${currentPhase === 'setup' ? '' : 'button--hidden'}`}
        disabled={!input || currentPhase !== 'setup'}
      >Choose Starting Cities</button>
      <button 
        name="manualContract" 
        className={`button ${currentPhase === 'play' ? '' : 'button--hidden'}`}
      >Manual Contract</button>

      <div className={`buttonBar__section ${currentPhase === 'play' ? '' : 'buttonBar__section--hidden'}`}>
        <span className="buttonBar__label"><b>Cities:</b></span>
        <input 
          value={cityInput}
          onChange={e => setCityInput(e.target.value)}
          name="cityList" 
          className="buttonBar__input--small"
        />
        <button name="addCities" className="button">Add Cities</button>
      </div>

      {/* Theme toggle button */}
      <div style={{ marginLeft: 'auto' }}>
        <ThemeToggle theme={theme} onToggle={onThemeToggle} />
      </div>
    </div>
  );
}
