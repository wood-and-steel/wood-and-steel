# Bot Players — Agent Guide

**Audience:** AI agents changing the playtest bots in `src/bots/`, or changing rules, moves, or game data the bots depend on.
**Plan and status:** [BOT_PLAN.md](BOT_PLAN.md). This guide grows with each milestone; it is completed in M8.

---

## Invariants

| Invariant | Description |
|---|---|
| **Playtest only** | Bots ship where `/board` ships (`__INCLUDE_BOARD__`). `App.tsx` reaches `src/bots/` only through lazy imports; `botIsolation.test.ts` and `npm run check:board-build` enforce it. |
| **No core logic changes** | Bots change `G`/`ctx` only by calling the existing moves. Never edit `gameActions`, `moveValidation`, `phaseConfig`, `phaseManager`, `events`, or `Contract` for the bots. |
| **Pure engine** | `src/bots/engine/`, `src/bots/heuristic/`, and `src/bots/rng.ts` import no stores (type-only imports are fine), React, Supabase, or browser globals, so they can run on a server. Enforced by `botIsolation.test.ts`. |
| **Bot-private state** | Cash, debt, plans, and narration live in `bot_states` (`src/bots/state/`). Physical-table state (track, engines, cargo, upgrades, Railyard) goes to `board_states` as ordinary `BoardOp`s. Every change to either must be re-appliable after a save conflict. |
| **Rules tripwire** | `src/bots/rules/rulesFingerprint.test.ts` fails whenever the rules, moves, or game data change. See [Rule changes](#rule-changes). |

## Engine map (`src/bots/engine/`)

| File | Role |
|---|---|
| `rulesData.ts` | Rules numbers the app doesn't hold: costs, prices, debt service, limits, bonuses. Rules defaults are marked `DEFAULT`. |
| `world.ts` | `BotWorld` (one bot's view: `G`/`ctx` slice, whole board, its `bot_states` record, turn bookkeeping) and `buildWorld`. |
| `network.ts` | Map and own-track graphs: BFS, paths, network cities, buildable routes. |
| `costs.ts` | Track cost, engine purchases and trade-ins, independent railroad prices, upgrade availability. |
| `finance.ts` | Delivery payment, debt service, borrow and repay options. |
| `movement.ts` | Engine runs: generating them (`runOptions`, `roundhouseOptions`) and checking paths. |
| `scoring.ts` | Railroad ties, including the bonuses the app doesn't show. |
| `actions.ts` | `Action`, `listActions`, `applyAction` → predicted world plus effects (app moves, board ops, `requestOffers`, narration). |
| `narration.ts` | Plain templates: third person by name, no pronouns. |

A "segment" in the rules is one route between two cities: moves, the two-route build limit, and Hub, Railyard, and Roundhouse ranges all count routes. A route's length (1–5) only sets its cost.

## Rule changes

The fingerprint covers `docs/Game rules.md`, `MOVES_BY_PHASE` in `src/stores/moveValidation.ts`, `src/data/*.ts` (except `index.ts`), and `src/board/playerBoardData.ts`. When `rulesFingerprint.test.ts` fails:

1. **See what changed since the bots were last reviewed:**

   ```bash
   git diff $(git log -1 --format=%H -- src/bots/rules/rulesFingerprint.ts) -- "docs/Game rules.md" src/stores/moveValidation.ts src/data src/board/playerBoardData.ts
   ```

2. **Decide the bot impact** of each change:
   - A new or renamed move, turn action, or upgrade also fails `coverage.test.ts`. Label it in `src/bots/rules/coverage.ts` as `used` (with where), `ignored` (with why), or `notInApp`.
   - New or changed numbers: update `engine/rulesData.ts`.
   - New or changed mechanics: update the engine module that owns them (table above) and its tests. Add narration for any new action.
   - Map data changes (routes, cities, commodities) usually need nothing beyond the tests passing.
   - Wording-only changes: no bot change.
3. **Rerun the tests and, once it exists (M7), the tournament**, and compare strategy results with the last run.
4. **Acknowledge:** `npm run bots:ack-rules` rewrites `src/bots/rules/rulesFingerprint.ts`. Commit it with the bot changes, or on its own with a note that the change has no bot impact. Never run it just to silence the test.

## Rules defaults

Where the rules are unclear, the engine follows these defaults (all in `engine/rulesData.ts` unless noted). Ask Jeff before changing one, and update this list.

| Topic | Default |
|---|---|
| Building | New track must touch the builder's network (or a route built earlier in the same action). |
| Parallel track | Every owner after the first pays the $1,000 parallel surcharge (a route allows four owners). |
| Hub track discount | A route qualifies if one of its cities is the Hub or next to it. The $1,000 comes off after mountain doubling, never below $1,000. |
| John Bull | Always the engine traded in by the next purchase. |
| Service Yard | Open once any player owns a Consolidation **or better**. |
| Mountain and Challenger value | 1 1/3x the contract value, rounded down to $1,000, before the Upgraded Stations $3,000. |
| Repaying debt | "Debt cannot be reduced below $15,000" is taken literally: a repayment can't leave less than $15,000, so debt of $15,000 or less can never be repaid. **Rules question for Jeff.** |
| Depth bonus | Deliveries of the most-delivered commodity beyond the first. **Rules question:** the text also says "one plus the number of times". |
| Monopoly ties | The table (2, 3, or 4 ties for 4-, 5-, or 6-city commodities), not the "1 or 2" in the prose above it. |
| Independent railroads | Can be acquired only if one of their cities is on the acquirer's network. |
| Picking up and delivering | Allowed in the engine's starting city as well as cities it passes through. |
| Trade-ins | Cargo stays on the token when its engine is traded in. |
| Market contracts | One claimed, unfulfilled market contract at a time (the Contracts tab enforces this for humans). |
| Regional Office | "Connections in a region" means track touching a city in that region. |
| New engine placement | A new (not traded-in) engine goes on any city on the network (rules, Buy an engine). |
