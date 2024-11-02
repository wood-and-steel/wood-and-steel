import { cities, commodities } from "./GameData";
import { shortestDistance } from "./graph";

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
      console.error("new Contract() failed");
      return undefined;
    }
    this.#destinationKey = destinationKey;
    this.#commodity = commodity;
    this.#type = type;
    this.#player = player;
  }

  // Instance methods
  
  toString() { return `${this.#commodity} -> ${this.#destinationKey} (${this.#type}${(this.#player ? `, ${this.#player}` : "")})`; }

  // Need explicit JSON rendering to support being in G (see https://boardgame.io/documentation/#/?id=state)
  toJSON() { return `{ "destinationKey": "${this.#destinationKey}", "commodity:" "${this.#commodity}", "type": "${this.#type}", "player": ${this.#player} }`};
  // TODO: Deserialize from JSON to a Contract object in the right way

  equals(that) {
    return that instanceof Contract &&
      this.#destinationKey === that.destinationKey &&
      this.#commodity === that.commodity &&
      this.#type === that.type &&
      this.#player === that.player;
  }

  // Static methods
  // static foo(c) {  }

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
  
}
