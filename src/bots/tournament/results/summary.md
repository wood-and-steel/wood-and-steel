# Bot tournament

150 games, 4 bots each, seed 1, round limit 80, 3 market contracts at the start. 150 games reached 30 fulfillment ties, in 31.9 rounds on average. A fair win rate is 25%.

| Strategy | Seats | Win rate | Ties | Fulfillment ties | Deliveries | Routes | Debt | Cash | Borrows | Redraws | Idle turns | Errors |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| builder | 87 | 18% | 35.0 | 21.7 | 11.2 | 22.7 | $17k | $15k | 2.6 | 4.5 | 0.0 | 0.0 |
| speculator | 95 | 27% | 36.9 | 22.8 | 11.4 | 19.3 | $55k | $14k | 6.5 | 4.1 | 1.6 | 0.0 |
| consolidator | 107 | 34% | 37.6 | 23.4 | 11.6 | 22.3 | $34k | $15k | 4.1 | 3.9 | 0.2 | 0.0 |
| express | 97 | 43% | 39.5 | 25.4 | 12.6 | 21.8 | $35k | $13k | 4.5 | 4.4 | 0.6 | 0.0 |
| merchant | 105 | 2% | 29.5 | 18.2 | 9.5 | 22.8 | $20k | $10k | 3.4 | 4.7 | 0.0 | 0.0 |
| regionalist | 109 | 26% | 37.3 | 23.1 | 11.7 | 21.7 | $25k | $10k | 3.3 | 3.3 | 0.1 | 0.0 |

## Purchases

| Strategy | Upgrades (avg) | Hub | Railyard | Regional Office | Commodities Exchange | Railroads acquired (avg) | Best engine (most common) |
|---|---|---|---|---|---|---|---|
| builder | 0.3 | 3% | 0% | 0% | 2% | 0.9 | consolidation 37%, mogul 18% |
| speculator | 0.1 | 35% | 0% | 0% | 11% | 0.6 | challenger 56%, pacific 21% |
| consolidator | 0.8 | 97% | 0% | 1% | 13% | 1.1 | challenger 27%, pacific 26% |
| express | 0.0 | 0% | 0% | 0% | 3% | 0.6 | challenger 35%, pacific 27% |
| merchant | 0.0 | 0% | 0% | 0% | 4% | 0.9 | mogul 67%, consolidation 22% |
| regionalist | 0.2 | 92% | 0% | 0% | 17% | 0.9 | consolidation 36%, pacific 24% |

## Market fairness

Access is the number of segments from a seat's active cities to the nearest source of an open market contract's commodity, sampled once a round. The gap is the worst-served seat's access minus the best-served seat's.

| Access gap | Access | Market deliveries per seat | Delivery spread per game | Seats with no market deliveries |
|---|---|---|---|---|
| 0.5 | 0.2 | 3.8 | 4.4 | 4% |
