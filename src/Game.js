import { generateMarketContract, generatePrivateContract, generateStartingContract, newContract } from './Contract';
import { TurnOrder } from 'boardgame.io/core';
import { initializeIndependentRailroads, RailroadManager, growIndependentRailroads } from './independentRailroads';
import { routes } from './GameData';

const independentRailroadManager = new RailroadManager();

export const WoodAndSteel = {
  name: "wood-and-steel",
  
  setup: () => {

    initializeIndependentRailroads(independentRailroadManager);
    const independentRailroads = independentRailroadManager.getCompanies();

    return { 
      contracts: Array(0),
      players: [
        [ '0', { name: "Player 0", activeCities: Array(0) } ],
        [ '1', { name: "Player 1", activeCities: Array(0) } ],
      ],
      independentRailroads: independentRailroads,
    }
  },

  moves: {

    generateStartingContract: ({ G, ctx }, activeCities) => {
      const contract = generateStartingContract(G, activeCities, ctx.currentPlayer);
      if (contract) {
        G.contracts.unshift(contract);
      } else {
        console.error("Game.js: generateStartingContract failed");
      }
    },

    generatePrivateContract: ({ G, ctx }) => {
      const contract = generatePrivateContract(G, ctx);
      if (contract) {
        G.contracts.unshift(contract);
      } else {
        console.error("Game.js: generatePrivateContract failed");
      }
    },

    generateMarketContract: ({ G }) => {
      const contract = generateMarketContract(G);
      if (contract) {
        G.contracts.unshift(contract);
      } else {
        console.error("Game.js: generateMarketContract failed");
      }
    },

    addManualContract: ({ G, ctx }, commodity, destinationKey, type) => {
      const contract = newContract(destinationKey, commodity, { type: type, playerID: ctx.currentPlayer })
      if (contract) {
        G.contracts.unshift(contract);
      } else {
        console.error("Game.js: generateManualContract failed");
      }
    },

    toggleContractFulfilled: ({ G, ctx }, contractID) => {
      // Get this contract
      const thisContract = G.contracts.find(c => c.id === contractID);
      if (thisContract) {

        // Only toggle if it's the current player's contract or an unfulfilled market contract
        if (
          (thisContract.playerID === ctx.currentPlayer) || 
          (thisContract.type === "market" && !thisContract.fulfilled) ||
          (thisContract.type === "market" && thisContract.fulfilled && thisContract.playerID === ctx.currentPlayer)
        ) {
          
          // Toggle the fulfilled state
          thisContract.fulfilled = !thisContract.fulfilled;

          const currentPlayersCities = G.players.find(([id, props]) => id === ctx.currentPlayer)[1].activeCities;

          if (thisContract.fulfilled) {
            // Put the playerID on a market contract
            if (thisContract.type === "market") {
              thisContract.playerID = ctx.currentPlayer;
            }
  
            // Add the destination city to this player's active cities if it's not already there
            if (!currentPlayersCities.includes(thisContract.destinationKey)) {
              currentPlayersCities.push(thisContract.destinationKey);
            } 
          } else {
            if (thisContract.type === "market") {
              thisContract.playerID = null;
            }

            // Remove the destination city from this player's active cities if this was their only fulfilled contract with it
            if (!G.contracts.find(contract => 
              contract.playerID === ctx.currentPlayer && 
              contract.fulfilled && 
              contract.destinationKey === thisContract.destinationKey
            )) {
              let indexToDelete = -1;
              while ((indexToDelete = currentPlayersCities.indexOf(thisContract.destinationKey)) !== -1) {
                currentPlayersCities.splice(indexToDelete, 1);
              }
            }
          }
        }
      }
    },

    deleteContract: ({ G }, contractID) => {
      const contractIndex = G.contracts.findIndex(c => c.id === contractID);
      if (contractIndex !== -1 && !G.contracts[contractIndex].fulfilled) G.contracts.splice(contractIndex, 1);
    },

    acquireIndependentRailroad: ({ G, ctx }, railroadID) => {
      // Get all the cities in this RR
      const citiesInRailroad = new Set();
      [...G.independentRailroads[railroadID].routes].forEach(routeKey => {
        const [city1, city2] = routes.get(routeKey).cities;
        citiesInRailroad.add(city1).add(city2);
      });
  
      // Add them to the current player's active cities
      const currentPlayer = G.players.find(([id, props]) => id === ctx.currentPlayer)[1];
      [...citiesInRailroad].forEach(city => currentPlayer.activeCities.push(city));

      // Delete the railroad
      G.independentRailroads.splice(railroadID, 1);
    },

    endTurn: ({ events }) => {
      events.endTurn();
    }
  },

  turn: {
    onEnd: ({ G, ctx }) => {
      // Do end of round actions if this is the end of the last player's turn
      if (ctx.playOrderPos === ctx.playOrder.length - 1) {
        console.log(growIndependentRailroads(G));
      }
    },
    order: TurnOrder.DEFAULT,
  }
};
