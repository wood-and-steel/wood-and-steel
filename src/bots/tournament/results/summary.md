# Bot tournament

600 games, 4 bots each, seed 2, round limit 80, 3 market contracts at the start. 600 games reached 30 fulfillment ties, in 32.1 rounds on average. A fair win rate is 25%.

| Strategy | Seats | Win rate | Ties | Fulfillment ties | Deliveries | Routes | Debt | Cash | Borrows | Redraws | Idle turns | Errors |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| builder | 381 | 19% | 36.0 | 22.6 | 11.6 | 23.5 | $16k | $14k | 2.7 | 4.0 | 0.0 | 0.0 |
| speculator | 401 | 21% | 33.4 | 20.6 | 10.3 | 18.6 | $55k | $10k | 6.5 | 5.6 | 2.2 | 0.0 |
| consolidator | 416 | 33% | 39.0 | 24.3 | 12.1 | 22.9 | $36k | $17k | 4.3 | 3.7 | 0.3 | 0.0 |
| express | 388 | 34% | 38.7 | 24.5 | 12.3 | 21.2 | $36k | $12k | 4.6 | 4.3 | 1.1 | 0.0 |
| merchant | 412 | 18% | 35.0 | 21.9 | 11.1 | 23.5 | $24k | $14k | 3.8 | 4.1 | 0.4 | 0.0 |
| regionalist | 402 | 24% | 37.3 | 23.4 | 11.7 | 22.4 | $25k | $10k | 3.4 | 3.9 | 0.2 | 0.0 |

## Purchases

| Strategy | Upgrades (avg) | Hub | Railyard | Regional Office | Commodities Exchange | Railroads acquired (avg) | Best engine (most common) |
|---|---|---|---|---|---|---|---|
| builder | 0.3 | 8% | 0% | 0% | 3% | 0.8 | consolidation 40%, pacific 18% |
| speculator | 0.1 | 29% | 0% | 0% | 6% | 0.6 | challenger 44%, pacific 19% |
| consolidator | 0.8 | 98% | 0% | 0% | 13% | 1.1 | challenger 30%, pacific 26% |
| express | 0.0 | 0% | 0% | 0% | 2% | 0.6 | challenger 40%, pacific 19% |
| merchant | 0.3 | 0% | 0% | 0% | 1% | 1.0 | consolidation 28%, pacific 22% |
| regionalist | 0.2 | 90% | 0% | 1% | 16% | 0.8 | consolidation 39%, pacific 27% |

## Merchant before and after

Merchant drew its planning horizon from `lowMed` and its payback patience from `low` (`src/bots/heuristic/weights.ts`), which allowed a payback of 2–5 turns over a 5–9 turn horizon. A trade-in from the Mogul to a faster engine never paid back that fast, so merchant stayed on the Mogul in 70% of games and made fewer deliveries all game. Both bands are now `medium`. Raising only one of them wasn't enough: in 160-game checks (seed 3), merchant won 9% with medium patience alone and 15% with a medium horizon and `lowMed` patience. Its low `tiesOverMoney` is unchanged, so it still values money over ties.

Same run as above (600 games, 4 bots, seed 2), merchant only:

| | Win rate | Ties | Fulfillment ties | Deliveries | Best engine (most common) |
|---|---|---|---|---|---|
| Before | 5% | 29.8 | 18.2 | 9.5 | mogul 70%, consolidation 19% |
| After | 18% | 35.0 | 21.9 | 11.1 | consolidation 28%, pacific 22% |
