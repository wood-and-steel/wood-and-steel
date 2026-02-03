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

/**
 * Displays the active player's board with contracts, action buttons, and starting city selection.
 * 
 * @component
 * @param {object} props
 * @param {object} props.G - The game state object containing players and contracts.
 * @param {object} props.ctx - The game context, including currentPlayer.
 * @param {string|null} props.playerID - Player ID for this board (BYOD mode).
 * @param {boolean} props.isBYODMode - Whether this is a BYOD game.
 * @param {boolean} props.startingContractExists - Whether the current player has a starting contract (controls visibility of +2P and +3P buttons).
 * @param {'setup'|'play'|'scoring'} props.currentPhase - The current game phase (affects which UI elements are shown).
 * @param {function} props.onStartingPairSelect - Called when a starting city pair is selected during setup phase. Receives the pair array as argument.
 * @param {function} props.onToggleFulfilled - Called when a contract's fulfilled state should be toggled. Receives the contract ID.
 * @param {function} props.onDelete - Called when a contract should be deleted. Receives the contract ID.
 * 
 * @example
 * <PlayerBoard
 *   G={G}
 *   ctx={ctx}
 *   startingContractExists={true}
 *   currentPhase="play"
 *   onStartingPairSelect={(pair) => handlePairSelect(pair)}
 *   onToggleFulfilled={(id) => handleToggle(id)}
 *   onDelete={(id) => handleDelete(id)}
 * />
 */
export function PlayerBoard({ G, ctx, playerID, isBYODMode = false, startingContractExists, currentPhase, onStartingPairSelect, onToggleFulfilled, onDelete }) {
  const effectivePlayerID = isBYODMode && playerID != null ? playerID : ctx.currentPlayer;
  const activePlayer = G.players.find(([key]) => key === effectivePlayerID);
  const isPlayerTurn = !isBYODMode || playerID === ctx.currentPlayer;
  const currentPlayerEntry = G.players.find(([id]) => id === ctx.currentPlayer);
  const currentPlayerName = currentPlayerEntry?.[1]?.name || `Player ${ctx.currentPlayer}`;
  const showTurnIndicator = isBYODMode && !isPlayerTurn;
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
    if (isPairChosen(pair) || !isPlayerTurn) return;
    onStartingPairSelect(pair);
  };

  return (
    <div className="playerBoard">
      <div className="playerBoard__player">
        <div className="playerBoard__info playerBoard__info--active">
          <div className="playerBoard__name playerBoard__name--active">
            {name}
          </div>
          {showTurnIndicator ? (
            <div className="playerBoard__turnIndicator">
              {currentPlayerName} is taking their turn
            </div>
          ) : (
            <div className="playerBoard__buttonGroup">
              <button
                name="privateContract2"
                className={`button ${startingContractExists && isPlayerTurn ? '' : 'button--hidden'}`}
              >
                +2 P
              </button>
              <button
                name="privateContract3"
                className={`button ${startingContractExists && isPlayerTurn ? '' : 'button--hidden'}`}
              >
                +3 P
              </button>
              <button
                name="marketContract"
                className={`button ${currentPhase === 'play' && isPlayerTurn ? '' : 'button--hidden'}`}
              >
                +1 M
              </button>
              {/* End turn button - not shown during setup (auto-advances) */}
              <button 
                name="endTurn" 
                className={`button ${currentPhase === 'play' && isPlayerTurn ? '' : 'button--hidden'}`}
              >End Turn</button>
            </div>
          )}
        </div>
        
        {/* Starting city pair buttons - shown during setup phase */}
        {currentPhase === 'setup' && (
          <div className="playerBoard__startingPairs">
            <div className="playerBoard__startingPairsLabel">Choose your starting cities:</div>
            {STARTING_CITY_PAIRS.map((pair, index) => {
              const disabled = isPairChosen(pair) || !isPlayerTurn;
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
        <div className={`playerBoard__contracts ${currentPhase === 'play' ? '' : 'hidden'}`}>
          <h3 className="playerBoard__contractsTitle">Private</h3>
          <ContractsList G={G} ctx={ctx} type="private" playerID={key} onToggleFulfilled={onToggleFulfilled} onDelete={onDelete} />
          <h3 className="playerBoard__contractsTitle">Market</h3>
          <ContractsList G={G} ctx={ctx} type="market" playerID={key} onToggleFulfilled={onToggleFulfilled} onDelete={onDelete} />
          <h3 className="playerBoard__contractsTitle">Fulfilled</h3>
          <ContractsList G={G} ctx={ctx} type="fulfilled" playerID={key} onToggleFulfilled={onToggleFulfilled} onDelete={onDelete} />
        </div>
      </div>
    </div>
  );
}
