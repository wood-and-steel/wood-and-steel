# Bot tournament

150 games, 4 bots each, seed 1, round limit 80, 3 market contracts at the start. 150 games reached 30 fulfillment ties, in 31.9 rounds on average. A fair win rate is 25%.

| Strategy | Seats | Win rate | Ties | Fulfillment ties | Deliveries | Routes | Debt | Cash | Borrows | Redraws | Idle turns | Errors |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| builder | 87 | 18% | 34.8 | 21.6 | 11.2 | 22.6 | $16k | $15k | 2.6 | 4.4 | 0.0 | 0.0 |
| speculator | 95 | 27% | 37.2 | 22.9 | 11.5 | 19.5 | $56k | $14k | 6.6 | 4.1 | 1.6 | 0.0 |
| consolidator | 107 | 35% | 38.2 | 23.8 | 11.8 | 22.7 | $35k | $16k | 4.2 | 3.9 | 0.2 | 0.0 |
| express | 97 | 41% | 38.8 | 24.9 | 12.3 | 21.5 | $35k | $12k | 4.4 | 4.4 | 0.6 | 0.0 |
| merchant | 105 | 2% | 29.5 | 18.2 | 9.5 | 22.8 | $20k | $11k | 3.3 | 4.6 | 0.0 | 0.0 |
| regionalist | 109 | 27% | 37.0 | 22.9 | 11.6 | 21.5 | $25k | $10k | 3.3 | 3.2 | 0.1 | 0.0 |

## Purchases

| Strategy | Upgrades (avg) | Hub | Railyard | Regional Office | Commodities Exchange | Railroads acquired (avg) | Best engine (most common) |
|---|---|---|---|---|---|---|---|
| builder | 0.3 | 3% | 0% | 0% | 2% | 0.9 | consolidation 37%, mogul 18% |
| speculator | 0.1 | 35% | 0% | 0% | 11% | 0.6 | challenger 57%, pacific 21% |
| consolidator | 0.8 | 97% | 0% | 1% | 13% | 1.2 | challenger 28%, pacific 26% |
| express | 0.0 | 0% | 0% | 0% | 3% | 0.6 | challenger 34%, pacific 28% |
| merchant | 0.0 | 0% | 0% | 0% | 4% | 0.9 | mogul 66%, consolidation 23% |
| regionalist | 0.2 | 92% | 0% | 0% | 17% | 0.9 | consolidation 35%, pacific 24% |

## Market fairness

Access is the number of segments from a seat's active cities to the nearest source of an open market contract's commodity, sampled once a round. The gap is the worst-served seat's access minus the best-served seat's.

| Access gap | Access | Market deliveries per seat | Delivery spread per game | Seats with no market deliveries |
|---|---|---|---|---|
| 0.5 | 0.2 | 3.8 | 4.3 | 4% |
