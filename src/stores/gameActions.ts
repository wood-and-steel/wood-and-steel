/**
 * Game action functions that implement game moves.
 * These functions update the Zustand store to modify game state.
 *
 * Each function accesses state directly from the store and updates it
 * according to game rules and move validation.
 */

import { useGameStore } from './gameStore';
import type { GameStoreState, GameState, GameContext, PlayerProps } from './gameStore';
import { isMoveAllowed, isMoveAllowedForPlayer } from './moveValidation';
import {
  generateStartingContract as generateStartingContractContract,
  generatePrivateContract as generatePrivateContractContract,
  generateMarketContract as generateMarketContractContract,
  newContract,
} from '../Contract';
import type { Contract } from '../Contract';
import { endTurn as endTurnEvent } from './events';
import { checkPhaseTransition } from './phaseManager';
import { routes, cities } from '../data';
import { getCurrentGameCode, saveGameState } from '../utils/gameManager';

/** Save game state to storage after moves. Fire-and-forget: does not block UI; errors are logged, not thrown. */
function saveCurrentGameState(): void {
  const code = getCurrentGameCode();
  if (code) {
    const { G, ctx } = useGameStore.getState();
    saveGameState(code, G, ctx).catch((error: unknown) => {
      console.error(
        '[saveCurrentGameState] Failed to save game state:',
        error instanceof Error ? error.message : String(error)
      );
    });
  }
}

export function generateStartingContract(
  activeCities: string[],
  playerID?: string
): void {
  const { G, ctx } = useGameStore.getState();
  const moveAllowed = playerID
    ? isMoveAllowedForPlayer('generateStartingContract', playerID, ctx)
    : isMoveAllowed('generateStartingContract', ctx);
  if (!moveAllowed) {
    console.warn('[generateStartingContract] Move not allowed in current phase');
    return;
  }

  if (!Array.isArray(activeCities) || activeCities.length !== 2) {
    console.error('[generateStartingContract] activeCities must be an array of 2 city keys');
    return;
  }

  const activeCitiesTuple: [string, string] = [activeCities[0], activeCities[1]];
  const contract = generateStartingContractContract(G, activeCitiesTuple, ctx.currentPlayer);

  if (!contract) {
    console.error('[generateStartingContract] Contract generation failed');
    return;
  }

  useGameStore.setState((state) => ({
    G: {
      ...state.G,
      // Add contract to beginning of contracts array
      contracts: [contract, ...state.G.contracts],
      players: state.G.players.map(([id, props]) =>
        id === ctx.currentPlayer
          ? [id, { ...props, activeCities: [...activeCitiesTuple] }]
          : [id, props]
      ),
    },
  }));

  const updatedState = useGameStore.getState();
  checkPhaseTransition(updatedState.G, updatedState.ctx);

  saveCurrentGameState();
  // Automatically end turn after choosing starting cities; endTurnEvent() saves state internally
  endTurnEvent();
}

export function generatePrivateContract(): void {
  const { G, ctx } = useGameStore.getState();

  if (!isMoveAllowed('generatePrivateContract', ctx)) {
    console.warn('[generatePrivateContract] Move not allowed in current phase');
    return;
  }

  const contract = generatePrivateContractContract(G, ctx);

  if (!contract) {
    console.error('[generatePrivateContract] Contract generation failed');
    return;
  }

  useGameStore.setState((state) => ({
    G: {
      ...state.G,
      // Add contract to beginning of contracts array
      contracts: [contract, ...state.G.contracts],
    },
  }));

  saveCurrentGameState();
}

export function generateMarketContract(): void {
  const { G, ctx } = useGameStore.getState();

  if (!isMoveAllowed('generateMarketContract', ctx)) {
    console.warn('[generateMarketContract] Move not allowed in current phase');
    return;
  }

  const activeContractKeys = new Set(
    G.contracts
      .filter((c) => !c.fulfilled)
      .map((c) => `${c.commodity}|${c.destinationKey}`)
  );

  const maxAttempts = 50;
  let contract: Contract | undefined;

  for (let attempts = 0; attempts < maxAttempts; attempts++) {
    const candidate = generateMarketContractContract(G);
    if (!candidate) {
      console.error('[generateMarketContract] Contract generation failed');
      return;
    }
    const key = `${candidate.commodity}|${candidate.destinationKey}`;
    if (!activeContractKeys.has(key)) {
      contract = candidate;
      break;
    }
  }

  if (!contract) {
    console.error(
      '[generateMarketContract] Failed to generate a market contract that does not duplicate an active contract after 50 attempts'
    );
    return;
  }

  useGameStore.setState((state) => ({
    G: {
      ...state.G,
      // Add contract to beginning of contracts array
      contracts: [contract, ...state.G.contracts],
    },
  }));

  const updatedState = useGameStore.getState();
  checkPhaseTransition(updatedState.G, updatedState.ctx);

  saveCurrentGameState();
}

export function claimMarketContract(contractID: string): void {
  const { G, ctx } = useGameStore.getState();

  if (!isMoveAllowed('claimMarketContract', ctx)) {
    console.warn('[claimMarketContract] Move not allowed in current phase');
    return;
  }

  if (typeof contractID !== 'string' || !contractID) {
    console.error('[claimMarketContract] contractID must be a non-empty string');
    return;
  }

  const contractIndex = G.contracts.findIndex((c) => c.id === contractID);
  if (contractIndex === -1) {
    console.error(`[claimMarketContract] Contract with ID "${contractID}" not found`);
    return;
  }

  const contract = G.contracts[contractIndex];
  if (contract.type !== 'market') {
    console.error(`[claimMarketContract] Contract "${contractID}" is not a market contract`);
    return;
  }

  if (contract.playerID !== null) {
    console.error(`[claimMarketContract] Contract "${contractID}" is already claimed`);
    return;
  }

  useGameStore.setState((state) => {
    const updatedContracts = state.G.contracts.map((c) =>
      c.id === contractID ? { ...c, playerID: ctx.currentPlayer } as Contract : c
    );

    const activeContractKeys = new Set(
      updatedContracts
        .filter((c) => !c.fulfilled)
        .map((c) => `${c.commodity}|${c.destinationKey}`)
    );

    const maxAttempts = 50;
    let newMarketContract: Contract | undefined;

    for (let attempts = 0; attempts < maxAttempts; attempts++) {
      const candidate = generateMarketContractContract(state.G);
      if (!candidate) break;
      const key = `${candidate.commodity}|${candidate.destinationKey}`;
      if (!activeContractKeys.has(key)) {
        newMarketContract = candidate;
        break;
      }
    }

    const contracts = newMarketContract
      ? [newMarketContract, ...updatedContracts]
      : updatedContracts;

    return {
      G: {
        ...state.G,
        contracts,
      },
    } as Partial<GameStoreState>;
  });

  const updatedState = useGameStore.getState();
  checkPhaseTransition(updatedState.G, updatedState.ctx);

  saveCurrentGameState();
}

export function addContract(
  commodity: string,
  destinationKey: string,
  type: 'private' | 'market'
): void {
  const { ctx } = useGameStore.getState();

  if (!isMoveAllowed('addContract', ctx)) {
    console.warn('[addContract] Move not allowed in current phase');
    return;
  }

  if (typeof commodity !== 'string' || !commodity) {
    console.error('[addContract] commodity must be a non-empty string');
    return;
  }

  if (typeof destinationKey !== 'string' || !destinationKey) {
    console.error('[addContract] destinationKey must be a non-empty string');
    return;
  }

  if (type !== 'private' && type !== 'market') {
    console.error('[addContract] type must be "private" or "market"');
    return;
  }

  // Private: set playerID to current player; market: leave playerID null until fulfilled
  const contract = newContract(destinationKey, commodity, {
    type,
    playerID: type === 'private' ? ctx.currentPlayer : null,
  });

  if (!contract) {
    console.error('[addContract] Contract creation failed');
    return;
  }

  useGameStore.setState((state) => ({
    G: {
      ...state.G,
      // Add contract to beginning of contracts array
      contracts: [contract, ...state.G.contracts],
    },
  }));

  const updatedState = useGameStore.getState();
  checkPhaseTransition(updatedState.G, updatedState.ctx);

  saveCurrentGameState();
}

export function toggleContractFulfilled(contractID: string): void {
  const { G, ctx } = useGameStore.getState();

  if (!isMoveAllowed('toggleContractFulfilled', ctx)) {
    console.warn('[toggleContractFulfilled] Move not allowed in current phase');
    return;
  }

  if (typeof contractID !== 'string' || !contractID) {
    console.error('[toggleContractFulfilled] contractID must be a non-empty string');
    return;
  }

  const contractIndex = G.contracts.findIndex((c) => c.id === contractID);
  if (contractIndex === -1) {
    console.error(`[toggleContractFulfilled] Contract with ID "${contractID}" not found`);
    return;
  }

  const contract = G.contracts[contractIndex];

  // Current player's contract, or unfulfilled market contract, or market contract they fulfilled
  const canToggle =
    contract.playerID === ctx.currentPlayer ||
    (contract.type === 'market' && !contract.fulfilled) ||
    (contract.type === 'market' && contract.fulfilled && contract.playerID === ctx.currentPlayer);

  if (!canToggle) {
    console.warn(
      `[toggleContractFulfilled] Contract "${contractID}" cannot be toggled by current player`
    );
    return;
  }

  useGameStore.setState((state) => {
    const updatedContract: Contract = {
      ...contract,
      fulfilled: !contract.fulfilled,
    };

    // Market contract: assign playerID when fulfilled, clear when unfulfilled
    if (updatedContract.fulfilled && updatedContract.type === 'market') {
      updatedContract.playerID = ctx.currentPlayer;
    } else if (!updatedContract.fulfilled && updatedContract.type === 'market') {
      updatedContract.playerID = null;
    }

    const updatedContracts = state.G.contracts.map((c, idx) =>
      idx === contractIndex ? updatedContract : c
    );

    const currentPlayerEntry = state.G.players.find(([id]) => id === ctx.currentPlayer);
    if (!currentPlayerEntry) {
      console.error(
        `[toggleContractFulfilled] Current player "${ctx.currentPlayer}" not found`
      );
      return state;
    }

    const [, playerProps] = currentPlayerEntry;
    let updatedActiveCities = [...playerProps.activeCities];

    if (updatedContract.fulfilled) {
      if (!updatedActiveCities.includes(updatedContract.destinationKey)) {
        updatedActiveCities = [...updatedActiveCities, updatedContract.destinationKey];
      }
    } else {
      // Remove destination from activeCities only if no other fulfilled contract has that destination
      const hasOtherFulfilledContract = updatedContracts.some(
        (c) =>
          c.id !== contractID &&
          c.playerID === ctx.currentPlayer &&
          c.fulfilled &&
          c.destinationKey === updatedContract.destinationKey
      );

      if (!hasOtherFulfilledContract) {
        // Remove all instances of this city (in case of duplicates)
        updatedActiveCities = updatedActiveCities.filter(
          (city) => city !== updatedContract.destinationKey
        );
      }
    }

    const updatedPlayers = state.G.players.map(([id, props]) =>
      id === ctx.currentPlayer
        ? [id, { ...props, activeCities: updatedActiveCities }]
        : [id, props]
    );

    return {
      G: {
        ...state.G,
        contracts: updatedContracts,
        players: updatedPlayers,
      },
    } as Partial<GameStoreState>;
  });

  const updatedState = useGameStore.getState();
  checkPhaseTransition(updatedState.G, updatedState.ctx);

  saveCurrentGameState();
}

export function deleteContract(contractID: string): void {
  const { G, ctx } = useGameStore.getState();

  if (!isMoveAllowed('deleteContract', ctx)) {
    console.warn('[deleteContract] Move not allowed in current phase');
    return;
  }

  if (typeof contractID !== 'string' || !contractID) {
    console.error('[deleteContract] contractID must be a non-empty string');
    return;
  }

  const contractIndex = G.contracts.findIndex((c) => c.id === contractID);
  if (contractIndex === -1) {
    console.error(`[deleteContract] Contract with ID "${contractID}" not found`);
    return;
  }

  const contract = G.contracts[contractIndex];

  // Only unfulfilled contracts can be deleted
  if (contract.fulfilled) {
    console.warn(`[deleteContract] Cannot delete fulfilled contract "${contractID}"`);
    return;
  }

  useGameStore.setState((state) => ({
    G: {
      ...state.G,
      contracts: state.G.contracts.filter((_, idx) => idx !== contractIndex),
    },
  }));

  const updatedState = useGameStore.getState();
  checkPhaseTransition(updatedState.G, updatedState.ctx);

  saveCurrentGameState();
}

export function acquireIndependentRailroad(railroadName: string): void {
  const { G, ctx } = useGameStore.getState();

  if (!isMoveAllowed('acquireIndependentRailroad', ctx)) {
    console.warn('[acquireIndependentRailroad] Move not allowed in current phase');
    return;
  }

  if (typeof railroadName !== 'string' || !railroadName) {
    console.error('[acquireIndependentRailroad] railroadName must be a non-empty string');
    return;
  }

  const railroad = G.independentRailroads[railroadName];
  if (!railroad) {
    console.error(`[acquireIndependentRailroad] Railroad "${railroadName}" not found`);
    return;
  }

  // Collect all cities in this railroad from its routes
  const citiesInRailroad = new Set<string>();
  railroad.routes.forEach((routeKey) => {
    const route = routes.get(routeKey);
    if (route?.cities) {
      route.cities.forEach((city) => citiesInRailroad.add(city));
    }
  });

  useGameStore.setState((state) => {
    const currentPlayerEntry = state.G.players.find(([id]) => id === ctx.currentPlayer);
    if (!currentPlayerEntry) {
      console.error(
        `[acquireIndependentRailroad] Current player "${ctx.currentPlayer}" not found`
      );
      return state;
    }

    const [, playerProps] = currentPlayerEntry;

    // Add all cities from the railroad to current player's active cities (Set avoids duplicates)
    const updatedActiveCities = Array.from(
      new Set([...playerProps.activeCities, ...citiesInRailroad])
    );

    const updatedPlayers: [string, PlayerProps][] = state.G.players.map(([id, props]) =>
      id === ctx.currentPlayer
        ? [id, { ...props, activeCities: updatedActiveCities }]
        : [id, props]
    );

    // Remove the acquired railroad from independentRailroads
    const { [railroadName]: _removed, ...restRailroads } = state.G.independentRailroads;

    return {
      G: {
        ...state.G,
        players: updatedPlayers,
        independentRailroads: restRailroads,
      },
    };
  });

  const updatedState = useGameStore.getState();
  checkPhaseTransition(updatedState.G, updatedState.ctx);

  saveCurrentGameState();
}

export function addCityToPlayer(cityKey: string): void {
  const { G, ctx } = useGameStore.getState();

  if (!isMoveAllowed('addCityToPlayer', ctx)) {
    console.warn('[addCityToPlayer] Move not allowed in current phase');
    return;
  }

  if (typeof cityKey !== 'string' || !cityKey) {
    console.error('[addCityToPlayer] cityKey must be a non-empty string');
    return;
  }

  if (!cities.get(cityKey)) {
    console.error(`[addCityToPlayer] City "${cityKey}" not found`);
    return;
  }

  const currentPlayerEntry = G.players.find(([id]) => id === ctx.currentPlayer);
  if (!currentPlayerEntry) {
    console.error(`[addCityToPlayer] Current player "${ctx.currentPlayer}" not found`);
    return;
  }

  const [, playerProps] = currentPlayerEntry;

  if (playerProps.activeCities.includes(cityKey)) {
    console.warn(`[addCityToPlayer] City "${cityKey}" is already in player's active cities`);
    return;
  }

  useGameStore.setState((state) => ({
    G: {
      ...state.G,
      players: state.G.players.map(([id, props]) =>
        id === ctx.currentPlayer
          ? [id, { ...props, activeCities: [...props.activeCities, cityKey] }]
          : [id, props]
      ),
    },
  }));

  const updatedState = useGameStore.getState();
  checkPhaseTransition(updatedState.G, updatedState.ctx);

  saveCurrentGameState();
}

export function endTurn(): void {
  const { ctx } = useGameStore.getState();

  if (!isMoveAllowed('endTurn', ctx)) {
    console.warn('[endTurn] Move not allowed in current phase');
    return;
  }

  endTurnEvent(); // Advances turn; may save state internally
  saveCurrentGameState();
}
