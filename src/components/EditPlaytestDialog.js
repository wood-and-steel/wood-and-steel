import React from "react";
import { commodities, cities } from "../data";

/**
 * Dialog component for playtest editing. Allows creating manual contracts and adding cities to players.
 * 
 * @component
 * @param {object} props
 * @param {boolean} props.isOpen - Whether the dialog is currently open.
 * @param {function} props.onClose - Callback function called when the dialog should be closed.
 * @param {object} props.G - The game state object.
 * @param {object} props.ctx - The game context.
 * @param {object} props.moves - Object containing game move functions (addContract, addCityToPlayer).
 * 
 * @example
 * <EditPlaytestDialog
 *   isOpen={isDialogOpen}
 *   onClose={() => setIsDialogOpen(false)}
 *   G={G}
 *   ctx={ctx}
 *   moves={moves}
 * />
 */
export function EditPlaytestDialog({ isOpen, onClose, G, ctx, moves }) {
  const [selectedCommodity, setSelectedCommodity] = React.useState("");
  const [selectedDestination, setSelectedDestination] = React.useState("");
  const [selectedType, setSelectedType] = React.useState("Private");
  const [selectedCity, setSelectedCity] = React.useState("");

  // Get all commodity names
  const commodityNames = Array.from(commodities.keys()).sort();

  // Get all city names
  const cityNames = Array.from(cities.keys()).sort();

  // Get inactive cities (cities not in any player's activeCities)
  const activeCitiesSet = new Set();
  G.players.forEach(([id, player]) => {
    player.activeCities.forEach(city => activeCitiesSet.add(city));
  });
  const inactiveCities = cityNames.filter(city => !activeCitiesSet.has(city));

  // Reset form when dialog opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setSelectedCommodity("");
      setSelectedDestination("");
      setSelectedType("Private");
      setSelectedCity("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateContract = () => {
    if (!selectedCommodity || !selectedDestination) {
      return;
    }
    
    const type = selectedType.toLowerCase(); // "Private" -> "private", "Market" -> "market"
    moves.addContract(selectedCommodity, selectedDestination, type);
    onClose();
  };

  const handleAddCity = () => {
    if (!selectedCity) {
      return;
    }

    moves.addCityToPlayer(selectedCity);
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal" onClick={handleBackdropClick}>
      <div className="modal__content" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal__title">Edit Playtest</h2>
        
        <div className="editPlaytestDialog__form">
          <div className="editPlaytestDialog__row">
            <label htmlFor="commodity" className="editPlaytestDialog__label">
              <b>Commodity:</b>
            </label>
            <select
              id="commodity"
              value={selectedCommodity}
              onChange={(e) => setSelectedCommodity(e.target.value)}
              className="editPlaytestDialog__select"
            >
              <option value="">-- Select a commodity --</option>
              {commodityNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="editPlaytestDialog__row">
            <label htmlFor="destination" className="editPlaytestDialog__label">
              <b>Destination:</b>
            </label>
            <select
              id="destination"
              value={selectedDestination}
              onChange={(e) => setSelectedDestination(e.target.value)}
              className="editPlaytestDialog__select"
            >
              <option value="">-- Select a city --</option>
              {cityNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="editPlaytestDialog__row">
            <label htmlFor="type" className="editPlaytestDialog__label">
              <b>Type:</b>
            </label>
            <select
              id="type"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="editPlaytestDialog__select"
            >
              <option value="Private">Private</option>
              <option value="Market">Market</option>
            </select>
          </div>

          <div className="modal__actions editPlaytestDialog__actions">
            <button 
              type="button" 
              className="button" 
              onClick={handleCreateContract}
              disabled={!selectedCommodity || !selectedDestination}
            >
              Create Manual Contract
            </button>
          </div>
        </div>

        <div className="editPlaytestDialog__form editPlaytestDialog__form--separated">
          <div className="editPlaytestDialog__row">
            <label htmlFor="city" className="editPlaytestDialog__label">
              <b>City:</b>
            </label>
            <select
              id="city"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="editPlaytestDialog__select"
            >
              <option value="">-- Select a city --</option>
              {inactiveCities.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="modal__actions editPlaytestDialog__actions">
            <button 
              type="button" 
              className="button" 
              onClick={handleAddCity}
              disabled={!selectedCity}
            >
              Add City to this Player
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
