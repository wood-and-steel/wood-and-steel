# Bot Players Plan

Adds computer-controlled players ("bots") that play Wood and Steel alongside humans. The host adds bots on the waiting-for-players screen; they take turns through the same moves a human uses, appear in the app as ordinary players named like "Avery (bot)", and narrate their last turn in their `/board` tray card. Bot-only games (no humans) come later and are not part of this plan, but the design leaves room for them and for running bots on a server.

Current conventions: [BYOD_AGENT_GUIDE.md](BYOD_AGENT_GUIDE.md) (seats), [BOARD_AGENT_GUIDE.md](BOARD_AGENT_GUIDE.md) (board state and trays), [PHASES_AGENT_GUIDE.md](PHASES_AGENT_GUIDE.md) (moves and phases).

## Decisions (from Q&A, 2026-11-09)

| Topic | Decision |
|---|---|
| Availability | **Playtest only.** Bots ship where `/board` ships (`__INCLUDE_BOARD__`: `development`, `test`, `board` modes) and never in `npm run build`. The digital `/board` is the map of record in a bot game. |
| Core game logic | **Unchanged.** No edits to `gameActions`, `moveValidation`, `phaseConfig`, `phaseManager`, `events`, or `Contract`. Bots call the existing moves. |
| Adding bots | Host only, on the waiting-for-players screen. A bot fills an open seat; the host can remove it before starting. |
| Strategy choice | Host picks one of six strategies per bot; the default is **Random**. |
| Names | Drawn from the gender-neutral name list below, shown everywhere as `Name (bot)`. |
| Who runs bot turns | **The host's app**, for now. Bot logic is written against small interfaces ("ports") so it can move to a server later without a rewrite. |
| Decision maker | **Heuristic** player built on a shared **bot engine**. An LLM agent player may come later, behind the same interface, using the engine's calculators as tools. |
| Personalities | Six strategies. Each sets a **range** per weight; a bot's weights are drawn at random within its strategy's ranges. Per-turn variability picks among near-best plans. |
| Narration | **Templated, plain descriptions.** No character voices. The tray shows the bot's last turn. |
| Bot-private state | New Supabase table **`bot_states`** (one row per game), not `board_states` and not `G`. |
| Physical-table state | Bot track, engine positions and types, cargo, Railyard, and upgrades are written to `board_states` with the existing `BoardOp`s, so the phase 2 trays show them with no new code. |
| Go first next round | Not implemented in the app; **bots never choose it**. |
| Bankruptcy | Auctions aren't implemented; **bots avoid bankruptcy** (no delivery whose debt service they can't pay). |
| Undo | Humans can't undo a bot's turn. |
| New engine placement | A new (not traded-in) engine goes in any city on the bot's network, per the clarified rules. The bot picks the city its plan needs. |
| Rule changes | Covered by `docs/BOT_AGENT_GUIDE.md`, a move/rule **coverage map** in code, and a **rules fingerprint** test that **fails** when the rules change until the bots are reviewed. Git is the ledger. |

## Architecture

### Layers

```
                ┌──────────────────────────── src/bots/ ────────────────────────────┐
                │                                                                   │
 G/ctx (store) ─┤  ports/      GamePort · BoardPort · BotStatePort · Clock · Rng    │
 board_states ──┤     │                                                             │
 bot_states ────┤     ▼                                                             │
                │  engine/     world model, costs, paths, finances, valuation,      │
                │              legal actions, action application   (pure)          │
                │     ▼                                                             │
                │  heuristic/  strategies, weights, plan generation, scoring,       │
                │              choice                                (pure)          │
                │     ▼                                                             │
                │  runner/     turn loop, pacing, resume, narration log             │
                │     ▼                                                             │
                │  host/       port implementations for the host's browser,         │
                │              BotRunner component, seat controls                   │
                └───────────────────────────────────────────────────────────────────┘
```

- **`engine/` and `heuristic/` are pure.** They import no stores, React, Supabase, `localStorage`, or `window`, and take randomness from an injected `Rng`. They read a `BotWorld` snapshot and return decisions and narration lines.
- **`runner/`** drives one bot turn through the ports. It knows nothing about browsers.
- **`host/`** is the only browser-specific layer. A future server runner replaces `host/` with Supabase-backed ports and reuses everything else.
- The tournament harness (M7) supplies in-memory ports.

### Ports

| Port | Host implementation | Purpose |
|---|---|---|
| `GamePort` | Reads `useGameStore`; calls the existing moves (`createMoves`) and pure helpers such as `generatePrivateContractOffers`. Resolves each move only once its save has landed (see Risks). | Read `G`/`ctx`; apply moves |
| `BoardPort` | Loads `board_states`, seeds the row from `G` if missing (`seedBoardState`), applies a `BoardOp` with the same conditional-save and re-apply loop as `boardSync` (factored into a shared helper in `src/board/`). | Read and write board state |
| `BotStatePort` | `bot_states` adapter with conditional saves and realtime, modeled on `boardStateAdapter`. | Bot-private state and narration |
| `Clock`, `Rng` | Timers; a seeded generator stored per bot. | Pacing; reproducible choices |

### Isolation and gating

- All bot code lives in **`src/bots/`**. `App.tsx` imports it only through lazy imports behind `__INCLUDE_BOARD__`, exactly as it does for `/board`.
- `src/bots/` may import from `src/board/` (ops, adapter, `playerBoardData`, seeding) because both are playtest-only.
- `src/board/` may import only the **read side** of bot state (`bots/state/` types, normalizer, adapter) to show narration. The board still never writes `G`/`ctx`.
- `scripts/check-board-build.mjs` also checks that the production build contains no bot code.
- `bot_states` is a documented exception in `AGENTS.md`, like `boardStore`: it holds no `G`/`ctx` data.

## Seats and the waiting screen

**Metadata.** A bot seat is an ordinary entry in `metadata.playerSeats`, keyed `bot:<uuid>` instead of a device ID:

```ts
interface PlayerSeat {
  joinedAt: string;
  playerName: string;        // "Avery (bot)"
  playerID?: string;
  bot?: { name: string; strategy: StrategyId };   // new; absent for humans
}
```

`allPlayersJoined`, `getNumPlayersJoined`, and `assignRandomPlayerIDs` already count every seat, so bots fill seats and get shuffled play-order IDs with no changes. `handleStartBYODGame` already copies `seat.playerName` into `G.players`, which is how "Avery (bot)" shows everywhere in the app with **no UI changes during play**.

**`gameManager.ts` additions** (the only place seats live, per `AGENTS.md`):

- `addBotSeat(code, hostDeviceId, { name, strategy })` checks that the caller is the host, the game hasn't started, and a seat is open; returns the new seat. It takes the name and strategy as arguments, so `gameManager` imports nothing from `src/bots/`.
- `removeBotSeat(code, hostDeviceId, seatKey)` is host only, works before start only, and removes bot seats only.
- `isBotSeat(seat)` helper. Covered in `gameManager.test.ts`.

**`WaitingForPlayersScreen.tsx`:**

- Bot seats appear in the players list like any other seat, by name ("Avery (bot)").
- A new optional prop, `botSeatControls`, takes the host's bot controls. `App.tsx` lazy-loads `BotSeatControls` from `src/bots/host/` behind `__INCLUDE_BOARD__` and passes it in; the screen renders it for the host only. The control is a **Bots** section listing each bot with its strategy and a **Remove** button, then a strategy select (Random, then the six strategies) and an **Add bot** button, disabled when no seat is open. Keeping the list in the bot component keeps strategy labels out of core code.
- **Random** is resolved when the bot is added. Random avoids strategies already in the game until all six are used. The name is drawn from the list, avoiding names already used by any seat, compared case-insensitively and ignoring "(bot)".
- Humans can't rename bots, and bot seats have no device, so the device-not-playing checks don't apply to them.

**Names** (from the provided list): Adrian, AJ, Alex, Ashley, Ariel, Avery, Baraka, BJ, Brooke, Calypso, Cameron, Carey, Casey, Chris, Cielo, CJ, Dakota, Dana, Darby, DJ, Duri, Eka, Fadhili, Geni, Hao, Hazuki, Hunter, Hye, Imani, Ira, Itsuki, Jamie, Jela, Jesse, Jordan, Kelly, Kim, Kris, Kurumi, Maki, Malaika, Masumi, Max, Midori, Minh, Misha, Mitsuyo, Montana, Morgan, Nanda, Nat, Nata, Panca, Piper, Putu, Quinn, Ren, Riziki, Robin, Rosario, Sage, Sam, Santana, Sidney, Sydney, Sky, Taylor, Toan, Tracey, Trung, Waridi, Yoshika, Zola, Zuri. They live in `src/bots/names.ts`.

## Bot state: `bot_states`

One row per game code (`code`, `state jsonb`, `updated_at`), with SQL in `src/bots/supabase/bot_states.sql`. It has the same anon RLS policies and realtime publication as `board_states`, and saves are conditional on `updated_at`. Jeff applies the SQL by hand in the Supabase dashboard.

```ts
interface BotStatesRow {
  version: 1;
  bots: Record<string /* playerID */, BotRecord>;
}

interface BotRecord {
  name: string;                 // "Avery"
  strategy: StrategyId;
  weights: Weights;             // drawn once, at first run
  rngState: number;             // seeded generator state, saved after each use
  cash: number;                 // dollars, like moneyValue()
  debt: number;
  centralDebtServicePaid: boolean;  // one-time Central-region service
  westernDeliveryMade: boolean;     // ongoing service from then on
  deliveries: Record<string /* commodity */, number>;   // breadth and depth bonuses
  exchangeCommodity: string | null; // Commodities Exchange choice (the board records bought or not, not which)
  plan: BotPlan | null;         // current multi-turn intent, kept between turns for stickiness
  turnInProgress: { turn: number; steps: string[] } | null;  // for resume after reload
  log: BotTurnLog[];            // newest last; keep the last 20 turns
  runnerSeenAt: string;         // heartbeat from the host's runner
}

interface BotTurnLog { round: number; turn: number; lines: string[] }
```

- The row is created by the host's runner when the game first leaves `waiting_for_players`. One record per bot seat is created from the seat's name and strategy. That is when the weights are drawn and $10,000 cash is set, as in setup.
- `normalizeBotStates` tolerates missing and malformed fields and refuses newer versions, like `normalizeBoardState`.
- The Supabase adapter is the board's, generalized: `src/board/jsonRowAdapter.ts` holds the one-JSON-row-per-game adapter used by both `board_states` and `bot_states`. `updateBotStates` does read-modify-write with the same conflict, reload and re-apply loop as board saves, so every change to bot state must be re-appliable.
- Weight bands per strategy (`heuristic/weights.ts`) and the seeded generator (`rng.ts`) land with M2, because a record's weights are drawn when it is created.
- Human money is not tracked anywhere. Bots estimate opponents from `G` (contracts, ties, Hubs, Regional Offices) and the board (track, engines, upgrades).

## Bot engine (`src/bots/engine/`)

The engine builds a `BotWorld` from `G`/`ctx`, the board state, and the bot's record. It answers everything the policy needs with exact numbers:

- **Map and paths:** the route graph from `src/data/routes.ts`, including length, mountainous flags, and shortest and cheapest paths over owned track, buildable routes, and parallel slots. Independent railroad routes can't be built on.
- **Costs:** the track cost table (mountainous, parallel, Hub discount within two links), engine prices and trade-in values, the one-level-up limit (two with a Hub, +$5,000), upgrade prices, and independent railroad prices ($3,000 or $4,000 per route after the first Western delivery).
- **Finances:** contract payout (`moneyValue`), Upgraded Stations +$3,000, the Mountain and Challenger 1⅓× bonus, debt service by region history, borrowing in $5,000 steps, and repaying $5,000 or $10,000 down to a $15,000 floor.
- **Engine placement:** a newly bought engine that isn't a trade-in goes in any city on the bot's network, chosen by its plan (usually the next pickup city). A replacement takes the old engine's city, as the rules say.
- **Movement:** engine distance (`engineDistance`, including the Service Yard bonus), pickup en route, a delivery ending movement unless the bot has a Timetable, Roundhouse transfers, and Railyard supply within two segments.
- **Scoring:** fulfillment ties (`railroadTieValue`), commodity breadth and depth bonuses, monopoly ties, Regional Office end-of-game ties, and the Challenger's 2 ties. The app doesn't track the bonuses yet, so the engine scores them itself from the rules.
- **Availability rules:** market contracts need a Mogul or better; Service Yard needs a Consolidation owned by any player; one Hub per city; Regional Office eligibility; at most two engines; per-turn action limits (one or two actions, only Run Trains repeated, each engine run once).
- **Legal actions and application:** `listActions(world)` and `applyAction(world, action)` work on a copy, so the policy can try sequences. Each action also yields its **effects**: app moves, board ops, bot-record changes, and narration lines.

Rules constants the board doesn't already hold (prices, cost table, debt service, tie bonuses) live in `engine/rulesData.ts`. Names and distances come from `src/board/playerBoardData.ts`.

### Actions mapped to effects

| Action | App moves (`GamePort`) | Board ops (`BoardPort`) | Bot record |
|---|---|---|---|
| Choose starting cities (setup) | `generateStartingContract(pair, playerID)` | Starting route is seeded by the board as today | Cash $10,000 |
| Run trains | On delivery, `toggleContractFulfilled`. For a private contract, `generatePrivateContractOffers` then `addContract(…, 'private')`, buying a Hub or Regional Office through `claimHubCity` / `claimRegionalOffice` when the policy chooses. For a market contract, the same claim sequence the Contracts tab uses. | `moveEngine`, `setCargo` | Cash, debt service, deliveries |
| Pick up (free, any time an empty engine is in a supplying city) | `claimMarketContract` if claiming | `setCargo` | (none) |
| Build track | (none) | `claimRoute` per segment (parallel adds an owner) | Cash |
| Buy engine | (none) | `setEngineType`; for a new (not traded-in) engine, `moveEngine` to a city on the bot's network (a trade-in keeps the old engine's city and cargo) | Cash |
| Acquire independent railroad | `acquireIndependentRailroad(name)` | Board's existing acquisition reconciliation | Cash |
| Borrow / repay | (none) | (none) | Cash, debt |
| Buy upgrade | Hub: `claimHubCity`; Regional Office: `claimRegionalOffice` | `setUpgrade` for the six tracked upgrades; Railyard: `moveRailyard` | Cash; exchange commodity |
| Discard and redraw private contract | `deleteContract` then offers and `addContract` | (none) | (none) |
| End turn | `endTurn` | (none) | Log entry finalized |
| **Go first next round** | **Never chosen** | | |

## Heuristic player (`src/bots/heuristic/`)

Each turn:

1. **Candidate plans.** For each held contract, claimable market contract, and redraw option, the engine builds a delivery plan: pickup city, path, track to build, engine runs, cost, turns to deliver, money, and ties. Investment plans cover each affordable engine, upgrade, Hub site, Railyard site, independent railroad, and borrow or repay option. A candidate is the next one or two actions plus the multi-turn plan they serve.
2. **Score.** Projected ties and money per turn over the planning horizon, shaped by the bot's weights (table below). Hard constraints: no bankruptcy; never "go first".
3. **Stickiness.** The current `plan` gets a bonus, so the bot doesn't flip-flop between targets. It drops the plan when it becomes impossible, for example when a market contract is taken or a Hub city is claimed by someone else.
4. **Choose.** Keep candidates scoring within a band of the best; the band's width grows with the **variability** weight. Pick among them by weighted random using the bot's `Rng`.
5. **Explain.** Return templated narration lines for the chosen actions.

Search stays shallow: every legal one- or two-action turn is enumerated, then each is valued by the multi-turn plan it advances. No deep game-tree search.

### Weights

Each weight is a number from 0 to 1. Each changes which trade-offs a bot accepts; every bot does the same arithmetic.

| Weight | Low end | High end | Feeds into |
|---|---|---|---|
| Debt tolerance | Borrows only to finish a delivery | Borrows early and heavily | Max debt relative to expected income |
| Planning horizon | Values the next 2–3 turns | Values 10+ turns | Turns counted when valuing plans |
| Payback patience | Buys only what pays back quickly | Buys long-term capability early | Max payback period for engines and upgrades |
| Reach | Dense eastern network | Pushes west | Bonus for Central and Western targets |
| Ties over money | Contracts that pay well | Contracts worth more ties | Mix of ties and money in the score |
| Independent railroad appetite | Builds its own track | Acquires independent railroads | Bonus for acquisitions |
| Competitiveness | Ignores others | Races for Hubs and Regional Offices, blocks | Value of denying opponents |
| Variability | Usually takes the best plan | Often takes a near-best plan | Width of the choice band |

Bands: Low 0.00–0.30, Low–Med 0.15–0.50, Medium 0.35–0.65, Med–High 0.50–0.85, High 0.70–1.00. The exact mapping from each weight to its parameter is set in M5 and tuned in M7.

### Strategies (`heuristic/strategies.ts`)

| Strategy | How it plays |
|---|---|
| **Builder** | Grows outward from its starting cities a segment or two at a time and keeps debt near zero. Buys Upgraded Stations and Employment Office once they pay for themselves. Steady and hard to knock off course. |
| **Speculator** | Borrows early and builds toward the Central and Western regions to chase contracts worth 3–4 ties. Accepts debt service as the cost of reach. Strong or weak game to game. |
| **Consolidator** | Buys independent railroads to get long networks cheaply, ideally before the price rises to $4,000 per route. Buys a Hub and stacks upgrades on that network. |
| **Express** | Keeps a compact network but buys the best engines, plus Service Yard, Timetable and Roundhouse. Wins by delivering more often on a few long trunk lines. |
| **Merchant** | Buys a Mogul early to claim market contracts, and buys Upgraded Stations. Discards and redraws weak private contracts. Builds money first, then turns it into ties late. |
| **Regionalist** | Commits early to one region, puts its Hub in the middle of it, and aims for five cities there for a Regional Office. Goes after a Commodities Exchange monopoly and races anyone building in its region. |

| Strategy | Debt tolerance | Planning horizon | Payback patience | Reach | Ties over money | Indie appetite | Competitiveness | Variability |
|---|---|---|---|---|---|---|---|---|
| Builder | Low | High | Medium | Low | Medium | Low–Med | Low | Low |
| Speculator | High | Med–High | High | High | High | Low | Medium | Med–High |
| Consolidator | Medium | High | High | Medium | Medium | High | Med–High | Low–Med |
| Express | Medium | Low–Med | Med–High | Med–High | Low–Med | Low | Low | Medium |
| Merchant | Low–Med | Low–Med | Low | Low–Med | Low | Low–Med | Medium | Med–High |
| Regionalist | Low–Med | High | Medium | Low | High | Medium | High | Low |

**Signature purchases (added in M5).** Weights alone didn't produce each strategy's signature moves (Express sat on cash instead of buying engines, for example), so each strategy also has *affinities*: multipliers on what a kind of purchase is worth to it (`STRATEGY_AFFINITIES` in `heuristic/strategies.ts`):

| Strategy | Affinities |
|---|---|
| Builder | Upgraded Stations ×1.3, Employment Office ×1.5 |
| Speculator | Engines ×1.2 |
| Consolidator | Independent railroads ×1.3, Hub ×1.4, Upgraded Stations ×1.2, movement upgrades ×1.2 |
| Express | Engines ×2.5, movement upgrades (Service Yard, Timetable, Roundhouse) ×2 |
| Merchant | Upgraded Stations ×1.5, engines ×1.5 |
| Regionalist | Hub ×1.4, Regional Office ×2, Commodities Exchange ×2 |

Strategy and weights are not shown to players. Only the host sees the chosen strategy, on the waiting screen.

## Narration

Lines are built from templates per action (`engine/narration.ts` and the actions that use it). They are terse (changed after M6 on Jeff's request): no subject, since they appear in the bot's own tray card; no articles; "&" for "and"; no final period; and ending the turn isn't narrated. For example:

- "Built Boston–New York & New York–Philadelphia for $5,000"
- "Ran light engine Raleigh to Cincinnati & delivered textiles to Cincinnati for $3,000 less $1,000 debt service"
- "Picked up tourists in New York with light engine, claiming market contract: tourists to Atlanta"
- "Chose private contract: textiles to Chicago"
- "Discarded private contract: coal to Boston"
- "Borrowed $5,000"
- "Bought 2-6-0 Mogul for $7,000, trading in 4-4-0 American"
- "Bought Hub in New York for $15,000"
- "Acquired Erie & Western for $6,000"

The runner appends each line to the turn's `BotTurnLog` as the action completes, so the tray fills in live during the turn.

**Tray (`src/board/PlayerTrays.tsx`):** a bot's card lists the lines of its most recent log entry (the turn in progress while it plays), with no heading. A turn with no moves shows "No moves"; before its first turn, "No turns yet". If `runnerSeenAt` is more than about 30 seconds old while it's the bot's turn, the card says **Waiting for the host's app**. The board reads `bot_states` read-only, by realtime and by re-reading every 10 seconds.

## Runner (`src/bots/runner/`, `src/bots/host/`)

- **Mounting:** `App.tsx` lazy-mounts `BotRunner` when `__INCLUDE_BOARD__` is on, this device is the host, the game has bot seats, and the phase is `setup` or `play`. It renders nothing.
- **Trigger:** when `ctx.currentPlayer` belongs to a bot, the runner runs that bot's turn. It updates `runnerSeenAt` every 10 seconds while mounted.
- **Pacing:** about 1.5 seconds between actions, so people can follow along on the board and in the tray. Consecutive bot turns run one after another.
- **Resume:** before each step the runner records it in `turnInProgress`. After a reload it re-reads `G`, the board, and `bot_states`, skips steps already reflected there, and continues. Moves aren't idempotent (`toggleContractFulfilled` flips), so every step is checked against fresh state before it's applied.
- **Guards:** before each move, the runner rechecks that `ctx.currentPlayer` is still the bot and `ctx.turn` is unchanged. Any mismatch stops the turn without acting.
- **Failure:** if a move or save fails, the bot ends its turn after logging "Avery ended the turn early (sync error)." The runner never retries a move blindly.
- **Host's own turn:** the host plays normally. The runner is idle unless a bot is the current player.

## Rule changes: guide, coverage map, fingerprint

- **`docs/BOT_AGENT_GUIDE.md`**, linked from `AGENTS.md`, covers file layout, ports, invariants, how to add an action or upgrade, how to tune strategies, and the checklist below.
- **`src/bots/rules/coverage.ts`** labels every move in `MOVES_BY_PHASE` and every action and upgrade heading in `docs/Game rules.md` (the `###` entries under Turn actions and the `####` entries under Buy an upgrade) as `used`, `ignored` (with a reason, for example go-first), or `notInApp`. **`coverage.test.ts`** fails if any move or heading is unlabeled, or if a label names something that no longer exists.
- **`src/bots/rules/rulesFingerprint.ts`** stores a SHA-256 of `docs/Game rules.md`, `MOVES_BY_PHASE` (parsed from `moveValidation.ts`, which stays unchanged), `src/data/*.ts`, and `src/board/playerBoardData.ts`; `src/bots/rules/rulesSources.ts` computes it. **`rulesFingerprint.test.ts` fails** when the hash differs, with a message pointing to the guide. `npm run bots:ack-rules` rewrites the hash; it is run deliberately after review, and a typo-only change is committed with a note that it has no bot impact.
- **Diff since the last sync:**

  ```bash
  git diff $(git log -1 --format=%H -- src/bots/rules/rulesFingerprint.ts) -- "docs/Game rules.md" src/stores/moveValidation.ts src/data src/board/playerBoardData.ts
  ```

- **Checklist in the guide:** run the diff; update `rulesData`, the engine, the coverage map, and narration templates; add tests; rerun the tournament and compare with the last results; then acknowledge the fingerprint.

## Tournament harness (`src/bots/tournament/`)

- Headless bot-only games with in-memory ports. They run in Vitest (jsdom) so the **real** moves and store are exercised, with the store reset between games. A file glob keeps them out of the default `npm test` run.
- `npm run bots:tournament -- --games 500 --players 4` mixes strategies across seats and writes a Markdown and CSV summary to `src/bots/tournament/results/`: win rate, ties, deliveries, game length, debt, and purchases by strategy.
- Results are used to tune the weight mappings and narrow any strategy range that produces weak bots, so that every strategy wins a fair share. They also double as a balance check on the game itself.
- The app never ends the game at 30 ties (`play` has no end condition). The harness stops a game when a bot reaches 30 fulfillment ties, or after a round limit.

## Milestones

1. **M1 Seats.** `PlayerSeat.bot`, `addBotSeat`, `removeBotSeat`, `isBotSeat` and tests; names and the strategy list; `BotSeatControls` (bot list with Remove, strategy select, Add bot) with lazy wiring in `App.tsx`. Bots can be seated and the game starts, but bots don't act yet.
2. **M2 Bot state.** `bot_states.sql`, adapter, in-memory test adapter, `normalizeBotStates`, row creation at game start.
3. **M3 Engine.** `BotWorld`, `rulesData`, paths, costs, finances, movement, scoring, `listActions`, and `applyAction` with effects; the coverage map and the rules fingerprint and their tests.
   *Done.* `src/bots/engine/` (`world`, `network`, `costs`, `finance`, `movement`, `scoring`, `actions`, `narration`, `rulesData`) and `src/bots/rules/`. Where the rules are unclear the engine uses a documented default (`rulesData.ts`, and the list in `BOT_AGENT_GUIDE.md`). `listActions` checks every generated run with `applyAction`; on a large late-game network it returns about 1,800 actions in about 120 ms, which is fine for live turns but too slow for M7's tournament, so M5's heuristic should generate candidates from `runOptions`, `buildableRoutes`, and the purchase lists directly rather than scoring all of `listActions`.
4. **M4 Runner and plumbing.** Ports and host implementations, the shared board save helper extracted from `boardSync`, and `BotRunner` with pacing, guards, resume, and narration logging. Uses a minimal policy (setup choice, run and deliver, end turn) to prove the loop end to end.
   *Done.* `src/bots/ports.ts`, `src/bots/runner/` (`runTurn`, `steps`, `basicPolicy`), `src/bots/host/hostPorts.ts`, and `src/board/boardRowOps.ts` (the shared save-op-to-row helper; `boardSync` keeps its own optimistic queue). Before an action's effects run, they're saved as `turnInProgress.pending` in `bot_states`; a resume re-runs them, skipping moves `G` already shows (`isMoveDone`) and re-applying board ops (they're re-appliable). Narration is saved with the pending action's completion in one write. The host's `GamePort` waits for each move's save by comparing the stored game with the store, and re-saves once if an older background save landed last.
5. **M5 Heuristic.** Strategies, weight drawing, plan generation, scoring, stickiness, and choice, replacing the minimal policy.
   *Done.* `heuristic/` (`params`, `plans`, `invest`, `policy`, strategy affinities), `src/bots/policy.ts` (the `Policy` type: it builds its own candidates and returns the bot's plan with each action, which the runner saves), and `runner/simplePolicy.testHelper.ts` (the M4 placeholder, kept for runner tests). Weight mappings: max debt $10,000–$60,000; horizon 3–15 turns; payback 2–12 turns (longer with idle cash over $20,000); a tie worth $2,000–$8,000; the choice band 3–33% of the best score. Bots commit only to plans they can afford, redraw hopeless private contracts (never one whose commodity is aboard, since loads can't be dropped), and may borrow up to $15,000 past their limit only to deliver cargo already aboard. `playthrough.test.ts` plays 20 seeded rounds per strategy through the real runner; across three seeds every strategy delivered 8–18 ties, with distinct purchase patterns. Regional Offices and monopolies haven't appeared in those games yet; M7's tournament will show how often they come up and tune the valuations.
6. **M6 Tray narration.** Last-turn section and waiting-for-host status in `PlayerTrays`, with realtime subscription to `bot_states`.
   *Done.* `src/board/botNarration.ts` (`botTrayInfo`: heading, lines, waiting), `src/board/useBotNarration.ts` (read-only load and realtime for `bot_states`; any error just means no narration), a narration section at the top of each bot's tray card in `PlayerTrays.tsx`, and `.boardBot*` styles in `board.css`. "This turn" while the bot is playing, "Last turn" otherwise; "Waiting for the host's app" when it's the bot's turn and the heartbeat is over 30 seconds old (re-checked every 5 seconds). `botIsolation.test.ts` checks the board imports only `bots/state/botStates` and `bots/state/botStatesAdapter`.
7. **M7 Tournament and tuning.** Harness, summary output, and first tuning pass of the weight mappings and strategy ranges.
8. **M8 Hardening and docs.** Isolation tests; `check-board-build` covering bot code; `BOT_AGENT_GUIDE.md`; updates to `AGENTS.md` (state map exception and docs list), `BYOD_AGENT_GUIDE.md` (bot seats), and `BOARD_AGENT_GUIDE.md` (narration, bot imports); archive this plan with status notes.

## Tests and verification

| File | Covers |
|---|---|
| `src/utils/gameManager.test.ts` | Add and remove bot seats: host only, before start only, full game, remove a human refused; bots counted by `allPlayersJoined` and `assignRandomPlayerIDs` |
| `src/bots/host/BotSeatControls.test.tsx` | Random default; random avoids repeated strategies and names; disabled when full |
| `src/bots/state/botStates.test.ts` | Normalization, version refusal, conditional saves and conflicts, row creation |
| `src/bots/engine/*.test.ts` | Track costs (mountainous, parallel, Hub discount), debt service by region, engine purchase limits and trade-ins, indie pricing before and after a Western delivery, Timetable and Roundhouse movement, bonuses, legal actions, never "go first" |
| `src/bots/heuristic/*.test.ts` | Weight draws stay in range; each strategy shows its signature behavior in staged worlds; seeded choices are reproducible; no bankrupting delivery |
| `src/bots/runner/*.test.ts` | Full turns through in-memory ports; pacing; guard stops on turn change; resume after a simulated reload does not repeat a move |
| `src/bots/rules/coverage.test.ts`, `rulesFingerprint.test.ts` | Every move and rule heading labeled; fingerprint matches |
| `src/bots/botIsolation.test.ts` | App imports bots only lazily from `App.tsx`; `engine/` and `heuristic/` import no stores, React, Supabase, or browser globals; the board imports only the read side of bot state; the board still never writes `G` |
| `src/board/BoardApp.test.tsx` | Bot card shows last turn and waiting-for-host status |

Then run unit tests, typecheck, `npm run check:board-build`, and a short tournament. Play a live game in the browser: host plus one human on two devices, two bots, and `/board` open on a third screen. Check that bot turns play out with narration, and that reloading the host mid-bot-turn resumes correctly.

**Rollout:** apply `bot_states.sql` in the Supabase dashboard before using bots, and reload open board screens.

## Risks

- **Back-to-back saves.** Moves save fire-and-forget, with optimistic concurrency on `lastModified`. Rapid consecutive bot moves from one device could race. The host `GamePort` waits for each save to land (the realtime echo, or `getLastModified` advancing) before the next move, and pacing adds margin.
- **Host app closed or asleep.** Bots pause; the tray says so. A server runner removes this limit later.
- **Board not open.** The bot's `BoardPort` seeds the board row if needed, so bot track is never lost. Independent railroad acquisitions are reconciled when a board screen sees the change, as for humans, so keep `/board` open during bot games.
- **Rules ambiguity.** Where the rules are unclear, the engine picks a documented default in `rulesData.ts` and the guide lists it.

## Not in this plan

- Bot-only games, and starting bot games from the lobby
- A server-side runner (the ports are designed for it)
- An LLM agent player (it would reuse the engine as tools and need a server-side API proxy)
- Character voices in narration
- Go first next round, bankruptcy auctions, and connection bonuses (not in the app)
- Any change to core game logic, or tracking human money

## Open questions (non-blocking; defaults in brackets)

- **Strategy visibility:** show a bot's strategy to non-host players anywhere? [No.]
- **Commodities Exchange commodity:** the board records bought or not, not which commodity. [Kept in `bot_states` and named in narration.]
- **Narration history:** show only the last turn? [Yes. The last 20 turns are stored for debugging.]
