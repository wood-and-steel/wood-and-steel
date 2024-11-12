import { generateMarketContract, generatePrivateContract, generateStartingContract, newContract } from './Contract';
import { TurnOrder } from 'boardgame.io/core';

export const WoodAndSteel = {
  name: "wood-and-steel",
  
  setup: () => ({ 
    contracts: Array(0),
  }),

  moves: {

    // TODO: Get rid of generate*Contract as moves; wired them up this way temporarily to work around my lack of React skill
    generateStartingContract: ({ G, playerID }, activeCities) => {
      const contract = generateStartingContract(G, activeCities);
      if (contract) {
        G.contracts.unshift(contract);
      } else {
        console.error("Game.js: generateStartingContract failed");
      }
    },

    generatePrivateContract: ({ G, playerID }, activeCities, currentCityKey) => {
      const contract = generatePrivateContract(G, activeCities, currentCityKey);
      if (contract) {
        G.contracts.unshift(contract);
      } else {
        console.error("Game.js: generatePrivateContract failed");
      }
    },

    generateMarketContract: ({ G, playerID }, activeCities) => {
      const contract = generateMarketContract(G, activeCities);
      if (contract) {
        G.contracts.unshift(contract);
      } else {
        console.error("Game.js: generateMarketContract failed");
      }
    },

    addManualContract: ({ G, playerID }, destinationKey, commodity, type) => {
      const contract = newContract(destinationKey, commodity, { type: type })
      if (contract) {
        G.contracts.unshift(contract);
      } else {
        console.error("Game.js: generateManualContract failed");
      }
    },

    toggleContractFulfilled: ({ G, playerID }, contractIndex) => {
      G.contracts[contractIndex].fulfilled = !G.contracts[contractIndex].fulfilled;
    },

    deleteContract: ({ G, playerID }, contractIndex) => {
      G.contracts.splice(contractIndex, 1);
    },

  },

  turn: {
    // HACK: Storing multiple players in G for contracts, but only rendeirng client
    // for player 0, so we want to make sure it's always player 0's turn for now.
    order: TurnOrder.CUSTOM(['0']),
  }
};
