import React from "react";
import { commodities, cities } from "../data";
import type { GameState, GameContext } from "../stores/gameStore";
import type { Moves } from "../stores/moves";
import { ENGINE_TYPES, UPGRADES, type EngineTypeId, type PlayerUpgradeId } from "../rules/playerBoard";
import { monopolizableCommodities } from "../rules/engines";

export interface EditPlaytestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  G: GameState;
  ctx: GameContext;
  moves: Moves;
}

/** Upgrades kept in `upgrades` (the Hub and Regional Office have their own fields). */
const BOARD_UPGRADES: { id: PlayerUpgradeId; name: string }[] = [
  ...UPGRADES.map((u) => ({ id: u.id as PlayerUpgradeId, name: u.name })),
  { id: "railyard", name: "Railyard" },
];

/**
 * Dialog component for playtest editing. Allows creating manual contracts, adding cities to
 * players, and correcting any player's money, engines and upgrades (for games started before
 * the app tracked them).
 */
export function EditPlaytestDialog({
  isOpen,
  onClose,
  G,
  ctx,
  moves,
}: EditPlaytestDialogProps): React.ReactElement | null {
  const [selectedCommodity, setSelectedCommodity] = React.useState("");
  const [selectedDestination, setSelectedDestination] = React.useState("");
  const [selectedType, setSelectedType] = React.useState("Private");
  const [selectedCity, setSelectedCity] = React.useState("");
  const [boardPlayer, setBoardPlayer] = React.useState("");
  const [cashK, setCashK] = React.useState("");
  const [debtK, setDebtK] = React.useState("");
  const [light, setLight] = React.useState("");
  const [dark, setDark] = React.useState("");
  const [owned, setOwned] = React.useState<string[]>([]);
  const [exchange, setExchange] = React.useState("");

  const commodityNames = Array.from(commodities.keys()).sort();
  const cityNames = Array.from(cities.keys()).sort();

  const activeCitiesSet = new Set<string>();
  G.players.forEach(([, player]) => {
    player.activeCities.forEach((city) => activeCitiesSet.add(city));
  });
  const inactiveCities = cityNames.filter((city) => !activeCitiesSet.has(city));

  React.useEffect(() => {
    if (isOpen) {
      setSelectedCommodity("");
      setSelectedDestination("");
      setSelectedType("Private");
      setSelectedCity("");
    }
  }, [isOpen]);

  /** Load a player's current board into the fix-up fields. */
  const selectBoardPlayer = (id: string) => {
    setBoardPlayer(id);
    const props = G.players.find(([pid]) => pid === id)?.[1];
    if (!props) return;
    setCashK(String(props.cash / 1000));
    setDebtK(String(props.debt / 1000));
    setLight(props.engines[0] ?? "");
    setDark(props.engines[1] ?? "");
    setOwned([...props.upgrades]);
    setExchange(props.exchangeCommodity ?? "");
  };

  if (!isOpen) return null;

  const handleSaveBoard = () => {
    if (!boardPlayer) return;
    moves.setPlayerBoard(boardPlayer, {
      cash: Number(cashK) * 1000,
      debt: Number(debtK) * 1000,
      engines: [(light || null) as EngineTypeId | null, (dark || null) as EngineTypeId | null],
      upgrades: owned as PlayerUpgradeId[],
      exchangeCommodity: owned.includes("commodities-exchange") ? exchange || null : null,
    });
    onClose();
  };

  const engineSelect = (id: string, value: string, onChange: (v: string) => void) => (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="editPlaytestDialog__select">
      <option value="">No engine</option>
      {ENGINE_TYPES.map((engine) => (
        <option key={engine.id} value={engine.id}>
          {engine.name}
        </option>
      ))}
    </select>
  );

  const numberInput = (id: string, value: string, onChange: (v: string) => void) => (
    <input
      id={id}
      className="editPlaytestDialog__select"
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
      // The dialog sits inside the game page's form; Enter would submit it with +M or End Turn.
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault();
      }}
    />
  );

  const handleCreateContract = () => {
    if (!selectedCommodity || !selectedDestination) return;
    const type = selectedType.toLowerCase() as "private" | "market";
    moves.addContract(selectedCommodity, selectedDestination, type);
    onClose();
  };

  const handleAddCity = () => {
    if (!selectedCity) return;
    moves.addCityToPlayer(selectedCity);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
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

        <div className="editPlaytestDialog__form editPlaytestDialog__form--separated">
          <div className="editPlaytestDialog__row">
            <label htmlFor="boardPlayer" className="editPlaytestDialog__label">
              <b>Player board:</b>
            </label>
            <select
              id="boardPlayer"
              value={boardPlayer}
              onChange={(e) => selectBoardPlayer(e.target.value)}
              className="editPlaytestDialog__select"
            >
              <option value="">-- Select a player --</option>
              {G.players.map(([id, p]) => (
                <option key={id} value={id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          {boardPlayer && (
            <>
              <div className="editPlaytestDialog__row">
                <label htmlFor="boardCash" className="editPlaytestDialog__label">
                  <b>Cash ($K):</b>
                </label>
                {numberInput("boardCash", cashK, setCashK)}
              </div>
              <div className="editPlaytestDialog__row">
                <label htmlFor="boardDebt" className="editPlaytestDialog__label">
                  <b>Debt ($K, in 5s):</b>
                </label>
                {numberInput("boardDebt", debtK, setDebtK)}
              </div>
              <div className="editPlaytestDialog__row">
                <label htmlFor="boardLight" className="editPlaytestDialog__label">
                  <b>Light engine:</b>
                </label>
                {engineSelect("boardLight", light, setLight)}
              </div>
              <div className="editPlaytestDialog__row">
                <label htmlFor="boardDark" className="editPlaytestDialog__label">
                  <b>Dark engine:</b>
                </label>
                {engineSelect("boardDark", dark, setDark)}
              </div>
              <div className="editPlaytestDialog__row">
                <span className="editPlaytestDialog__label">
                  <b>Upgrades:</b>
                </span>
                <div className="editPlaytestDialog__checks">
                  {BOARD_UPGRADES.map((u) => (
                    <label key={u.id}>
                      <input
                        type="checkbox"
                        checked={owned.includes(u.id)}
                        onChange={(e) =>
                          setOwned(e.target.checked ? [...owned, u.id] : owned.filter((id: string) => id !== u.id))
                        }
                      />{" "}
                      {u.name}
                    </label>
                  ))}
                </div>
              </div>
              {owned.includes("commodities-exchange") && (
                <div className="editPlaytestDialog__row">
                  <label htmlFor="boardExchange" className="editPlaytestDialog__label">
                    <b>Exchange commodity:</b>
                  </label>
                  <select
                    id="boardExchange"
                    value={exchange}
                    onChange={(e) => setExchange(e.target.value)}
                    className="editPlaytestDialog__select"
                  >
                    <option value="">-- Select a commodity --</option>
                    {monopolizableCommodities().map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <p className="editPlaytestDialog__note">
                The Hub and Regional Office are bought from Actions. Cargo is set on the Contracts tab.
              </p>
              <div className="modal__actions editPlaytestDialog__actions">
                <button type="button" className="button" onClick={handleSaveBoard}>
                  Save Player Board
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
