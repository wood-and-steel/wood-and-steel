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
import { EngineSegments, EngineSlotIcon } from "./EngineIcon";
import { BeforeAfter, ListRow, Price, Sheet, ShortOfCash } from "./Sheet";
import { AcquireRailroadSheet } from "./AcquireRailroadSheet";

export type ActionsView = "menu" | "engine" | "upgrade" | "railroad" | "track";


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
  /** Opens the private contract offers; picking one replaces the player's private contract. */
  onNewPrivateContract: () => void;
  /** The view to open on; the Actions menu by default. */
  initialView?: ActionsView;
  onClose: () => void;
}

function shortfall(cost: number, cash: number): string | null {
  return cost > cash ? `${formatMoney(cost - cash)} short` : null;
}

/** The turn actions that involve the app, each with its price, plus this turn's money log. */
export function ActionsSheet({
  G,
  playerID,
  player,
  moves,
  onNewPrivateContract,
  initialView = "menu",
  onClose,
}: ActionsSheetProps): React.ReactElement {
  const [view, setView] = React.useState<ActionsView>(initialView);
  const back = () => setView("menu");

  if (view === "engine") {
    // Opened straight from an engine's name, it's its own sheet, with no Actions menu to go back to.
    const onBack = initialView === "engine" ? undefined : back;
    return <BuyEngineView playerID={playerID} player={player} moves={moves} onBack={onBack} onClose={onClose} />;
  }
  if (view === "upgrade") {
    return <BuyUpgradeView G={G} playerID={playerID} player={player} moves={moves} onBack={back} onClose={onClose} />;
  }
  if (view === "railroad") {
    return (
      <AcquireRailroadSheet G={G} player={player} moves={moves} onBack={back} onClose={onClose} />
    );
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
      <div className="sheet__list">
        <ListRow title="Buy an engine" onSelect={() => setView("engine")}>
          <span className="sheet__label">
            {cheapestEngine
              ? `${getEngineType(cheapestEngine.engine).name} from ${formatMoney(cheapestEngine.cost)}`
              : "You have the best engine"}
          </span>
        </ListRow>
        <ListRow title="Buy an upgrade" onSelect={() => setView("upgrade")}>
          <span className="sheet__label">
            {affordableUpgrades === 1 ? "1 you can afford" : `${affordableUpgrades} you can afford`}
          </span>
        </ListRow>
        <ListRow title="Acquire a railroad" onSelect={() => setView("railroad")}>
          <span className="sheet__label">{formatMoney(indiePricePerRoute(G.contracts))} per route</span>
        </ListRow>
        <ListRow title="Pay for track" onSelect={() => setView("track")}>
          <span className="sheet__label">Enter what you spent</span>
        </ListRow>
        <ListRow
          title="Discard and draw new contract"
          onSelect={() => {
            onNewPrivateContract();
            onClose();
          }}
        >
          <span className="sheet__label">Replace your private contract</span>
        </ListRow>
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

/** Upgrades from cheapest to dearest; equal prices keep player-board order. */
const UPGRADES_BY_PRICE = [...UPGRADE_KEYS].sort((a, b) => UPGRADE_PRICES[a] - UPGRADE_PRICES[b]);

function isOwnedOrLocked(G: GameState, playerID: string, player: PlayerProps, key: UpgradeKey): boolean {
  if (key === "hub") return player.hubCity !== null;
  if (key === "regional-office") return player.regionalOffice !== null;
  if (player.upgrades.includes(key)) return true;
  return key === "service-yard" && upgradeRefusal(G, playerID, player, key) !== null;
}

interface ViewProps {
  player: PlayerProps;
  moves: Moves;
  /** Back to the Actions menu; omit when the sheet was opened on its own. */
  onBack?: () => void;
  onClose: () => void;
}

function BuyEngineView({ playerID, player, moves, onBack, onClose }: ViewProps & { playerID: string }): React.ReactElement {
  const options = enginePurchaseOptions(player.engines, player.hubCity !== null);
  return (
    <Sheet title="Buy an engine" onClose={onClose} onBack={onBack}>
      {options.length === 0 ? (
        <p className="sheet__note">You already have the best engine.</p>
      ) : (
        <div className="sheet__list">
          {options.map((o) => (
            <ListRow
              key={`${o.engine}-${o.slot}`}
              title={<strong>{getEngineType(o.engine).name}</strong>}
              aside={<Price price={o.cost} cash={player.cash} />}
              onSelect={
                o.cost > player.cash
                  ? undefined
                  : () => {
                      if (moves.buyEngine(o.slot, o.engine)) onClose();
                    }
              }
            >
              <span className="sheet__label engineLabel">
                <EngineSegments count={getEngineType(o.engine).distance} /> ·{" "}
                {o.tradeIn ? "trades in your" : "on your empty"}
                <EngineSlotIcon playerID={playerID} avatarColor={player.avatarColor} slot={o.slot} />
                {o.tradeIn ? getEngineType(o.tradeIn).name : "token"}
                {o.skip ? " · Hub order, +$5K" : ""}
              </span>
            </ListRow>
          ))}
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
          <ShortOfCash>{short}</ShortOfCash>
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
      <div className="sheet__list">
        {UPGRADES_BY_PRICE.map((key) => {
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
            <ListRow
              key={key}
              title={UPGRADE_NAMES[key]}
              aside={
                owned ? (
                  <span className="upgrades__owned">{owned}</span>
                ) : locked ? (
                  <span className="sheet__label">Locked</span>
                ) : (
                  <Price price={price} cash={player.cash} />
                )
              }
              onSelect={owned || locked || price > player.cash ? undefined : () => setChosen(key)}
            >
              <span className="sheet__label">{locked ?? UPGRADE_EFFECTS[key]}</span>
            </ListRow>
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
  const [amountError, setAmountError] = React.useState(false);
  const amount = Number(thousands) * 1000;
  // Reads the live cash, which Loans can change while the sheet is open.
  const overCash = amount > player.cash;

  const pay = () => {
    if (overCash) return;
    if (!/^[0-9]+$/.test(thousands) || amount <= 0) {
      setAmountError(true);
      return;
    }
    if (moves.payForTrack(amount)) onClose();
  };

  return (
    <Sheet title="Pay for track" onClose={onClose} onBack={onBack}>
      <label className="sheet__field">
        <span className="sheet__label">What did this turn's track cost?</span>
        <span className={`track__field${amountError || overCash ? " track__field--error" : ""}`}>
          <span className="track__affix">$</span>
          <input
            className="track__input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            aria-label="Track cost in thousands of dollars"
            data-autofocus
            value={thousands}
            onChange={(e) => {
              setThousands(e.target.value.replace(/[^0-9]/g, ""));
              setAmountError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                pay();
              }
            }}
          />
          <span className="track__affix track__affix--thousands">,000</span>
        </span>
      </label>
      {amountError && (
        <p className="sheet__warning" role="alert">
          Enter what the track cost, in thousands.
        </p>
      )}
      <div className="sheet__box">
        <BeforeAfter
          label={overCash ? "Not enough cash" : "Cash"}
          warning={overCash}
          before={formatMoney(player.cash)}
          after={formatMoney(amount > 0 && !overCash ? player.cash - amount : player.cash)}
        />
      </div>
      <button type="button" className="button sheet__primary" disabled={overCash} onClick={pay}>
        Pay {thousands ? formatMoney(amount) : ""}
      </button>
    </Sheet>
  );
}
