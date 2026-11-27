# Market fairness: anchored market contracts

Bot tournaments before and after anchoring each new market contract on the player the open market
serves worst (docs/Contract generation.md, Market contract). Each run is 150 games, seed 1, round
limit 80, 3 market contracts at the start; `summary.md` is the anchored 4-player run.

Access is the number of segments from a seat's active cities to the nearest source of an open market
contract's commodity, sampled once a round. The gap is the worst-served seat's access minus the
best-served seat's. The delivery spread is, per game, the most minus the fewest market deliveries
among its seats.

| Players | Generator | Access gap | Access | Market deliveries per seat | Delivery spread per game | Seats with no market deliveries | Rounds |
|---|---|---|---|---|---|---|---|
| 2 | before | 0.4 | 0.2 | 5.9 | 3.0 | 2% | 33.9 |
| 2 | anchored | 0.2 | 0.1 | 6.3 | 3.0 | 2% | 34.7 |
| 4 | before | 1.1 | 0.5 | 3.6 | 4.4 | 5% | 32.8 |
| 4 | anchored | 0.5 | 0.2 | 3.8 | 4.3 | 4% | 31.9 |
| 5 | before | 1.3 | 0.5 | 3.0 | 4.6 | 9% | 33.0 |
| 5 | anchored | 0.6 | 0.2 | 3.3 | 4.2 | 5% | 32.4 |

Win rates by strategy in the 150-game 4-player runs moved more than they do over a longer run;
see the 600-game run below, which supersedes them.

| Strategy | Before | Anchored |
|---|---|---|
| builder | 29% | 18% |
| speculator | 20% | 27% |
| consolidator | 28% | 35% |
| express | 30% | 41% |
| merchant | 10% | 2% |
| regionalist | 33% | 27% |

## 600 games, 4 players, seed 2

A longer run on a different seed, to check the win-rate changes above. The ± figures are 95%
intervals.

| Generator | Access gap | Access | Market deliveries per seat | Delivery spread per game | Seats with no market deliveries | Rounds |
|---|---|---|---|---|---|---|
| before | 1.1 | 0.4 | 3.6 | 4.4 | 6% | 32.6 |
| anchored | 0.5 | 0.2 | 3.9 | 4.6 | 5% | 33.2 |

| Strategy | Seats | Win rate before | Win rate anchored | Market deliveries before → anchored |
|---|---|---|---|---|
| builder | 381 | 21.3% ±4.1 | 21.3% ±4.1 | 3.8 → 4.3 |
| speculator | 401 | 24.9% ±4.2 | 22.4% ±4.1 | 3.4 → 3.8 |
| consolidator | 416 | 33.2% ±4.5 | 32.7% ±4.5 | 3.5 → 3.9 |
| express | 388 | 37.9% ±4.8 | 43.3% ±4.9 | 4.2 → 4.6 |
| merchant | 412 | 4.6% ±2.0 | 5.8% ±2.3 | 3.3 → 3.5 |
| regionalist | 402 | 28.6% ±4.4 | 25.1% ±4.2 | 3.5 → 3.6 |

Merchant is weak with either generator, so its drop in the 150-game run was noise. Express's rise
is within noise at this size. Every strategy makes slightly more market deliveries with anchoring.
