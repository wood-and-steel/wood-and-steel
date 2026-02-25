# Contract generation

This document summarizes the contract generation routines implemented in [Contract.js](../src/Contract.js).

## Dollar value (moneyValue)

For all contract types, the cash reward when fulfilled is:

**$3,000 × (shortest number of segments from a city that provides the commodity to the destination city)**

The distance is computed by breadth-first search on the route graph.

## Railroad tie value (railroadTieValue)

When a contract is fulfilled, the player also earns 1–4 railroad ties based on the destination region and the region(s) where the commodity is produced. There are 6 regions: "NW", "NC", "NE", "SW", "SC", "SE". On the map, these form a 3-column, 2-row grid. The first character of the region indicates the North or South row; the second indicates the West, Central, or East column.

Cities have a single `region`. Commodities have a `regions` array (e.g., coal has `["NC", "NE", "NW", "SC", "SE"]`). This array is pre-generated in the commodities data and is the union of the regions of the cities that provide that commodity.

The railroad tie value comes from a 6×6 matrix of destination region (row) vs. commodity source region (column):

| Destination \ Commodity | NW | NC | NE | SW | SC | SE |
|-------------------------|----|----|----|----|----|----|
| **NW**                  | 1  | 2  | 3  | 2  | 3  | 4  |
| **NC**                  | 2  | 1  | 2  | 3  | 2  | 3  |
| **NE**                  | 3  | 2  | 1  | 4  | 3  | 2  |
| **SW**                  | 2  | 3  | 4  | 1  | 2  | 3  |
| **SC**                  | 3  | 2  | 3  | 2  | 1  | 2  |
| **SE**                  | 4  | 3  | 2  | 3  | 2  | 1  |

- Same region (e.g., NW→NW): 1 railroad tie  
- Adjacent regions: 2 railroad ties
- Two regions away: 3 railroad ties
- Distant regions (e.g., NW→SE): 4 railroad ties  

If a commodity is produced in multiple regions, the **minimum** value across those regions is used (representing the closest viable source region).

---

## City value (valueOfCity)

City value is used to weight destination selection. Higher-value cities are more likely to be chosen. Values are small integers that are not exposed to players. At the start of the game, the cities start with different values to reflect the major cities that grew historically, but gameplay increases the value of cities.

Formula:

- Base: `2 × (1 + hasCommodities + large + (3 × westCoast))`  
  - `hasCommodities`: 1 if the city has any commodities, else 0  
  - `large`: 1 if the city is large, else 0  
  - `westCoast`: 1 if the city is on the West Coast, else 0  
- Plus `2 × contractsFulfilledHere` (fulfilled contracts with this city as destination)  
- Plus `contractsWithCommoditiesFromHere` (fulfilled contracts whose commodity is produced in this city)

---

## Private contract

Private contracts are offered to a player just after they fulfill a prior private contract. The logic uses the **current city** (the city where the private contract was just fulfilled, i.e. the last city in their active cities) as the origin for direction selection.

1. **Choose direction** from the current city using these odds. If there are no cities in the selected direction, the opposite direction is used instead.
   - Cities near the **east** coast (city.nearEastCoast == true): N 15%, S 15%, E 15%, W 55%
   - Cities near the **west** coast (city.nearWestCoast == true): N 15%, S 15%, E 55%, W 15%
   - All other cities: N 15%, S 15%, E 35%, W 35%

2. **Select destination city**: Within 2 segments of any of the player’s active cities, in the chosen direction. Excludes the origin cities (active cities). Selection is weighted by city value (higher value = higher chance).

3. **Select commodity**: Available within 1 segment of the player’s active cities. Excludes commodities produced in the destination city. Chosen at random with equal probability.

---

## Starting private contract

Starting contracts are a special kind of private contract given to players during setup.

1. **Candidate destination cities**
   - From the two starting cities, collect all cities within **2 segments**, where those segments are **not** mountainous routes.
   - Group candidates by cardinal direction (N, S, E, W) from either starting city; a candidate may appear in multiple directions.
   - Choose direction:
     - If **no candidates are to the north or south**: choose between east and west, 50/50.
     - If **no candidates are to the east or west**: choose between north and south, 50/50.
     - If **all four directions** have cities: N 15%, S 15%, E 35%, W 35%.
   - If there are no cities in the chosen direction, use the opposite direction instead.

2. **Choose commodity**
   - Commodities present in either starting city that are **not** available in every candidate destination city.
   - One chosen at random, equal probability.

3. **Choose destination city**
   - Remove candidates that produce the chosen commodity.
   - From the remaining candidates, choose one weighted by city value (higher value = higher chance).

---

## Market contract

1. **Select destination city**: Within 2 segments of any active city (of any player), but **not** an active city itself. Selection weighted by city value.

2. **Select commodity**
   - Must be available in active cities or cities within 1 segment of active cities (including the active cities).
   - Must **not** be produced in the destination city.
   - Must have **distance ≥ 2** from the destination (shortest path to any city that produces the commodity). This ensures a minimum cash reward of $6,000 (2 segments × $3,000).

3. Chosen at random with equal probability among valid commodities.
