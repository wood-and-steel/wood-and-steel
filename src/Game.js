import { generateMarketContract, generatePrivateContract, generateStartingContract, newContract } from './Contract';
import { TurnOrder } from 'boardgame.io/core';
import { initializeIndependentRailroads, RailroadManager } from './RailroadCompany';

const railroadManager = new RailroadManager();

export const WoodAndSteel = {
  name: "wood-and-steel",
  
  setup: () => {

    initializeIndependentRailroads(railroadManager);

    console.log("Independent railroad companies:");

    // Log each company and its route
    for (const [name, company] of railroadManager.getCompanies()) {
      const routes = Array.from(company.getRoutes().keys());
      console.log(`\n${name}: ${routes.reduce((concat, route, index) => concat += (index === routes.length-1 ? route : `${route}, `))}`);
    }
    
    return { 
      contracts: Array(0),
      players: [
        [ '0', { name: "Player 0", activeCities: Array(0) } ],
        [ '1', { name: "Player 1", activeCities: Array(0) } ],
      ],
    }
  },

  moves: {

    // TODO: Get rid of generate*Contract as moves; wired them up this way temporarily to work around my lack of React skill
    generateStartingContract: ({ G, ctx }, activeCities) => {
      const contract = generateStartingContract(G, activeCities, ctx.currentPlayer);
      if (contract) {
        G.contracts.unshift(contract);
      } else {
        console.error("Game.js: generateStartingContract failed");
      }
    },

    generatePrivateContract: ({ G }, activeCities, currentCityKey) => {
      const contract = generatePrivateContract(G, activeCities, currentCityKey);
      if (contract) {
        G.contracts.unshift(contract);
      } else {
        console.error("Game.js: generatePrivateContract failed");
      }
    },

    generateMarketContract: ({ G }, activeCities) => {
      const contract = generateMarketContract(G, activeCities);
      if (contract) {
        G.contracts.unshift(contract);
      } else {
        console.error("Game.js: generateMarketContract failed");
      }
    },

    addManualContract: ({ G }, destinationKey, commodity, type) => {
      const contract = newContract(destinationKey, commodity, { type: type })
      if (contract) {
        G.contracts.unshift(contract);
      } else {
        console.error("Game.js: generateManualContract failed");
      }
    },

    toggleContractFulfilled: ({ G, ctx }, contractId) => {
      // Get this contract
      const contractIndex = G.contracts.findIndex(c => c.id === contractId);
      if (contractIndex !== -1) {
        // Toggle the fulfilled state
        G.contracts[contractIndex].fulfilled = !G.contracts[contractIndex].fulfilled;

        // Add the destination city to this player's active cities
        if (G.contracts[contractIndex].fulfilled) {
          const thisPlayersCities = G.players.find(([id, props]) => id === ctx.currentPlayer)[1].activeCities;
          if (!thisPlayersCities.includes(G.contracts[contractIndex].destinationKey)) {
            thisPlayersCities.push(G.contracts[contractIndex].destinationKey);
          } 
        }
      }
    },

    deleteContract: ({ G }, contractId) => {
      const contractIndex = G.contracts.findIndex(c => c.id === contractId);
      if (contractIndex !== -1) G.contracts.splice(contractIndex, 1);
    },

    endTurn: ({ events }) => {
      events.endTurn();
    }
  },

  turn: {
    order: TurnOrder.DEFAULT,
  }
};
