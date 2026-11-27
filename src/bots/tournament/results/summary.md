# Bot tournament

600 games, 4 bots each, seed 2, round limit 80, 3 market contracts at the start. 600 games reached 30 fulfillment ties, in 32.0 rounds on average. A fair win rate is 25%.

| Strategy | Seats | Win rate | Ties | Fulfillment ties | Deliveries | Routes | Debt | Cash | Borrows | Redraws | Idle turns | Errors |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| builder | 381 | 21% | 36.7 | 22.7 | 11.7 | 23.5 | $17k | $17k | 2.6 | 4.2 | 0.1 | 0.0 |
| speculator | 401 | 22% | 34.7 | 21.2 | 10.8 | 19.2 | $56k | $13k | 7.4 | 5.8 | 1.1 | 0.0 |
| consolidator | 416 | 29% | 38.9 | 24.0 | 12.1 | 23.4 | $36k | $18k | 5.5 | 3.5 | 0.4 | 0.0 |
| express | 388 | 39% | 39.9 | 25.3 | 12.8 | 21.5 | $36k | $18k | 4.6 | 4.3 | 0.6 | 0.0 |
| merchant | 412 | 21% | 37.3 | 23.1 | 11.9 | 24.2 | $23k | $20k | 4.2 | 3.7 | 0.1 | 0.0 |
| regionalist | 402 | 19% | 36.3 | 22.7 | 11.6 | 22.0 | $26k | $11k | 3.3 | 3.6 | 0.4 | 0.0 |

## Purchases

| Strategy | Upgrades (avg) | Hub | Railyard | Regional Office | Commodities Exchange | Railroads acquired (avg) | Best engine (most common) |
|---|---|---|---|---|---|---|---|
| builder | 0.7 | 9% | 0% | 0% | 7% | 1.0 | consolidation 37%, pacific 18% |
| speculator | 1.0 | 30% | 0% | 1% | 11% | 0.6 | challenger 56%, pacific 16% |
| consolidator | 1.1 | 97% | 0% | 0% | 12% | 1.2 | challenger 36%, pacific 26% |
| express | 0.6 | 0% | 0% | 0% | 4% | 0.5 | challenger 44%, pacific 21% |
| merchant | 0.9 | 0% | 0% | 0% | 3% | 1.1 | challenger 25%, consolidation 25% |
| regionalist | 0.3 | 89% | 0% | 1% | 17% | 0.8 | consolidation 38%, pacific 22% |

## Market fairness

Access is the number of segments from a seat's active cities to the nearest source of an open market contract's commodity, sampled once a round. The gap is the worst-served seat's access minus the best-served seat's.

| Access gap | Access | Market deliveries per seat | Delivery spread per game | Seats with no market deliveries |
|---|---|---|---|---|
| 0.5 | 0.2 | 4.1 | 4.4 | 4% |

## Upgraded Stations before and after

Bots valued Upgraded Stations ($10,000, +$3,000 a delivery) over their planning horizon (5–15 turns) at one plan's delivery rate, 1 ÷ (the plan's turns + 2). That came to about 0.2 deliveries a round, where bots actually make about 0.35. Few bots found it worth buying, and those that did bought it late, once idle cash stretched their patience. It is now valued over the rounds the game likely has left. That estimate is based on the leader's fulfillment ties and pace, blended toward a typical 32-round game while the record is short. Its delivery rate is the bot's own record, blended toward 0.35 a round (`src/bots/heuristic/invest.ts`). The payback check still applies, so strategies differ in how readily they buy it.

Share of seats that bought Upgraded Stations, and win rate, 4 bots:

| Strategy | Stations before → after (seed 2, 600 games) | Win rate before → after (seed 2, 600 games) | Win rate before → after (seed 4, 300 games) |
|---|---|---|---|
| builder | 27% → 68% | 20% → 21% | 25% → 20% |
| speculator | 1% → 84% | 20% → 22% | 16% → 22% |
| consolidator | 66% → 100% | 32% → 29% | 28% → 25% |
| express | 0% → 60% | 38% → 39% | 35% → 44% |
| merchant | 31% → 91% | 17% → 21% | 19% → 18% |
| regionalist | 0% → 13% | 23% → 19% | 26% → 22% |

Bots now buy it far more often, but win rates move within noise (about ±4% at 600 games, ±6% at 300). Cash is rarely what limits a bot's ties, so the extra money changes little. Games end slightly sooner (32.4 → 32.0 rounds at seed 2).
