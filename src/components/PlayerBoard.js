import React from "react";
import { ContractsList } from "./ContractsList";

// Available starting city pairs
const STARTING_CITY_PAIRS = [
  ["Quebec City", "Montreal"],
  ["Boston", "Portland ME"],
  ["Philadelphia", "New York"],
  ["Washington", "Philadelphia"],
  ["Raleigh", "Norfolk"],
  ["Charleston", "Savannah"]
];

// Player Board Component
export function PlayerBoard({ G, ctx, startingContractExists, currentPhase, onStartingPairSelect, onToggleFulfilled, onDelete }) {
  const activePlayer = G.players.find(([key]) => key === ctx.currentPlayer);
  if (!activePlayer) return null;

  const [key, { name }] = activePlayer;

  // Determine which pairs are disabled (already chosen by any player)
  const getChosenCities = () => {
    const chosenCities = new Set();
    G.players.forEach(([id, player]) => {
      player.activeCities.forEach(city => chosenCities.add(city));
    });
    return chosenCities;
  };

  const chosenCities = currentPhase === 'setup' ? getChosenCities() : new Set();
  const isPairChosen = (pair) => chosenCities.has(pair[0]) || chosenCities.has(pair[1]);

  const handlePairClick = (pair) => {
    if (isPairChosen(pair)) return;
    onStartingPairSelect(pair);
  };

  return (
    <div className="playerBoard">
      <div className="playerBoard__player">
        <div className="playerBoard__info playerBoard__info--active">
          <div className="playerBoard__name playerBoard__name--active">
            {name}
          </div>
          <div className="playerBoard__buttonGroup">
            <button
              name="privateContract"
              className={`button ${startingContractExists ? '' : 'button--hidden'}`}
            >
              +1 P
            </button>
            <button
              name="marketContract"
              className={`button ${currentPhase === 'play' ? '' : 'button--hidden'}`}
            >
              +1 M
            </button>
            {/* End turn button - not shown during setup (auto-advances) */}
            <button 
              name="endTurn" 
              className={`button ${currentPhase === 'play' ? '' : 'button--hidden'}`}
            >End Turn</button>
          </div>
        </div>
        
        {/* Starting city pair buttons - shown during setup phase */}
        {currentPhase === 'setup' && (
          <div className="playerBoard__startingPairs">
            <div className="playerBoard__startingPairsLabel">Choose your starting cities:</div>
            {STARTING_CITY_PAIRS.map((pair, index) => {
              const disabled = isPairChosen(pair);
              return (
                <button
                  key={index}
                  type="button"
                  className="button playerBoard__pairButton"
                  disabled={disabled}
                  onClick={() => handlePairClick(pair)}
                >
                  {pair.join(' & ')}
                </button>
              );
            })}
          </div>
        )}
        <div className="playerBoard__contracts">
          <ContractsList G={G} ctx={ctx} type="private" playerID={key} onToggleFulfilled={onToggleFulfilled} onDelete={onDelete} />
          <ContractsList G={G} ctx={ctx} type="market" onToggleFulfilled={onToggleFulfilled} onDelete={onDelete} />
        </div>
      </div>
    </div>
  );
}
