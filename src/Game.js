import Contract from "./Contract"
import { TurnOrder } from 'boardgame.io/core';

export const WoodAndSteel = {
  name: "wood-and-steel",
  
  setup: () => ({ 
    contracts: Array(0),
  }),

  moves: {

    // TODO: Get rid of generate*Contract as moves; wired them up this way temporarily to work around my lack of React skill
    generateStartingContract: ({ G, playerID }, activeCities) => {
      const contract = Contract.generateStartingContract(G, activeCities);
      if (contract) {
        G.contracts.push(contract.toJSON());
      } else {
        console.error("Game.js: generateStartingContract failed");
      }
    },

    generatePrivateContract: ({ G, playerID }, activeCities, currentCityKey) => {
      const contract = Contract.generatePrivateContract(G, activeCities, currentCityKey);
      if (contract) {
        G.contracts.push(contract.toJSON());
      } else {
        console.error("Game.js: generatePrivateContract failed");
      }
  },

    generateMarketContract: ({ G, playerID }, activeCities) => {
      const contract = Contract.generateMarketContract(G, activeCities);
      if (contract) {
        G.contracts.push(contract.toJSON());
      } else {
        console.error("Game.js: generateMarketContract failed");
      }
    },
  },

  turn: {
    // HACK: Storing multiple players in G for contracts, but only rendeirng client
    // for player 0, so we want to make sure it's always player 0's turn for now.
    order: TurnOrder.CUSTOM(['0']),
  }
};
