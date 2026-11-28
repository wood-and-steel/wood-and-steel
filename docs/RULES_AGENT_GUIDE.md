# Game Rules — Agent Guide

**Audience:** AI agents writing, maintaining, or testing code for the player app, the playtest board app (`/board`), or the playtest bots (`src/bots/`).
**Purpose:** Everything about the rules that the [rulebook](rulebook/Wood%20and%20Steel%20Rulebook.md) doesn't tell you: which rules the code enforces, which it trusts the table for, which aren't built, what the code calls things, and what to touch when a rule changes.

Read the rulebook first. This guide doesn't restate rules; it says where they live and how far the code follows them.

---

## Sources of truth

| Question | Source |
|---|---|
| What are the rules? | [rulebook/Wood and Steel Rulebook.md](rulebook/Wood%20and%20Steel%20Rulebook.md). The [Quick reference](rulebook/Quick%20reference.md) repeats its numbers. |
| What's still undecided? | The ⚑Q questions in [rulebook/EDITOR_NOTES.md](rulebook/EDITOR_NOTES.md). Don't pick an answer in code without asking Jeff; if code must choose, mark it `DEFAULT` (see [BOT_AGENT_GUIDE.md](BOT_AGENT_GUIDE.md), Rules defaults). |
| What are the numbers? | `src/rules/rulesData.ts` (prices, limits, debt service, bonuses) and `src/rules/playerBoard.ts` (engine and upgrade reference data). Never hard-code a rules number anywhere else. |
| How are contracts valued and generated? | [Contract generation.md](Contract%20generation.md) and `src/Contract.ts`. |
| What does game state look like? | [GAME_DATA_SCHEMA.md](GAME_DATA_SCHEMA.md) and `src/stores/gameStore.ts`. |
| Why is the player app shaped this way? | [PLAYER_APP_REDESIGN_PLAN.md](PLAYER_APP_REDESIGN_PLAN.md), Decisions. |

When the rulebook and the code disagree, don't quietly "fix" either one. The rulebook tells players to play what the app allows during playtest, so a disagreement is a question for Jeff. Known ones are listed under [Gaps](#gaps-between-the-rulebook-and-the-code).

---

## Who tracks what

The game is split between the physical table and software. Most rules bugs come from code that assumes it knows something only the table knows.

| Lives on | What | Code |
|---|---|---|
| The table only | Each player's track, where engine tokens are, Railyard cities, the black independent-railroad lines, which actions a player has taken this turn | none (the board app keeps a playtest copy) |
| Player app, in `G`/`ctx` | Contracts and the Market; each player's cash, debt, engine types, optional cargo, upgrades, Hub city, Regional Office region, Exchange commodity; active cities; independent railroads; turn, round, play order | `src/stores/` |
| Board app (playtest only) | A digital copy of the table: track, token positions, Railyard cities | `src/board/`, `board_states` table ([BOARD_AGENT_GUIDE.md](BOARD_AGENT_GUIDE.md)) |
| Bots (playtest only) | A bot's own track, engine positions and plans | `src/bots/`, `bot_states` table ([BOT_AGENT_GUIDE.md](BOT_AGENT_GUIDE.md)) |

Design principles that follow from this, all decided by the designer:

- **Nothing is recorded twice.** Players never report track, engine positions or Railyard cities to the player app. Cargo is optional: a contract must be fulfillable with no cargo recorded. Don't build a flow that needs any of these as input.
- **The player app never knows a player's network.** It can't check that track connects, that an engine can reach a city, or that a player qualifies for a Regional Office or Commodities Exchange. It trusts the player. Don't show network data in the player app.
- **Cash never goes negative.** A move the player can't afford is refused; the Loans button is the way out. Never combine borrowing with a purchase.
- **The app doesn't count actions.** It doesn't enforce two actions per turn or once-per-turn limits.
- **No track cost calculator.** Players type what their track cost (Pay for track).
- **Money is public.** Private contracts and unchosen offers are the only hidden information.

### The bots

Bots play by the same rules, but they have to do the table's job too, so they enforce what the player app trusts: they model their own track, engine positions, movement, track prices and connections (`src/bots/engine/`), and record them on the board app. They change `G`/`ctx` only through the same moves a player uses, and read rules numbers from `src/rules/` (`src/bots/engine/rulesData.ts` re-exports `rulesData.ts`). So a rule the player app leaves to the table still needs code in the bots. Two tests tie the bots to the rules: `coverage.test.ts` (every rulebook action and upgrade, and every move, is labeled) and `rulesFingerprint.test.ts` (see [Changing a rule](#changing-a-rule)). Details: [BOT_AGENT_GUIDE.md](BOT_AGENT_GUIDE.md).

### Active cities

`PlayerProps.activeCities` is the app's stand-in for a network it can't see. It holds:

- the two starting cities,
- every destination the player has delivered to (`toggleContractFulfilled`),
- every city of an independent railroad they acquired (`acquireIndependentRailroad`),
- cities added by hand in the playtest edit dialog (`addCityToPlayer`).

Contract generation uses it to pick commodities and destinations near the player. It is **not** the player's network: it misses cities the player has built to but not delivered to. Never use it to decide what a player may legally do. Players never see the term.

---

## Terms in code

| Rulebook | Code |
|---|---|
| Route | A route key such as `"Boston-New York"` in `src/data/routes.ts`. The rules and UI also say **segment**; they mean the same thing. A route's `length` (1–5) only sets its build price; movement, build limits and Hub/Railyard/Roundhouse ranges count routes. |
| Mountain Route | `mountainous` on the route |
| Region | `RegionCode`: `NW NC NE SW SC SE`. Central = `NC SC`, Western = `NW SW` (`CENTRAL_REGIONS`, `WESTERN_REGIONS`). `cityRegion()` in `src/rules/regions.ts`. |
| Railroad Ties | "ties". Per contract: `railroadTieValue()`; per acquisition: `ACQUISITION_TIES` × `railroadsAcquired`. |
| Engine, light / dark token | `EngineSlot` `0` (light) / `1` (dark). `engines: [EngineTypeId \| null, EngineTypeId \| null]`, `cargo` likewise. |
| Engine level | `engineLevel()`; John Bull = 0, Challenger = 8 |
| Private Contract | `Contract` with `type: 'private'` |
| Market Contract (open) | `type: 'market'`, `playerID: null`, not fulfilled. The open ones are the tableau (`openMarketContracts()`, `MARKET_TABLEAU_SIZE` = 3). |
| Claimed Market Contract | `type: 'market'` with `playerID` set |
| Countdown ("3 rounds left") | `roundsLeft` on an open market contract |
| Debt Service history | `centralDebtServicePaid`, `westernDeliveryMade` on the player |
| Upgrade | `UpgradeKey` in `rulesData.ts` (`'service-yard'`, `'hub'`, …). Hub and Regional Office are stored as `hubCity` and `regionalOffice`, not in `upgrades`. Commodities Exchange is `'commodities-exchange'` in `upgrades` plus `exchangeCommodity`. |
| Undo | `undoCurrentTurn()` in `gameStore.ts`; restores `turnStartSnapshot` |
| Round | `ctx.round`, starting at 0. Turns are `ctx.turn`. |

---

## Actions and what the code checks

Every rules action, the app control that records it, the move behind it, and how much of the rule the move enforces. "Trusts" means the rule is real but only the table can check it. Moves always act for `ctx.currentPlayer`; the UI only shows them on your turn.

| Rulebook action | Player app | Move(s) | Checks | Trusts the table for |
|---|---|---|---|---|
| Run Trains | Press a contract to fulfill it; pickup and cargo are optional | `toggleContractFulfilled`, `setCargo` | The contract is the player's (a market one must be claimed); debt service is payable from payout plus cash | Movement, range, network, each engine running once, the engine being in the destination with the commodity |
| Build Track | Actions → Pay for track | `payForTrack` | A positive amount, in $1,000s, within cash | Route prices, parallel and Hub costs, connection, the 2- or 3-route limit |
| Buy an Engine | Actions → Buy an engine | `buyEngine` | One level above best (two with a Hub, +$5,000), trade-in value, at most 2 engines, cash. Opens the Market on the first Mogul-or-better anyone buys. | Placing a new token on the player's network |
| Buy an Upgrade | Actions → Buy an upgrade | `buyUpgrade` | Once each; Service Yard only after anyone owns a Consolidation; Hub city not another player's Hub; Regional Office region not another player's; monopoly commodity not taken and monopolizable; cash | Hub/Railyard city in the network; Regional Office's 5 cities and nobody else's routes; Exchange's connection to every supplier |
| Acquire an Independent Railroad | Actions → Acquire a railroad | `acquireIndependentRailroad` | Price (`$3,000`/route, `$4,000` after any Western delivery), cash. Awards the tie and adds its cities to active cities. | That one of its cities is in the player's network |
| Borrow Money | Loans | `borrow` | Multiple of $5,000 | — |
| Repay Debt | Loans | `repay` | $5,000 or $10,000, debt ≥ $20,000, never below $15,000, cash | — |
| Discard and Draw a New Contract | Actions → Discard and draw new contract | `replacePrivateContract` (bots: `deleteContract` + `addContract`) | — | — |
| Go First Next Round | Actions → Go first next round | `goFirstNextRound` | Nobody has taken it this round | — |

Free actions:

| Rulebook | Move | Notes |
|---|---|---|
| Pick up a Commodity | `setCargo` (optional) | The app doesn't know where engines are, so it can't check a pickup. |
| Claim a Market Contract | `claimMarketContract` | Checks Mogul or better and one claimed contract at a time; stops its countdown and deals a replacement. Optionally records cargo. Doesn't check that the commodity was picked up. |
| Record Cargo | `setCargo` | Cleared automatically on delivery when it matches. |
| Undo | `undoCurrentTurn` | Restores the whole turn, including the money log. |

When a private contract is fulfilled, the app shows offers from `generatePrivateContractOffers()` and the chosen one is added with `addContract`.

### Upgrades in the app

The app records each upgrade and its cash; most effects happen on the table.

| Upgrade | Effect the app applies | Effect left to the table |
|---|---|---|
| Service Yard | — | +1 range |
| Upgraded Stations | +$3,000 per delivery (`deliveryBreakdown`) | — |
| Hub | +1 private offer; Hub city and its neighbors weighted up in contract destinations; engine skip in `enginePurchaseOptions` | Track discount (players include it in what they pay) |
| Timetable | — | Keeps moving after a delivery |
| Roundhouse | — | The relay |
| Employment Office | — | 3 routes per Build Track |
| Railyard | — (no city recorded; contract generation ignores Railyards) | Supplies nearby commodities |
| Regional Office | +1 private offer naming a commodity from its region | +2 ties at game end (not computed) |
| Commodities Exchange | Records the commodity and keeps it exclusive | Monopoly ties (not computed); the contract weighting isn't built (⚑Q13) |

The Mountain and Challenger 1⅓× bonus is in `deliveryBreakdown`. When the player's two engines would pay differently, the delivery receipt asks which engine delivered (`deliveringEngineMatters`).

---

## Turns, rounds and phases

Phases are `waiting_for_players` → `setup` → `play` → `scoring` (`src/stores/phaseConfig.ts`; see [PHASES_AGENT_GUIDE.md](PHASES_AGENT_GUIDE.md)). Setup ends when every player has a private contract. `scoring` is a stub: nothing moves the game into it.

`endTurn` (`src/stores/events.ts`) runs the phase's `turn.onEnd`, moves to the next player in `ctx.playOrder`, clears the turn's money log, and takes the next Undo snapshot. When the last player in order ends their turn, the `play` phase's hook ends the round, in this order:

1. Market countdowns tick, expired contracts are replaced, and maybe one new countdown starts (`advanceMarketExpirations`; chance and guarantee constants in `Contract.ts` and `marketExpiration.ts`). This does nothing until the Market has opened.
2. Independent railroads grow (`growIndependentRailroads`), except at the first round end, which only sets `ctx.round` to 1. They never take a mountainous route of length 4 or more.
3. `G.roundReport` is built by diffing the state before and after (`roundReport.ts`).
4. If someone took Go first next round, `ctx.playOrder` is rotated so they lead (`rotatedToStart`), and `G.goFirstNextRound` is cleared.

Randomness (contract generation, market expiration, railroad growth) lives in the app, never on the table. Functions that roll take an injectable `random` where tests need it.

---

## Money and deliveries

- All amounts are dollars, in multiples of $1,000; debt is in multiples of $5,000.
- `deliveryBreakdown()` (`src/rules/finance.ts`) is the single source for a delivery's money: contract value, engine bonus, Upgraded Stations, debt service, net, and whether it's `affordable`. The receipt, the move and the bots all use it. The contract values the app shows are net of debt service.
- Debt service depends on `centralDebtServicePaid` and `westernDeliveryMade`, which the delivery updates.
- Every money change adds a line to `G.turnLedger` ("Money this turn" in Actions). The bot runner looks for the `LEDGER_LABELS` to resume a turn safely, so keep those labels stable.

---

## Scoring and the end of the game

The app shows each player's ties from fulfilled contracts plus acquisitions. It computes nothing else:

- The end of the game isn't detected; `GAME_END_TIES` is used only by the bots. Players notice it themselves.
- No end-of-game bonus is computed: breadth, depth, Monopoly, Regional Office, Challenger, West Coast. Players count them at the table.
- There are no tiebreakers in code.

The bots compute their own estimate in `src/bots/engine/scoring.ts`, using the formulas in `rulesData.ts` (`breadthBonus`, `depthBonus`, `MONOPOLY_TIES`, …). It doesn't score the West Coast bonus.

---

## Gaps between the rulebook and the code

Rules the rulebook describes that the code doesn't do, or does differently. Check this list before assuming a rule is built, and update it when you build one.

| Rule | State |
|---|---|
| Bankruptcy | Not built. A delivery the player can't pay for is refused; they must borrow first. |
| End of the game, end-of-game bonuses, tiebreakers | Not built (see above) |
| West Coast bonus (+3 at game end for building to a West Coast city) | Not computed by the app or the bots' scorer |
| Monopoly contract weighting (40/50/60%) | Not built (⚑Q13) |
| Connection bonuses | Dropped from the rulebook; not built (⚑Q4) |
| Discarding a claimed Market Contract | The app's contract menu allows it (`deleteContract`); the rules don't mention it (⚑Q8). |
| John Bull effect text | `playerBoard.ts` still says it must be traded in for the American; the rules let you keep it. |

---

## Playtest-only moves

These moves exist for testing and fixing games, not for players following the rules. Don't call them from normal rules flows, and don't build rules on them.

| Move | Used by |
|---|---|
| `addCityToPlayer` | Playtest edit dialog |
| `claimHubCity`, `claimRegionalOffice` | Free edits; the real path is `buyUpgrade` |
| `setPlayerBoard` | Playtest edit dialog: correct cash, debt, engines, cargo, upgrades |
| `fillMarketTableau` | The +M button; the real path is the first Mogul purchase |
| `generatePrivateContract`, `generateMarketContract` | Developer tools |

[`src/bots/rules/coverage.ts`](../src/bots/rules/coverage.ts) labels every move, and is a good map of which are real.

---

## Changing a rule

1. **Get the rule from Jeff**, and update the [rulebook](rulebook/Wood%20and%20Steel%20Rulebook.md) and [Quick reference](rulebook/Quick%20reference.md). Remove the ⚑Q from [EDITOR_NOTES.md](rulebook/EDITOR_NOTES.md) if it answers one.
2. **Numbers** go in `src/rules/rulesData.ts`; pure rule logic in `src/rules/` (no stores, no React). The player app, the board app and the bots all import from there.
3. **Moves** go in `src/stores/gameActions.ts`, listed in `MOVES_BY_PHASE` (`src/stores/moveValidation.ts`). Refuse with a `console.warn` and `return false`, like the existing moves. Add a ledger line for any money change.
4. **Player app copy:** action labels and upgrade one-liners in `src/components/ActionsSheet.tsx`, the delivery receipt, the round report.
5. **Board app** if it shows the thing (read-only; see [BOARD_AGENT_GUIDE.md](BOARD_AGENT_GUIDE.md)).
6. **Bots:** `rulesFingerprint.test.ts` fails whenever the rulebook, this guide, the map data, `playerBoard.ts` or `MOVES_BY_PHASE` changes, and `coverage.test.ts` fails when an action or upgrade heading in the rulebook (each `###` under `## Actions` and `## Upgrades`) or a move is added or renamed. Follow [BOT_AGENT_GUIDE.md](BOT_AGENT_GUIDE.md), Rule changes.
7. **This guide:** the action table, the upgrade table and the gaps.

---

## Testing

```bash
npm test
npm run typecheck
```

| Area | Tests |
|---|---|
| Rules numbers and functions | `src/rules/*.test.ts` |
| Moves: money, engines, upgrades, Undo, End turn | `src/stores/playerBoardMoves.test.ts` (its `setUp()` puts player 0 in `play` with starting cities and a snapshot) |
| Market claiming and expiration | `src/stores/marketContracts.test.ts`, `marketExpiration.test.ts` |
| Go first, round report | `src/stores/goFirst.test.ts`, `roundReport.test.ts` |
| Contract generation, railroad growth | `src/Contract.test.ts`, `src/independentRailroads.test.ts` |
| Player app sheets | `src/components/*.test.tsx` |
| Bots' rules and scoring | `src/bots/engine/*.test.ts`, `src/bots/rules/*.test.ts` |

To try a rule end to end, `npm start` and open a game with bots ([BOT_PLAN.md](BOT_PLAN.md)), watching it on `/board`. `npm run bots:tournament` plays whole bot games headless, which is the quickest way to see how a rules change shifts strategy.
