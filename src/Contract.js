import { cities, commodities } from "./GameData";

export default class Contract {

  #destinationKey;
  #commodity;
  #player;
  #type;

  constructor({
    destinationKey,                 // Key of the destination city
    commodity,                      // Name of the commodity
    type = Contract.types.Market,   // One of Contract.types
    player = null,                  // ID of player who has claimed or fulfilled a contract
  }) {
      if (
        !cities.get(destinationKey) || 
        !commodities.get(commodity) ||
        !Contract.types.hasOwnProperty(type)
      ) {
        // TODO: Add test for player validity
        return undefined;
      }
      this.#destinationKey = destinationKey;
      this.#commodity = commodity;
      this.#type = type;
      this.#player = player;
  }

  // Instance methods
  // TODO: rewardValue() { return distance from the destination to the nearest city that produces the commodity * $3K }

  toString() { return `${this.#commodity} -> ${this.#destinationKey} (${this.#type}${(this.#player ? `, ${this.#player}` : "")})`; }

  equals(that) {
      return that instanceof Contract &&
          this.#destinationKey === that.destinationKey &&
          this.#commodity === that.commodity &&
          this.#type === that.type &&
          this.#player === that.player;
  }

  // Static methods
  // static rewardValue(c) {  }

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
    if (Contract.types.hasOwnProperty(t)) {
      this.#type = t;
    } else {
      console.error(`Contract.type(${t}): no such contract type`);
    }
  }
  get type() { return this.#type; }

  types = Object.freeze({
    Market: "Market",
    Private: "Private",
    Fulfilled: "Fulfilled",
  });
}
