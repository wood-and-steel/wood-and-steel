import { cities, commodities } from "./GameData";
import { shortestDistance, citiesConnectedTo } from "./graph";
import { cardinalDirection } from "./geo";

/**
 * Represents a contract
 *
 * @export
 * @class Contract
 * @typedef {Contract}
 * @property {string} destinationKey    - Key of the destination city
 * @property {string} commodity         - Name of the commodity
 * @property {string} type              - One of ["market", "private", "fulfilled"]
 * @property {string} [player]          - Key of the destination city
 * @property {number} rewardValue       - Monetary value of contract upon fulfillment (read-only)
*/
export default class Contract {

  #destinationKey; 
  #commodity;
  #player;
  #type;
  
  /**
   * Creates an instance of Contract.
   *
   * @constructor
   * @param {string} destinationKey     - Key of the destination city
   * @param {string} commodity          - Name of the commodity
   * @param {string} [type="market"]    - One of ["market", "private", "fulfilled"]
   * @param {*} [player=null]           - ID of the player who holds it or has fulfilled it
   */
  constructor(destinationKey, commodity, type = "market", player = null) {
    if (
      !cities.get(destinationKey) || 
      !commodities.get(commodity) ||
      !["market", "private", "fulfilled"].includes(type)
      // TODO: Add test for player validity
    ) {
      console.error(`new Contract(${destinationKey}, ${commodity}, ${type}, ${player}) failed`);
      return undefined;
    }
    this.#destinationKey = destinationKey;
    this.#commodity = commodity;
    this.#type = type;
    this.#player = player;
  }

  // Instance methods
  
  toString() { return `${this.#commodity} -> ${this.#destinationKey} (${this.#type}${(this.#player ? `, ${this.#player}` : "")}) for $${this.rewardValue}`; }

  equals(that) {
    return that instanceof Contract &&
      this.#destinationKey === that.destinationKey &&
      this.#commodity === that.commodity &&
      this.#type === that.type &&
      this.#player === that.player;
  }

  toJSON() { 
    // Function exists because we render contracts as JSON so they can live in G (see https://boardgame.io/documentation/#/?id=state)
    return `{ "destinationKey": "${this.#destinationKey}", "commodity": "${this.#commodity}", "type": "${this.#type}", "player": ${this.#player} }`
  };

  // Static methods

  static fromJSON(s) {
    // TODO: Add error handling
    const temp = JSON.parse(s);
    return new Contract(temp?.destinationKey, temp?.commodity, temp?.type, temp?.player);
  };

  /**
   * Returns the value of a city
   * 
   * @param {*} G
   * @param {string} cityKey 
   * @returns {number | undefined}
   */
  static valueOfCity(G, cityKey) {
    const city = cities.get(cityKey);

    if (city === undefined) {
      console.error(`valueOfCity("${cityKey}"): could not find cityKey)`);
      return undefined;
    }

    let contractsFulfilledHere = 0, commoditiesDeliveredFromHere = new Set();

    G.contracts.forEach(contractJSON => {
      const contract = Contract.fromJSON(contractJSON);
      if (contract.type === "fulfilled") {
        contractsFulfilledHere += (contract.destinationKey === cityKey);
        if (city.commodities.includes(contract.commodity)) commoditiesDeliveredFromHere.add(contract.commodity);
      }
    });

    return 2 * (1 + 
      (city.commodities.length > 0) + 
      city.large + 
      (3 * city.westCoast)) +
      (2 * contractsFulfilledHere) +
      commoditiesDeliveredFromHere.size;
  };
  
  // Fields

  set destinationKey(k) { 
    if (cities.get(k)) {
      this.#destinationKey = k; 
    } else {
      console.error(`Contract.destinationKey(${k}): no such city`);
    }
  }
  get destinationKey() { return this.#destinationKey; }

  set commodity(c) { 
    if (commodities.get(c)) {
      this.#commodity = c;
    } else {
      console.error(`Contract.commodity(${c}): no such commodity`);
    }
  }
  get commodity() { return this.#commodity; }

  set player(p) { 
    // TODO: Check validity
    this.#player = p;
  }
  get player() { return this.#player; }

  set type(t) { 
    if (["market", "private", "fulfilled"].includes(t)) {
      this.#type = t;
    } else {
      console.error(`Contract.type(${t}): no such contract type`);
    }
  }
  get type() { return this.#type; }

  // rewardValue is read-only; setter is undefined
  get rewardValue() {
    return shortestDistance(this.#destinationKey, c => cities.get(c)?.commodities.includes(this.#commodity)) * 3000;
  }
  

  /**
   * Create a starting private contract for a given pair of starting cities
   *
   * @static
   * @param {*} G                             - boardgame.io global state
   * @param {string[2]} activeCitiesKeys      - Keys of two starting cities
   * @returns {Contract}
   */
  static generateStartingContract(G, activeCitiesKeys) {  
    if (!Array.isArray(activeCitiesKeys) || activeCitiesKeys.length !== 2) {
      console.error(`generateStartingContract(${activeCitiesKeys}): not an Array(2)`);
      return undefined;
    }
  
    // Throughout this function, "candidate" is always a city key, for a city being considered as a destination for the contract
  
    // Get all cities within 2 hops of active (starting) cities without crossing mountains
    const candidates = citiesConnectedTo(activeCitiesKeys, 2, (r => !r.mountainous));
    const candidatesByDirection = citiesByDirection(activeCitiesKeys, candidates);
    
    // If only two of the directions have cities, choose between those two directions 50/50
    // If all four directions have cities, choose one of them by these odds: N 20%, S 20%, E 30%, or W 30%
  
    let candidatesInChosenDirection = [];
    
    if (candidatesByDirection.get("north").size === 0) {
      candidatesInChosenDirection.push(...(candidatesByDirection.get( Math.random() < 0.5 ? "east" : "west" )));
    } else if (candidatesByDirection.get("east").size === 0) {
      candidatesInChosenDirection.push(...(candidatesByDirection.get( Math.random() < 0.5 ? "north" : "south" )));
    } else {
      const rand = Math.random();
      let randomDirection = "";
      
      if (rand < 0.2) randomDirection = "north"
      else if (rand < 0.4) randomDirection = "south"
      else if (rand < 0.7) randomDirection = "east"
      else randomDirection = "west";
      candidatesInChosenDirection.push(...(candidatesByDirection.get(randomDirection)));
    }
  
    // Choose a commodity at random from those that are:
    //  - not available in every candidate desintation city
    //  - available in the starting cities
    
    // List and count commodities in candidate destinations
    
    const candidateCountByCommodity = new Map();
    candidatesInChosenDirection.forEach(candidate => {
      cities.get(candidate).commodities.forEach(commodity => {
        if (candidateCountByCommodity.has(commodity)) 
          candidateCountByCommodity.set(commodity, (candidateCountByCommodity.get(commodity) + 1))
        else
          candidateCountByCommodity.set(commodity, 1);
      })
    });
  
    // Remember which commodities are available in all cities (thus not valid for delivery to this set of cities)
    
    const commoditiesInEveryCandidate = new Set();
    candidateCountByCommodity.forEach((count, commodity) => {
      if (count === candidatesInChosenDirection.length) commoditiesInEveryCandidate.add(commodity) 
    });
    
    // List all commodities available in active cities and remove the ones available in every potential destination
    
    const activeCitiesKeysCommodities = new Set();
    activeCitiesKeys.forEach(city => cities.get(city).commodities.forEach(commodity => activeCitiesKeysCommodities.add(commodity)));
    const validCommodities = activeCitiesKeysCommodities.difference(commoditiesInEveryCandidate);
  
    // Randomly pick a commodity for the contract
    
    const contractCommodity = [...validCommodities][Math.floor(Math.random() * validCommodities.size)];
  
    // Choose the destination, part 1: list candidates that don't supply the contractCommodity by their value
    
    let sumValues = 0;
    const weightedCandidates = new Map(
      candidatesInChosenDirection
        .filter(candidate => !cities.get(candidate).commodities.includes(contractCommodity))
        .map(candidate => {
          const val = this.valueOfCity(G, candidate);
          sumValues += val;
          return [candidate, val];
        })
    );
  
    // TODO: Write a test that exercises all paths to make sure this case can't happen
    if (weightedCandidates.size === 0) {
      console.error("generateStartingContract: no candidate cities survived");
      return undefined;
    }
  
    // Choose the destination, part 2: randomly pick the destination, weighted by their values
    
    let contractCity = "";
    const finalCityDieRoll = Math.floor(Math.random() * sumValues);
    let skipped = 0;
    weightedCandidates.forEach((cityValue, candidate) => {
      if (finalCityDieRoll < cityValue + skipped && contractCity === "")
        contractCity = candidate
      else
        skipped += cityValue;
    });
  
    const startingContract = new Contract(contractCity, contractCommodity, "private");
  
    return startingContract;  
  };

  /**
   * Create a market contract from the given active cities
   *
   * @static
   * @param {*} G                             - boardgame.io global state
   * @param {string[]} activeCitiesKeys       - Keys of all active cities
   * @returns {Contract}
   */
  static generateMarketContract(G, activeCitiesKeys) {  
    if (!Array.isArray(activeCitiesKeys) || activeCitiesKeys.length === 0) {
      console.error(`generateMarketContract(${activeCitiesKeys}): not an array with at least 1 city`);
      return undefined;
    }
  
    // Throughout this function, "candidate" is always a city key, for a city being considered as a destination for the contract
  
    // Get all cities within 2 hops of active cities (and not currently active)
    const candidates = citiesConnectedTo(activeCitiesKeys, 2);
  
    // Choose the destination, part 1: build list of candidates and their values
    
    let sumValues = 0;
    const weightedCandidates = new Map(
      [...candidates].map(candidate => {
        const val = this.valueOfCity(G, candidate);
        sumValues += val;
        return [candidate, val];
      })
    );
  
    // Choose the destination, part 2: randomly pick the destination, weighted by their values
    
    let contractCity = "";
    const finalCityDieRoll = Math.floor(Math.random() * sumValues);
    let skipped = 0;
    weightedCandidates.forEach((cityValue, candidate) => {
      if (finalCityDieRoll < cityValue + skipped && contractCity === "")
        contractCity = candidate
      else
        skipped += cityValue;
    });
  
    // Choose a commodity at random from those that are:
    //  - not available in the desintation city
    //  - available within any active city or 1 away from them
    
    const citiesWithinOneHop = [ ...(citiesConnectedTo(activeCitiesKeys, 1)), ...activeCitiesKeys ];

    const possibleCommodities = new Set();
    citiesWithinOneHop.forEach(cityWithinOneHop => {
      cities.get(cityWithinOneHop).commodities
        .filter(commodity => !cities.get(contractCity).commodities.includes(commodity))
        .forEach(commodityNotInContractCity => possibleCommodities.add(commodityNotInContractCity));
    });

    // TODO: Write test to ensure this case never happens (low priority, seems very unlikely by inspection)
    if (possibleCommodities.size === 0) {
      console.error(`generateMarketContract: no possible commodities`);
      return undefined;
    }

    // Randomly pick a commodity for the contract
    
    const contractCommodity = [...possibleCommodities][Math.floor(Math.random() * possibleCommodities.size)];
  
    const marketContract = new Contract(contractCity, contractCommodity, "market");
  
    return marketContract;  
  };
}


/**
 * Groups candidates into a Map of cardinal direction buckets. Candidates can appear in more than one bucket if there's 
 * more than one origin (from) city.
 * 
 * @param {string[]} fromCitiesKeys 
 * @param {string[]} candidateCitiesKeys 
 * @returns {Map}
 */
function citiesByDirection(fromCitiesKeys, candidateCitiesKeys) 
{
  let candidatesByDirection = new Map([
    ["north", new Set()],
    ["east", new Set()],
    ["south", new Set()],
    ["west", new Set()]
  ]);
  candidateCitiesKeys.forEach(candidate => {
    fromCitiesKeys.forEach(activeCity => {
      candidatesByDirection.get(cardinalDirection(activeCity, candidate))?.add(candidate)
    })
  });

  // If a list in one direction is empty, copy the opposite direction’s list into it
  // Thie implements the requirement "If there are no cities in the selected direction, choose the opposite direction instead."

  if (candidatesByDirection.get("north").size === 0) {
    candidatesByDirection.set("north", candidatesByDirection.get("south"));
  } else if (candidatesByDirection.get("south").size === 0) {
    candidatesByDirection.set("south", candidatesByDirection.get("north"));
  }

  if (candidatesByDirection.get("east").size === 0) {
    candidatesByDirection.set("east", candidatesByDirection.get("west"));
  } else if (candidatesByDirection.get("west").size === 0) {
    candidatesByDirection.set("west", candidatesByDirection.get("east"));
  }

  return candidatesByDirection;
}

