# Contract generation

This document is a summary of the contract generation routines implemented in [Contracts.js](..\src\Contract.js).

## Private Contract

Private contracts are offered to a player just after they fulfill a prior private contract.

1. From the city where the private contract was just fulfilled, choose one of the four cardinal directions using the odds below. If there are no cities in the selected direction, choose the opposite direction instead.
  - Eastern cities near the coast (Quebec CIty, Albany, Cleveland, Pittsburgh, Atlanta, Tallahassee): N 20%, S 20%, E 20%, or W 40%
  - Western cities near the coast (Spokane, Boise, Reno, Flagstaff, Phoenix): N 20%, S 20%, E 40%, or W 20%
  - All other cities: N 20%, S 20%, E 30%, or W 30%
2. Select a destination city within 2 segments of one of their active cities, but not the place where a contract was just fulfilled (the current city). The higher value a city has, the more likely it will get a contract.
3. Select a commodity available within 1 city of where the player has fulfilled contracts (or their two starting cities), excepting commodities generated in the destination city.
4. Price of a contract is $3,000 times the shortest number of segments from a city with that commodity to the destination.

## Starting Private Contract

Starting contracts are a special kind of Private Contract. They are given to players during the setup phase.

1. Make a list of candidate destination cities.
  - Given the two starting cities, make a list of all cities within one hop (where those hops are not mountains). This helps keep players from spreading too fast and getting in each other’s business too early, and also keeping the cost of the track for the first private contract reasonable. Unit test: make sure this does not generate empty lists.
  - Group the candidate cities into their cardinal directions (N, S, E, or W) from either starting city—meaning some candidates might end up in more than one group.
  - If all four lists have cities, choose one of the four cardinal directions according to these odds: N 20%, S 20%, E 30%, or W 30%. If only two of the lists have cities, choose between those two directions 50/50. If there are no cities in the selected direction, choose the opposite direction instead.
2. Choose a commodity.
  - Make a list of all commodities in the two starting cities that are not also available in all of the destination cities. Unit test: make sure this does not lead to no commodities being possible to deliver.
  - Choose one of those commodities at random, equal chance for all.
3. Choose the destination city.
  - Remove all destination cities from the candidate list that supply the chosen commodity.
  - Choose one of the remaining candidate cities at random, linear proportional chance based on the value of the cities.
4. Price of a contract is $3,000 times the shortest number of segments from a city with that commodity to the destination.

## Market contract

To generate a market contract: 

1. Select a city within 2 segments of any active city (but not one of the active ones), weighted by their value.
2. Select a commodity available within 1 city of any activated city, excepting commodities generated in the destination city.
3. Price of a contract is $3,000 times the shortest number of segments from a city with that commodity to the destination.s
