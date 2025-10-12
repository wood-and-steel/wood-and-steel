import { generateMarketContract, generatePrivateContract, generateStartingContract, newContract } from './Contract';
import { TurnOrder } from 'boardgame.io/core';
import { initializeIndependentRailroads, RailroadManager, growIndependentRailroads } from './independentRailroads';
import { routes } from './data';

export const WoodAndSteel = {
  name: "wood-and-steel",
  
  setup: ({ numPlayers = 2 }) => {

    const independentRailroadManager = new RailroadManager();
    initializeIndependentRailroads(independentRailroadManager);
    const independentRailroadsArray = independentRailroadManager.getCompanies();

    // Convert array to object keyed by railroad name for stable IDs
    const independentRailroads = {};
    independentRailroadsArray.forEach(railroad => {
      independentRailroads[railroad.name] = railroad;
    });

    return { 
      contracts: Array(0),
      players: Array.from({ length: numPlayers }, (_, i) => [
        String(i),
        { name: `Player ${i}`, activeCities: Array(0) }
      ]),
      independentRailroads: independentRailroads,
    }
  },

  phases: {
    // Phase 1: Setup - Each player chooses starting cities and gets a starting contract
    setup: {
      start: true,
      next: 'play',
      
      turn: {
        order: TurnOrder.DEFAULT,
      },
      
      moves: {
        generateStartingContract: ({ G, ctx, events }, activeCities) => {
          const contract = generateStartingContract(G, activeCities, ctx.currentPlayer);
          if (contract) {
            G.contracts.unshift(contract);
            // Automatically end turn after choosing starting cities
            events.endTurn();
          } else {
            console.error("Game.js: generateStartingContract failed");
          }
        },
      },
      
      endIf: ({ G, ctx }) => {
        // End setup phase when all players have a private contract
        // Count how many players have at least one private contract
        const playersWithContracts = new Set(
          G.contracts
            .filter(c => c.playerID !== null)
            .map(c => c.playerID)
        );
        return playersWithContracts.size >= ctx.numPlayers;
      },
      
      onEnd: ({ G }) => {
        console.log('Setup phase complete. Starting main game.');
      }
    },

    // Phase 2: Play - Main game with all normal actions
    play: {
      next: 'scoring',
      
      turn: {
        order: TurnOrder.DEFAULT,
        
        onEnd: ({ G, ctx }) => {
          // Do end of round actions if this is the end of the last player's turn
          if (ctx.playOrderPos === ctx.playOrder.length - 1) {
            console.log(growIndependentRailroads(G));
          }
        },
      },
      
      moves: {
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

        acquireIndependentRailroad: ({ G, ctx }, railroadName) => {
          // Validate railroad exists
          const railroad = G.independentRailroads[railroadName];
          if (!railroad) {
            console.error(`Game.js: Railroad ${railroadName} not found`);
            return;
          }

          // Get all the cities in this RR
          const citiesInRailroad = new Set();
          [...railroad.routes].forEach(routeKey => {
            const [city1, city2] = routes.get(routeKey).cities;
            citiesInRailroad.add(city1);
            citiesInRailroad.add(city2);
          });
      
          // Add them to the current player's active cities
          const currentPlayer = G.players.find(([id, props]) => id === ctx.currentPlayer)[1];
          [...citiesInRailroad].forEach(city => currentPlayer.activeCities.push(city));

          // Delete the railroad using its name
          delete G.independentRailroads[railroadName];
        },

        endTurn: ({ events }) => {
          events.endTurn();
        }
      },
      
      // No automatic end condition yet - game continues indefinitely
      endIf: ({ G, ctx }) => {
        return false;
      }
    },

    // Phase 3: Scoring - Stub for future implementation
    scoring: {
      next: 'scoring',
      
      turn: {
        order: TurnOrder.DEFAULT,
      },
      
      moves: {
        // Stub - no moves available yet
      },
      
      onBegin: ({ G, ctx }) => {
        console.log('Scoring phase reached. This is a stub for future implementation.');
      }
    }
  }
};
