import React from "react";
import type { GameState, PlayerProps } from "../stores/gameStore";
import type { Moves } from "../stores/moves";
import { upgradeRefusal } from "../stores/gameActions";
import { enginePurchaseOptions, monopolizableCommodities } from "../rules/engines";
import { getEngineType, type EngineSlot } from "../rules/playerBoard";
import { indiePricePerRoute } from "../rules/railroads";
import { UPGRADE_KEYS, UPGRADE_NAMES, UPGRADE_PRICES, type UpgradeKey } from "../rules/rulesData";
import { cities } from "../data";
import { formatMoney, formatMoneyChange } from "../utils/money";
import { BeforeAfter, Sheet } from "./Sheet";

type View = "menu" | "engine" | "upgrade" | "track";

const SLOT_NAMES: Record<EngineSlot, string> = { 0: "light", 1: "dark" };

const REGION_NAMES: Record<string, string> = {
  NW: "Northwest",
  NC: "North Central",
  NE: "Northeast",
  SW: "Southwest",
  SC: "South Central",
  SE: "Southeast",
};

/** One-line effects for the upgrades list, from docs/Game rules.md. */
const UPGRADE_EFFECTS: Record<UpgradeKey, string> = {
  "service-yard": "Consolidation and better engines move 1 farther",
  "upgraded-stations": "+$3K on every delivery",
  roundhouse: "Hand cargo between engines",
  "employment-office": "Build 3 segments, not 2",
  timetable: "Keep moving after a delivery",
  "commodities-exchange": "Monopolize a commodity",
  hub: "Cheaper track and 3 contract choices",
  railyard: "A city supplies goods within 2",
  "regional-office": "+2 ties at game end",
};

export interface ActionsSheetProps {
  G: GameState;
  playerID: string;
  player: PlayerProps;
  moves: Moves;
  /** Opens the Railroads tab, where each railroad shows its price. */
  onAcquireRailroad: () => void;
  /** Opens the private contract offers (discard and draw). */
  onNewPrivateContract: () => void;
  onClose: () => void;
}

function shortfall(cost: number, cash: number): string | null {
  return cost > cash ? `${formatMoney(cost - cash)} short — borrow with Loans first` : null;
}

/** The turn actions that involve the app, each with its price, plus this turn's money log. */
export function ActionsSheet({
  G,
  playerID,
  player,
  moves,
  onAcquireRailroad,
  onNewPrivateContract,
  onClose,
}: ActionsSheetProps): React.ReactElement {
  const [view, setView] = React.useState<View>("menu");
  const back = () => setView("menu");

  if (view === "engine") {
    return <BuyEngineView player={player} moves={moves} onBack={back} onClose={onClose} />;
  }
  if (view === "upgrade") {
    return <BuyUpgradeView G={G} playerID={playerID} player={player} moves={moves} onBack={back} onClose={onClose} />;
  }
  if (view === "track") {
    return <PayForTrackView player={player} moves={moves} onBack={back} onClose={onClose} />;
  }

  const engineOptions = enginePurchaseOptions(player.engines, player.hubCity !== null);
  const cheapestEngine = engineOptions.reduce<(typeof engineOptions)[number] | null>(
    (best, o) => (best === null || o.cost < best.cost ? o : best),
    null
  );
  const affordableUpgrades = UPGRADE_KEYS.filter(
    (key) => UPGRADE_PRICES[key] <= player.cash && !isOwnedOrLocked(G, playerID, player, key)
  ).length;
  const entries = G.turnLedger?.playerID === playerID ? G.turnLedger.entries : [];

  return (
    <Sheet title="Actions" onClose={onClose}>
      <div className="actions__list">
        <button type="button" className="actions__item" onClick={() => setView("engine")}>
          <span>Buy an engine</span>
          <span className="sheet__label">
            {cheapestEngine
              ? `${getEngineType(cheapestEngine.engine).name} from ${formatMoney(cheapestEngine.cost)}`
              : "You have the best engine"}
          </span>
        </button>
        <button type="button" className="actions__item" onClick={() => setView("upgrade")}>
          <span>Buy an upgrade</span>
          <span className="sheet__label">
            {affordableUpgrades === 1 ? "1 you can afford" : `${affordableUpgrades} you can afford`}
          </span>
        </button>
        <button
          type="button"
          className="actions__item"
          onClick={() => {
            onAcquireRailroad();
            onClose();
          }}
        >
          <span>Acquire a railroad</span>
          <span className="sheet__label">{formatMoney(indiePricePerRoute(G.contracts))} per route</span>
        </button>
        <button type="button" className="actions__item" onClick={() => setView("track")}>
          <span>Pay for track</span>
          <span className="sheet__label">Enter what you spent</span>
        </button>
        <button
          type="button"
          className="actions__item"
          onClick={() => {
            onNewPrivateContract();
            onClose();
          }}
        >
          <span>New private contract</span>
          <span className="sheet__label">Choose from new offers</span>
        </button>
      </div>
      <div className="sheet__box" aria-label="Money this turn">
        <div className="sheet__subhead">Money this turn</div>
        {entries.length === 0 ? (
          <p className="sheet__note">No money has changed hands yet.</p>
        ) : (
          entries.map((entry, index) => (
            <div key={index} className="sheet__row">
              <span>{entry.label}</span>
              <span>{formatMoneyChange(entry.amount)}</span>
            </div>
          ))
        )}
        <p className="sheet__note">Undo reverses everything this turn.</p>
      </div>
    </Sheet>
  );
}

function isOwnedOrLocked(G: GameState, playerID: string, player: PlayerProps, key: UpgradeKey): boolean {
  if (key === "hub") return player.hubCity !== null;
  if (key === "regional-office") return player.regionalOffice !== null;
  if (player.upgrades.includes(key)) return true;
  return key === "service-yard" && upgradeRefusal(G, playerID, player, key) !== null;
}

interface ViewProps {
  player: PlayerProps;
  moves: Moves;
  onBack: () => void;
  onClose: () => void;
}

function BuyEngineView({ player, moves, onBack, onClose }: ViewProps): React.ReactElement {
  const options = enginePurchaseOptions(player.engines, player.hubCity !== null);
  return (
    <Sheet title="Buy an engine" onClose={onClose} onBack={onBack}>
      {options.length === 0 ? (
        <p className="sheet__note">You already have the best engine.</p>
      ) : (
        <div className="sheet__options">
          {options.map((o) => {
            const short = shortfall(o.cost, player.cash);
            const name = getEngineType(o.engine).name;
            return (
              <div key={`${o.engine}-${o.slot}`} className="sheet__option">
                <div className="sheet__row">
                  <strong>{name}</strong>
                  <span>{formatMoney(o.cost)}</span>
                </div>
                <span className="sheet__label">
                  {getEngineType(o.engine).distance} segments ·{" "}
                  {o.tradeIn
                    ? `trades in your ${SLOT_NAMES[o.slot]} ${getEngineType(o.tradeIn).name}`
                    : `on your empty ${SLOT_NAMES[o.slot]} token`}
                  {o.skip ? " · Hub order, +$5K" : ""}
                </span>
                {short ? (
                  <span className="sheet__warning">{short}</span>
                ) : (
                  <button
                    type="button"
                    className="button"
                    onClick={() => {
                      if (moves.buyEngine(o.slot, o.engine)) onClose();
                    }}
                  >
                    Buy for {formatMoney(o.cost)}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="sheet__note">
        A new engine goes on any city in your network; a trade-in stays where the old one was, with its cargo.
      </p>
    </Sheet>
  );
}

function BuyUpgradeView({
  G,
  playerID,
  player,
  moves,
  onBack,
  onClose,
}: ViewProps & { G: GameState; playerID: string }): React.ReactElement {
  const [chosen, setChosen] = React.useState<UpgradeKey | null>(null);
  const [choice, setChoice] = React.useState("");

  if (chosen) {
    const key: UpgradeKey = chosen;
    const price = UPGRADE_PRICES[key];
    const options = choiceOptions(G, playerID, player, key);
    const refusal = upgradeRefusal(G, playerID, player, key, choice || undefined);
    const short = shortfall(price, player.cash);
    return (
      <Sheet
        title={`Buy ${UPGRADE_NAMES[key]}`}
        onClose={onClose}
        onBack={() => {
          setChosen(null);
          setChoice("");
        }}
      >
        <p className="sheet__note">{UPGRADE_EFFECTS[key]}.</p>
        {options && (
          <label className="sheet__field">
            <span className="sheet__label">{options.label}</span>
            <select className="sheet__select" value={choice} onChange={(e) => setChoice(e.target.value)}>
              <option value="">Choose…</option>
              {options.groups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.items.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        )}
        {key === "regional-office" && (
          <p className="sheet__note">Buy it once you connect to 5 cities in a region where no one else has routes.</p>
        )}
        {key === "commodities-exchange" && (
          <p className="sheet__note">
            Buy it once your track reaches every city that supplies the commodity. Its ties come at the end of the game.
          </p>
        )}
        <div className="sheet__box">
          <BeforeAfter label="Cash" before={formatMoney(player.cash)} after={formatMoney(player.cash - price)} />
        </div>
        {short ? (
          <p className="sheet__warning">{short}</p>
        ) : (
          <button
            type="button"
            className="button sheet__primary"
            disabled={refusal !== null}
            title={refusal ?? undefined}
            onClick={() => {
              if (moves.buyUpgrade(key, choice || undefined)) onClose();
            }}
          >
            Buy {UPGRADE_NAMES[key]} for {formatMoney(price)}
          </button>
        )}
      </Sheet>
    );
  }

  return (
    <Sheet title="Upgrades" onClose={onClose} onBack={onBack}>
      <div className="upgrades__list">
        {UPGRADE_KEYS.map((key) => {
          const price = UPGRADE_PRICES[key];
          const owned =
            key === "hub"
              ? player.hubCity
              : key === "regional-office"
                ? player.regionalOffice && REGION_NAMES[player.regionalOffice]
                : player.upgrades.includes(key)
                  ? key === "commodities-exchange"
                    ? player.exchangeCommodity ?? "Owned"
                    : "Owned"
                  : null;
          const locked = !owned && key === "service-yard" ? upgradeRefusal(G, playerID, player, key) : null;
          return (
            <div key={key} className="upgrades__item">
              <div className="sheet__row">
                <span>{UPGRADE_NAMES[key]}</span>
                {owned ? (
                  <span className="upgrades__owned">{owned}</span>
                ) : locked ? (
                  <span className="sheet__label">Locked</span>
                ) : price > player.cash ? (
                  <span className="sheet__warning">
                    {formatMoney(price)} · {formatMoney(price - player.cash)} short
                  </span>
                ) : (
                  <button type="button" className="button upgrades__buy" onClick={() => setChosen(key)}>
                    {formatMoney(price)}
                  </button>
                )}
              </div>
              <span className="sheet__label">{locked ?? UPGRADE_EFFECTS[key]}</span>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

interface ChoiceOptions {
  label: string;
  groups: { label: string; items: { value: string; label: string }[] }[];
}

/** What an upgrade asks for: the Hub's city, the Regional Office's region, or the Exchange's commodity. */
function choiceOptions(G: GameState, playerID: string, player: PlayerProps, upgrade: UpgradeKey): ChoiceOptions | null {
  const others = G.players.filter(([id]) => id !== playerID).map(([, p]) => p);
  if (upgrade === "hub") {
    const taken = new Set(others.map((p) => p.hubCity));
    const mine = player.activeCities.filter((c) => !taken.has(c)).sort();
    const rest = [...cities.keys()].filter((c) => !taken.has(c) && !mine.includes(c)).sort();
    const item = (c: string) => ({ value: c, label: cities.get(c)?.label ?? c });
    return {
      label: "City for your Hub",
      groups: [
        { label: "Your cities", items: mine.map(item) },
        { label: "Other cities", items: rest.map(item) },
      ],
    };
  }
  if (upgrade === "regional-office") {
    const taken = new Set(others.map((p) => p.regionalOffice));
    return {
      label: "Region",
      groups: [
        {
          label: "Regions",
          items: Object.keys(REGION_NAMES)
            .filter((r) => !taken.has(r as PlayerProps["regionalOffice"]))
            .map((r) => ({ value: r, label: REGION_NAMES[r] })),
        },
      ],
    };
  }
  if (upgrade === "commodities-exchange") {
    const taken = new Set(others.map((p) => p.exchangeCommodity));
    return {
      label: "Commodity to monopolize",
      groups: [
        {
          label: "Commodities",
          items: monopolizableCommodities()
            .filter((c) => !taken.has(c))
            .map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) })),
        },
      ],
    };
  }
  return null;
}

function PayForTrackView({ player, moves, onBack, onClose }: ViewProps): React.ReactElement {
  const [thousands, setThousands] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const amount = Number(thousands) * 1000;

  const pay = () => {
    if (!/^[0-9]+$/.test(thousands) || amount <= 0) {
      setError("Enter what the track cost, in thousands.");
      return;
    }
    if (amount > player.cash) {
      setError(`That's more than your ${formatMoney(player.cash)} cash. To spend more, borrow first using Loans.`);
      return;
    }
    if (moves.payForTrack(amount)) onClose();
  };

  return (
    <Sheet title="Pay for track" onClose={onClose} onBack={onBack}>
      <label className="sheet__field">
        <span className="sheet__label">What did this turn's track cost?</span>
        <span className={`track__field${error ? " track__field--error" : ""}`}>
          <span>$</span>
          <input
            className="track__input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            aria-label="Track cost in thousands of dollars"
            value={thousands}
            onChange={(e) => {
              setThousands(e.target.value.replace(/[^0-9]/g, ""));
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                pay();
              }
            }}
          />
          <span className="sheet__label">,000</span>
        </span>
      </label>
      {error && (
        <p className="sheet__warning" role="alert">
          {error}
        </p>
      )}
      <div className="sheet__box">
        <BeforeAfter
          label="Cash"
          before={formatMoney(player.cash)}
          after={formatMoney(amount > 0 && amount <= player.cash ? player.cash - amount : player.cash)}
        />
      </div>
      <button type="button" className="button sheet__primary" onClick={pay}>
        Pay {thousands ? formatMoney(amount) : ""}
      </button>
    </Sheet>
  );
}
