# Game Data Schema

**For AI agents and humans:** This is a concise reference for the shapes of `G` (game state), `ctx` (game context), and the hard-coded map data (cities, routes, commodities). Use it when reading, writing, or extending game data. It documents *shape*, not behavior — see [AGENTS.md](../AGENTS.md) and [PHASES_AGENT_GUIDE.md](PHASES_AGENT_GUIDE.md) for where logic lives.

---

## 1. `G` — game state

**Source of truth:** `src/stores/gameStore.ts` (`GameState`). Accessed via the `useGameStore` Zustand hook or `useGame()`. Never duplicate this elsewhere (see [AGENTS.md](../AGENTS.md)).

```ts
export type RegionCode = 'NW' | 'NC' | 'NE' | 'SW' | 'SC' | 'SE';

export interface PlayerProps {
  name: string;
  activeCities: string[];      // city keys, ordered; last entry = player's "current" city
  hubCity: string | null;      // city key, or null
  regionalOffice: RegionCode | null;
}

export interface IndependentRailroadRoute {
  key: string;                 // route key (into `routes` map)
  addedInRound: number;        // ctx.round when this route was assigned
}

export interface GameState {
  contracts: Contract[];
  players: [string, PlayerProps][];   // tuple array; first element is player ID (e.g. "0", "1")
  independentRailroads: Record<
    string,                                             // company name
    { name: string; routes: IndependentRailroadRoute[] }
  >;
  byodGameStarted?: boolean;          // BYOD only: true once host starts the game
  lastRoundRoutesAdded?: number;      // UI hint; set when growIndependentRailroads adds routes
}
```

| Field | Notes |
|---|---|
| `contracts` | All contracts (market + private), see [`Contract`](#contract-in-gcontracts) below |
| `players` | Array of `[playerID, PlayerProps]` tuples — **not** a plain object; find with `G.players.find(([id]) => id === playerID)` |
| `players[].activeCities` | Cities the player has expanded into; last entry drives contract generation ("current city") |
| `players[].hubCity` / `.regionalOffice` | Optional player upgrades; `regionalOffice` gates commodity region in contract generation |
| `independentRailroads` | Keyed by generated company name; grown over time by `growIndependentRailroads` (see `src/independentRailroads.ts`) |

### `Contract` (in `G.contracts`)

**Source:** `src/Contract.ts`.

```ts
export interface Contract {
  id: string;                    // `${commodity.slice(0,3)}-${city.id}-${timestamp.toString(16)}`
  destinationKey: string;        // city key (into `cities` map)
  commodity: string;             // commodity key (into `commodities` map)
  type: "market" | "private";
  fulfilled: boolean;
  playerID: string | null;       // null only for unclaimed market contracts
  creationTime: number;          // Date.now() at creation
  turnsHeld: number | null;      // null iff playerID is null; else non-negative integer
}
```

- **Market contracts**: `type: "market"`, start with `playerID: null`, claimable by any player.
- **Private contracts**: `type: "private"`, always have a `playerID` (generated for/assigned to that player).
- **Value when fulfilled** is *derived*, not stored: `moneyValue(contract)` = shortest distance (in route segments) from destination to the nearest commodity-producing city × $3,000; `railroadTieValue(contract)` = 1–4, from a destination-region × commodity-region matrix. Both in `src/Contract.ts`.

---

## 2. `ctx` — game context

**Source of truth:** `src/stores/gameStore.ts` (`GameContext`).

```ts
export interface GameContext {
  phase: string;          // one of PhaseName (see moveValidation.ts): 'waiting_for_players' | 'setup' | 'play' | 'scoring'
  currentPlayer: string;  // player ID whose turn it is
  numPlayers: number;
  playOrder: string[];    // turn order, as player IDs
  playOrderPos: number;   // index into playOrder for currentPlayer
  turn: number;           // global turn counter
  round: number;          // round counter (increments when playOrder wraps, in the `play` phase)
}
```

- **Phase** gates which moves are allowed (`MOVES_BY_PHASE` in `src/stores/moveValidation.ts`) and drives phase transitions (`checkPhaseTransition` in `src/stores/phaseManager.ts`, config in `src/stores/phaseConfig.ts`). See [PHASES_AGENT_GUIDE.md](PHASES_AGENT_GUIDE.md) for the full system.
- **Moves** (`src/stores/gameActions.js`) mutate `G` and sometimes `ctx` (e.g. `endTurn` advances `currentPlayer`/`playOrderPos`/`turn`, and `round` at the end-of-round hook in `phaseConfig.ts`).

### Other store state (not part of `G`/`ctx` but co-located)

`GameStoreState` (same file) also holds `turnStartSnapshot` (`{ G, ctx } | null`, for undo) and `hasMovedThisTurn: boolean`. These are session/UI-adjacent, not persisted game state.

### Persisted shape

`src/utils/stateSerialization.js` persists exactly `{ G, ctx }` (validated by `isValidSerializedState`, which requires `ctx.phase`, `currentPlayer`, `numPlayers`, `playOrder`, `playOrderPos`, `turn`). Don't add a second persistence path — extend this validator/shape if you add fields to `G` or `ctx`.

---

## 3. Hard-coded map data (`src/data/`)

Cities, routes, and commodities are static reference data — not game state. All three are exported as `Map<string, T>` from `src/data/index.ts` (re-exporting `cities.ts`, `routes.ts`, `commodities.ts`). Keys are stable strings used throughout `G` (e.g. `Contract.destinationKey`, `PlayerProps.activeCities`, `Contract.commodity`).

### Cities — `src/data/cities.ts` (56 entries)

```ts
export interface City {
  id: string;              // 3-letter short code, used in Contract.id
  state: string;
  country: string;
  region: string;           // one of RegionCode: NW | NC | NE | SW | SC | SE
  label: string | null;     // alternate/full display name, e.g. "Portland, Maine"; null if none
  latitude: number;
  longitude: number;
  large: boolean;           // affects city "value" (contract-generation weighting)
  westCoast: boolean;
  nearWestCoast: boolean;   // biases contract-generation direction
  nearEastCoast: boolean;   // biases contract-generation direction
  commodities: string[];    // commodity keys produced here (into `commodities` map)
  routes: string[];         // route keys incident on this city (into `routes` map)
}

export const cities = new Map<string, City>([...]);
```

- **Map key** = city display name (e.g. `"Atlanta"`, `"Portland ME"` — note some cities are disambiguated with a state suffix in the key itself, distinct from `label`).
- Graph traversal (shortest path, "cities connected to", contract generation) uses `city.routes` — see `src/utils/graph.js`.

Example:

```ts
[ "Atlanta", { id: "atl", state: "GA", country: "US", region: "SE", label: null,
  latitude: 33.7491, longitude: -84.3902, large: true,
  westCoast: false, nearWestCoast: false, nearEastCoast: true,
  commodities: ["coal", "cotton", "textiles"],
  routes: ["Atlanta-Birmingham", "Atlanta-Cincinnati", "Atlanta-Raleigh", "Atlanta-Savannah", "Atlanta-Tallahassee"] } ]
```

### Routes — `src/data/routes.ts` (105 entries)

```ts
export interface Route {
  length: number;         // segment count, 1–5; each segment = $3,000 of contract value
  mountainous: boolean;   // blocks some contract-generation paths (see routeTestFn usage in Contract.ts)
  cities: string[];       // exactly two city keys (into `cities` map)
}

export const routes = new Map<string, Route>([...]);
```

- **Map key** = `"CityA-CityB"` (city keys joined by a hyphen).
- **Consistency requirement:** every route should also be listed in `cities` for *both* endpoint cities' `routes` array, or it becomes unreachable via `citiesConnectedTo`/graph traversal. When adding a route, update both city records.

Example:

```ts
[ "Atlanta-Birmingham", { length: 1, mountainous: false, cities: ["Atlanta", "Birmingham"] } ],
[ "Bismarck-Butte",     { length: 5, mountainous: true,  cities: ["Bismarck", "Butte"] } ],
```

### Commodities — `src/data/commodities.ts` (25 entries)

```ts
export interface Commodity {
  regions: string[];   // RegionCode values where this commodity can be sourced (used for regional-office contract generation)
  cities: string[];     // producing city keys (denormalized — keep in sync with each City.commodities)
}

export const commodities = new Map<string, Commodity>([...]);
```

- **Map key** = commodity name, also the value stored in `Contract.commodity`.
- Full key list: `aluminum, bauxite, cattle, coal, copper, cotton, fish, fruit, grain, imports, iron ore, lead, machinery, nickel, oil, pork, precious metals, rice, sheep, steel, textiles, tobacco, tourists, wine, wood`.
- **Consistency requirement:** `commodities.get(x).cities` should match the set of cities whose `commodities` array contains `x`. When adding/removing a commodity from a city, update both sides.
- UI icons are mapped separately in `src/shared/assets/icons.js` (`commodityIcons`, keyed by the same commodity strings).

---

## 4. Extending this data

- **New city/route/commodity:** add to the relevant `Map` in `src/data/`, and update the cross-references described above (city ↔ route, city ↔ commodity). No other file needs to enumerate them — `graph.js` and `Contract.ts` traverse the maps directly.
- **New field on `G` or `ctx`:** add it to `GameState`/`GameContext` in `src/stores/gameStore.ts`, update `getInitialState`, and extend the persisted shape in `src/utils/stateSerialization.js` (and its validator) if it needs to survive save/reload.
- **New per-player field:** add to `PlayerProps` in `src/stores/gameStore.ts`; initialize it in `getInitialState`'s `players` construction.
- **New contract field:** add to `Contract` in `src/Contract.ts`; update `newContract()` to set a default, and `stateSerialization.js` if persistence needs validation beyond the generic `unknown[]` for `contracts`.
- Do not add a second source of truth for any of the above — see [AGENTS.md](../AGENTS.md) anti-patterns.
