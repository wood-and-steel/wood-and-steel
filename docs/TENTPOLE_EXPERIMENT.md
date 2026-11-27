# Experiment: making the other paths to victory matter

**Question:** In bot tournaments, buying faster engines decides most games. Which rule changes would make the game's other tentpoles real paths to victory: acquiring independent railroads, controlling a region or a commodity, and infrastructure upgrades?

**Status:** design, not run. Needs Jeff's decisions (end of this doc) before Phase 2.

---

## What the tournaments show now

From the 600-game, 4-player run on main (seed 2, after PR #77), every seat of every game:

| Best engine at the end | Seats | Win rate | Ties |
|---|---|---|---|
| Mogul | 143 | 0% | 25.5 |
| Consolidation | 502 | 2% | 32.1 |
| Prairie | 171 | 8% | 32.2 |
| Pacific | 488 | 21% | 36.8 |
| Mikado | 219 | 30% | 38.1 |
| Mountain | 115 | 25% | 37.6 |
| Challenger | 759 | 50% | 44.3 |

Within every strategy, seats that reach a Pacific or better win 23–45%; the rest win 2–5%.

The other tentpoles:

| Tentpole | Seats that have it | Win rate with | Win rate without |
|---|---|---|---|
| Acquired 1+ independent railroads | 1,417 | 24.8% | 25.3% |
| Acquired 2+ | 515 | 24.3% | 25.2% |
| Hub | 913 | 28.1% | 23.1% |
| Commodities Exchange (monopoly) | 215 | 42.3% | 23.3% |
| Regional Office | 10 | 30% | 25.0% |
| Railyard | 0 | | |
| Service Yard, Timetable, Roundhouse, Employment Office | 0 each | | |
| Upgraded Stations | 1,670 | 30.0% | 13.6% |

Winners average 30.7 fulfillment ties and 17.9 bonus ties; the other seats average 20.6 and 12.9. Most of a winner's margin is fulfillment, which is speed.

Also relevant: connection bonuses and the West Coast bonus are in the rules but not in the app or the bots' scoring, and the Regional Office's extra contract isn't implemented. "Controlling part of the country" is partly missing from the game being tested.

## Two traps the design has to avoid

1. **Bot blindness vs. design weakness.** A tentpole that bots never buy may be weak, or the bots may just undervalue it (Upgraded Stations was undervalued until PR #77). Measuring how often bots buy something says nothing about whether it's worth buying.
2. **Correlation vs. cause.** Winners get rich and then buy Challengers and Exchanges; the 50% win rate of Challenger owners is partly that. Comparing seats that have something with seats that don't overstates it.

Both are handled the same way: **paired, forced-purchase games.** Play the same game (seed, seating, contracts) twice. In the second, one seat is made to pursue one tentpole as soon as it's legal; nothing else changes. The difference in that seat's result is what the tentpole is worth, whatever the bots' valuation. Rotate the treated seat across strategies and seat positions.

## Phase 0: instrumentation (tournament only)

Add to `src/bots/tournament/playGame.ts` and `games.csv`, per seat:

- Ties by source at the end: fulfillment, breadth, depth, monopoly, acquisitions, Regional Office, Challenger (`tieBreakdown` in `src/bots/engine/scoring.ts` already computes these).
- The round each engine level, upgrade and acquisition was bought.
- Actions spent by kind (run, build, buy engine, buy upgrade, acquire, redraw).

This tells us where ties come from and how early each path pays, which Phase 2 needs to tune timing, not just size.

## Phase 1: what each tentpole is worth under today's rules

A tournament option, e.g. `--force <lever>`, picks one seat per game and makes it pursue the lever: its affinity for the lever goes up ×10 and the payback check is skipped for it, so it buys whenever it's legal and affordable (borrowing within its usual debt limit). The same games are played without the option as the control.

| Lever | What the forced seat does |
|---|---|
| `engines` | Every engine step as soon as affordable (the reference) |
| `railroads` | Acquires every adjacent independent railroad |
| `hub` | Buys a Hub on its best-connected city |
| `regional-office` | Builds toward and buys a Regional Office (needs a build-target hook: plan track to the region's cities) |
| `exchange` | Builds toward the cheapest monopolizable commodity and buys the Exchange (same hook) |
| `railyard` | Buys a Railyard where it covers the most commodities |
| `infrastructure` | Service Yard, Timetable, Roundhouse, Employment Office as each opens |
| `stations` | Upgraded Stations at once |
| `none` | Control: forced seat plays its normal strategy |

**Measure, per lever:** the forced seat's win rate and ties against the same seat in the control games (the paired difference), and the effect on game length.

**Size:** 300 paired games per lever (600 games). The paired win-rate difference then has a 95% interval of about ±5 points. At about 1.1 seconds a game, four in parallel, all nine levers take about 25 minutes.

**What it answers:** which tentpoles are weak *by design* (forcing them doesn't help) and which the bots only *undervalue* (forcing helps, so fix the bots, not the rules). Only the first group goes to Phase 2.

## Phase 2: rule variants

Each variant is a set of number or rule changes, played as a normal 600-game tournament (all strategies, seed 2, then seed 4 to confirm) **and** with Phase 1's forced test for the lever it targets.

Candidate levers, each tried alone first, then the best ones combined:

| Tentpole | Variant | What changes |
|---|---|---|
| Engines (damp) | `challenger-flat` | Challenger: no end-game ties, no 4/3 payment |
| | `engine-prices` | Pacific and up cost 25% more |
| Railroads | `acquire-2` | 2 ties per acquisition instead of 1 |
| | `acquire-per-route` | 1 tie per acquired route |
| | `indie-cheaper` | $2,000 a route until a Western delivery |
| Region | `ro-4-cities` | Regional Office needs 4 cities; others may have routes if you have the most |
| | `ro-ties-4` | Regional Office ends at 4 ties instead of 2 |
| | `ro-contract` | Implement the Regional Office's extra contract (already in the rules) |
| | `connections` | Implement connection bonuses and the West Coast bonus (already in the rules) |
| Commodity | `monopoly-plus` | Monopoly ties +2 at each size |
| | `depth-x2` | Depth bonus doubled |
| Infrastructure | `infra-cheaper` | Service Yard, Roundhouse, Employment Office $5,000; Timetable $8,000 |
| | `railyard-3` | Railyard range 3 |

**Running variants without changing core game logic.** The bots may not edit `gameActions`, `moveValidation`, phases or `Contract`. Variants run in the tournament only:

- **Scoring-only levers** (Regional Office, monopoly, depth, Challenger end ties, connection bonuses): the end-game bonuses are scored only in `src/bots/engine/scoring.ts`, not by the app, so a variant passed into the tournament's scoring and the bots' valuation is enough. Acquisition ties are an exception: the app awards them (`src/utils/ties.ts`) and the winner is decided on the bots' tie total, so `acquire-2` and `acquire-per-route` change only the bots' copy.
- **Price and rule levers** (engine and upgrade prices, independent railroad prices, Railyard range): a tournament-only Vite config aliases `src/rules/rulesData.ts` (and, for engine prices, `src/rules/playerBoard.ts`) to a variant module that re-exports the real one with overrides. The app and its tests never load it.
- **Mechanics the rules have but the app lacks** (`ro-contract`, `connections`): implement in the bots' scoring and offers first, as a test. Adding one to the app is a design decision for afterwards.

The bots read these numbers from the same modules, so numeric levers change their valuations automatically. New mechanics also need a valuation in `invest.ts`, or a variant would look weak only because bots ignore it (trap 1 again).

## Success criteria

A variant set is a candidate for the rules when, in the 600-game tournament and confirmed on a second seed:

1. **No single dominant path:** in Phase 1's forced test, no lever's win-rate gain is more than 1.5× the second-best lever's. Today the reference is engines.
2. **Several viable paths:** at least three tentpoles other than engines give a forced seat a positive, significant paired gain.
3. **Engines still matter:** Challenger owners win 30–40% (today 50%), and Mogul-or-below seats still rarely win.
4. **Strategies balanced:** every strategy wins 18–32%.
5. **Same game length:** 28–36 rounds on average (today 32).
6. **Signature purchases happen:** each strategy's signature purchase is made in at least half its seats (for example, regionalist's Regional Office, today about 1%).

## Compute and order

1. Phase 0 instrumentation, then rerun the main baseline (1 run, about 12 minutes).
2. Phase 1: nine levers, paired (about 25 minutes on four cores).
3. Phase 2: about 13 single-lever variants × 600 games plus their forced tests (about 2 hours), then 3–5 combinations on two seeds (about 1 hour).
4. Write `src/bots/tournament/results/tentpoles.md` with every variant's before/after table; recommend a rules change.

## Decisions for Jeff

1. **Variant mechanism:** is the tournament-only alias of `rulesData.ts` and `playerBoard.ts` acceptable, or would you rather move the variable rules into one rules object the app reads (a refactor of core code with no behavior change)?
2. **Unimplemented rules:** should Phase 2 test connection bonuses, the West Coast bonus and the Regional Office contract, which need new scoring and bot valuation?
3. **Levers:** add, drop or reshape any in the Phase 2 table. In particular, should engines be damped at all, or should only the other paths be strengthened?
4. **Targets:** are the success criteria the balance you want, for example Challenger owners at 30–40%?
