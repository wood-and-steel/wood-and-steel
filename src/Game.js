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

    toggleContractFulfilled: ({ G, playerID }, contractId) => {
      const contractIndex = G.contracts.findIndex(c => c.id === contractId);
      if (contractIndex !== -1) G.contracts[contractIndex].fulfilled = !G.contracts[contractIndex].fulfilled;
    },

    deleteContract: ({ G, playerID }, contractId) => {
      const contractIndex = G.contracts.findIndex(c => c.id === contractId);
      if (contractIndex !== -1) G.contracts.splice(contractIndex, 1);
    },

    endTurn: ({ G, events }) => {
      events.endTurn();
    }
  },

  turn: {
    order: TurnOrder.DEFAULT,
  }
};
