import { generateStartingContract } from "./graph";

export const WoodAndSteel = {
  setup: () => ({ 
    contractsGenerated: Array(0), // Not sure this really wants to be part of G, but hacked in for the moment
    contractsCompleted: Array(0),
  }),

  moves: {

    // I don't think generating contracts should be a move, but I wired it up this way for now,
    // partly to get boardgame.io running and partly as a hack to get starting contract generation
    // into an interactive state.

    generateContract: ({ G }, activeCities) => {
      const contract = generateStartingContract(activeCities);
      G.contractsGenerated.push(contract.toJSON());
    },
  },
};
