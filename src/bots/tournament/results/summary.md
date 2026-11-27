# Bot tournament

600 games, 4 bots each, seed 2, round limit 80, 3 market contracts at the start. 600 games reached 30 fulfillment ties, in 32.4 rounds on average. A fair win rate is 25%.

| Strategy | Seats | Win rate | Ties | Fulfillment ties | Deliveries | Routes | Debt | Cash | Borrows | Redraws | Idle turns | Errors |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| builder | 381 | 20% | 36.4 | 22.9 | 11.7 | 23.8 | $17k | $15k | 2.7 | 4.4 | 0.0 | 0.0 |
| speculator | 401 | 20% | 32.8 | 20.2 | 10.3 | 18.4 | $55k | $9k | 6.5 | 5.8 | 2.3 | 0.0 |
| consolidator | 416 | 32% | 38.7 | 24.1 | 12.0 | 23.5 | $36k | $13k | 4.3 | 4.2 | 0.5 | 0.0 |
| express | 388 | 38% | 40.0 | 25.2 | 12.8 | 21.8 | $36k | $12k | 4.6 | 4.4 | 0.5 | 0.0 |
| merchant | 412 | 17% | 36.1 | 22.6 | 11.6 | 24.0 | $23k | $15k | 3.7 | 4.0 | 0.0 | 0.0 |
| regionalist | 402 | 23% | 37.2 | 23.3 | 11.8 | 22.6 | $25k | $10k | 3.3 | 3.9 | 0.4 | 0.0 |

## Purchases

| Strategy | Upgrades (avg) | Hub | Railyard | Regional Office | Commodities Exchange | Railroads acquired (avg) | Best engine (most common) |
|---|---|---|---|---|---|---|---|
| builder | 0.3 | 7% | 0% | 0% | 7% | 0.9 | consolidation 45%, pacific 16% |
| speculator | 0.1 | 27% | 0% | 0% | 8% | 0.6 | challenger 41%, pacific 20% |
| consolidator | 0.8 | 98% | 0% | 0% | 16% | 1.2 | pacific 30%, challenger 23% |
| express | 0.0 | 0% | 0% | 0% | 3% | 0.6 | challenger 40%, pacific 21% |
| merchant | 0.3 | 0% | 0% | 0% | 2% | 1.0 | consolidation 31%, pacific 22% |
| regionalist | 0.2 | 90% | 0% | 1% | 17% | 0.8 | consolidation 37%, pacific 28% |

## Market fairness

Access is the number of segments from a seat's active cities to the nearest source of an open market contract's commodity, sampled once a round. The gap is the worst-served seat's access minus the best-served seat's.

| Access gap | Access | Market deliveries per seat | Delivery spread per game | Seats with no market deliveries |
|---|---|---|---|---|
| 0.5 | 0.2 | 4.1 | 4.6 | 4% |

## Merchant before and after

Merchant drew its planning horizon from `lowMed` and its payback patience from `low` (`src/bots/heuristic/weights.ts`), which allowed a payback of 2–5 turns over a 5–9 turn horizon. A trade-in from the Mogul to a faster engine never paid back that fast, so merchant stayed on the Mogul in about 70% of games and made fewer deliveries all game. Both bands are now `medium`. Raising only one of them wasn't enough: in 160-game checks (seed 3), merchant won 9% with medium patience alone and 15% with a medium horizon and `lowMed` patience. Its low `tiesOverMoney` is unchanged, so it still values money over ties.

Same settings as above (600 games, 4 bots, seed 2, anchored market contracts), merchant only:

| | Win rate | Ties | Fulfillment ties | Deliveries | Best engine (most common) |
|---|---|---|---|---|---|
| Before | 6% | 30.5 | 18.7 | 9.8 | mogul 71%, consolidation 19% |
| After | 17% | 36.1 | 22.6 | 11.6 | consolidation 31%, pacific 22% |
