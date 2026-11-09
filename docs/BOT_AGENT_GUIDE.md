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

## Heuristic player (`src/bots/heuristic/`)

| File | Role |
|---|---|
| `strategies.ts` | The six strategies: labels, summaries, and affinities (multipliers on what a kind of purchase is worth). |
| `weights.ts` | Weight bands per strategy; weights are drawn once, when a bot's record is created. |
| `params.ts` | Weights → concrete numbers (max debt, horizon, payback, tie value, choice band); `chooseWithinBand` for near-best random choices. |
| `plans.ts` | `cheapestPath` (own track free, independent routes off limits) and delivery plans: engine, supplier, track to build, turns, utility, rate, affordability. |
| `invest.ts` | What engines, upgrades, and independent railroads are worth over the horizon; `worthwhile` filters by value and payback. |
| `policy.ts` | `heuristicPolicy`: required choices → free pickups → deliveries → purchases → the best plan's next step → redraw, repay, or end the turn. |

Tuning: valuations are deliberately simple. Change them with `playthrough.test.ts` (`BOT_LOG=1 npx vitest run src/bots/heuristic/playthrough.test.ts` prints each strategy's results) and, from M7, the tournament.

## Runner (`src/bots/runner/`, `src/bots/host/`)

| File | Role |
|---|---|
| `ports.ts` | `GamePort`, `BoardPort`, `BotStatePort`, `Clock`: everything the runner needs from outside. A server runner implements these instead of `host/hostPorts.ts`. |
| `runner/runTurn.ts` | `runBotTurn`: one turn. Per action: policy chooses from `listActions`, `applyAction` checks it, the action and its effects are saved as `turnInProgress.pending`, the effects run, then narration is saved and `pending` cleared. |
| `runner/steps.ts` | Step keys (rebuild the turn's actions after a reload) and `isMoveDone` (skip moves `G` already shows when resuming). |
| `runner/simplePolicy.testHelper.ts` | A small predictable policy for runner tests. Live bots use `heuristicPolicy`. |
| `host/hostPorts.ts` | Host implementations: moves call the app's move functions, then wait until the stored game matches the store; board ops go through `src/board/boardRowOps.ts`. |
| `host/BotRunner.tsx` | Lazy-mounted by `App.tsx`. On the host only: creates `bot_states`, plays each bot's turn when it's current, and writes a heartbeat (`runnerSeenAt`) every 10 seconds. |

**Adding a move to the engine:** add it to `GameMove` (`engine/actions.ts`), `callMove` (`host/hostPorts.ts`), and `isMoveDone` (`runner/steps.ts`), so a resumed turn neither skips nor repeats it.

A "segment" in the rules is one route between two cities: moves, the two-route build limit, and Hub, Railyard, and Roundhouse ranges all count routes. A route's length (1–5) only sets its cost.

## Narration on the board

Each action's narration lines are saved to the bot's `log` in `bot_states` (the last 20 turns). The board reads them read-only (`src/board/useBotNarration.ts`, `botNarration.ts`) and shows the latest turn at the top of the bot's tray card, plus "Waiting for the host's app" when it's the bot's turn and `runnerSeenAt` is over 30 seconds old. The board may import only `bots/state/botStates` and `bots/state/botStatesAdapter`; `botIsolation.test.ts` checks this. New narration goes in `engine/narration.ts` and the action that produces it.

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

The rules were clarified on 2026-11-09 and the engine follows them, including: track and acquired railroads must connect to the network; a flat parallel surcharge; the John Bull may be kept; pickups any time an empty engine is in a supplying city; the repay threshold; when the Service Yard opens; Upgraded Stations outside the engine bonus; the Hub discount and when it applies; Mountain and Challenger rounding; Regional Office routes; one claimed market contract; and the bonuses.

No open defaults remain. If a rules question comes up, mark the engine's choice `DEFAULT` in `engine/rulesData.ts`, list it here, and ask Jeff.

Pickups are modeled two ways: as events of a run (in any city on the path, including where the engine starts) and as the free `pickUp` action for an engine that is stopped or was just placed.
