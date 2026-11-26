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

Win rates by strategy, 4 players (a fair rate is 25%; with about 100 seats per strategy, differences
under roughly 10 points are within noise):

| Strategy | Before | Anchored |
|---|---|---|
| builder | 29% | 18% |
| speculator | 20% | 27% |
| consolidator | 28% | 35% |
| express | 30% | 41% |
| merchant | 10% | 2% |
| regionalist | 33% | 27% |
