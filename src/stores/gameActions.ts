/**
 * Game action functions that implement game moves.
 * These functions update the Zustand store to modify game state.
 *
 * Each function accesses state directly from the store and updates it
 * according to game rules and move validation.
 */

import { useGameStore } from './gameStore';
import type { GameStoreState, GameState, GameContext, PlayerProps, RegionCode } from './gameStore';
import { isMoveAllowed, isMoveAllowedForPlayer } from './moveValidation';
import { drawMarketContract, openMarketContracts, withReplacementMarketContract } from './marketExpiration';
import {
  generateStartingContract as generateStartingContractContract,
  generatePrivateContract as generatePrivateContractContract,
  generateMarketContract as generateMarketContractContract,
  newContract,
  MARKET_TABLEAU_SIZE,
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

/** Mark that the current player has made a move this turn (enables Undo button). */
function markMovedThisTurn(): void {
  useGameStore.setState({ hasMovedThisTurn: true });
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

  markMovedThisTurn();
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

  markMovedThisTurn();
  saveCurrentGameState();
}

/**
 * Fill the market tableau up to MARKET_TABLEAU_SIZE open market contracts, keeping the ones
 * already there. Does nothing if it is already full. The +M button calls this.
 */
export function fillMarketTableau(): void {
  const { G, ctx } = useGameStore.getState();

  if (!isMoveAllowed('fillMarketTableau', ctx)) {
    console.warn('[fillMarketTableau] Move not allowed in current phase');
    return;
  }

  let contracts = G.contracts;
  const missing = MARKET_TABLEAU_SIZE - openMarketContracts(contracts).length;
  for (let i = 0; i < missing; i++) {
    const contract = drawMarketContract(G, contracts);
    if (!contract) {
      console.error('[fillMarketTableau] Failed to generate a market contract');
      break;
    }
    contracts = [contract, ...contracts];
  }
  if (contracts === G.contracts) return;

  useGameStore.setState((state) => ({ G: { ...state.G, contracts } }));

  const updatedState = useGameStore.getState();
  checkPhaseTransition(updatedState.G, updatedState.ctx);

  markMovedThisTurn();
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
    // Claiming cancels any expiration countdown.
    const updatedContracts = state.G.contracts.map((c) => {
      if (c.id !== contractID) return c;
      const { roundsLeft: _roundsLeft, ...rest } = c;
      return { ...rest, playerID: ctx.currentPlayer, turnsHeld: 1 } as Contract;
    });

    return {
      G: {
        ...state.G,
        contracts: withReplacementMarketContract(state.G, updatedContracts),
      },
    } as Partial<GameStoreState>;
  });

  const updatedState = useGameStore.getState();
  checkPhaseTransition(updatedState.G, updatedState.ctx);

  markMovedThisTurn();
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

  // Private: set playerID to current player; market: leave playerID null until claimed
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

  markMovedThisTurn();
  saveCurrentGameState();
}

/**
 * Fulfil one of the current player's unfulfilled contracts: their private contract or the
 * market contract they claimed. Open market contracts must be claimed first, and a fulfilled
 * contract can't be unfulfilled (Undo restores the start-of-turn state instead).
 * The name is historical; the move only ever fulfils.
 */
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

  if (contract.fulfilled) {
    console.warn(`[toggleContractFulfilled] Contract "${contractID}" is already fulfilled`);
    return;
  }

  if (contract.playerID !== ctx.currentPlayer) {
    console.warn(
      contract.type === 'market' && contract.playerID === null
        ? `[toggleContractFulfilled] Market contract "${contractID}" must be claimed before it can be fulfilled`
        : `[toggleContractFulfilled] Contract "${contractID}" does not belong to the current player`
    );
    return;
  }

  useGameStore.setState((state) => {
    const currentPlayerEntry = state.G.players.find(([id]) => id === ctx.currentPlayer);
    if (!currentPlayerEntry) {
      console.error(
        `[toggleContractFulfilled] Current player "${ctx.currentPlayer}" not found`
      );
      return state;
    }

    const updatedContracts = state.G.contracts.map((c, idx) =>
      idx === contractIndex ? ({ ...contract, fulfilled: true } as Contract) : c
    );

    const [, playerProps] = currentPlayerEntry;
    const updatedActiveCities = playerProps.activeCities.includes(contract.destinationKey)
      ? playerProps.activeCities
      : [...playerProps.activeCities, contract.destinationKey];

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

  markMovedThisTurn();
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

  markMovedThisTurn();
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
  railroad.routes.forEach((routeEntry) => {
    const route = routes.get(routeEntry.key);
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

  markMovedThisTurn();
  saveCurrentGameState();
}

const VALID_REGION_CODES: readonly RegionCode[] = [
  'NW',
  'NC',
  'NE',
  'SW',
  'SC',
  'SE',
];

export function claimHubCity(cityKey: string): boolean {
  const { G, ctx } = useGameStore.getState();

  if (!isMoveAllowed('claimHubCity', ctx)) {
    console.warn('[claimHubCity] Move not allowed in current phase');
    return false;
  }

  if (typeof cityKey !== 'string' || !cityKey) {
    console.error('[claimHubCity] cityKey must be a non-empty string');
    return false;
  }

  if (!cities.get(cityKey)) {
    console.error(`[claimHubCity] City "${cityKey}" not found`);
    return false;
  }

  const currentPlayerEntry = G.players.find(([id]) => id === ctx.currentPlayer);
  if (!currentPlayerEntry) {
    console.error(`[claimHubCity] Current player "${ctx.currentPlayer}" not found`);
    return false;
  }

  const [, playerProps] = currentPlayerEntry;
  if (playerProps.hubCity != null) {
    return false; // no-op: already has a hub city
  }

  const otherPlayerHasHub = G.players.some(
    ([id, props]) => id !== ctx.currentPlayer && props.hubCity === cityKey
  );
  if (otherPlayerHasHub) {
    console.error(`[claimHubCity] City "${cityKey}" is already another player's hub city`);
    return false;
  }

  const updatedActiveCities = playerProps.activeCities.includes(cityKey)
    ? playerProps.activeCities
    : [...playerProps.activeCities, cityKey];

  useGameStore.setState((state) => ({
    G: {
      ...state.G,
      players: state.G.players.map(([id, props]) =>
        id === ctx.currentPlayer
          ? [id, { ...props, hubCity: cityKey, activeCities: updatedActiveCities }]
          : [id, props]
      ),
    },
  }));

  const updatedState = useGameStore.getState();
  checkPhaseTransition(updatedState.G, updatedState.ctx);

  markMovedThisTurn();
  saveCurrentGameState();
  return true;
}

export function claimRegionalOffice(regionCode: string): boolean {
  const { G, ctx } = useGameStore.getState();

  if (!isMoveAllowed('claimRegionalOffice', ctx)) {
    console.warn('[claimRegionalOffice] Move not allowed in current phase');
    return false;
  }

  if (
    typeof regionCode !== 'string' ||
    !(VALID_REGION_CODES as readonly string[]).includes(regionCode)
  ) {
    console.error(
      '[claimRegionalOffice] regionCode must be one of: NW, NC, NE, SW, SC, SE'
    );
    return false;
  }

  const currentPlayerEntry = G.players.find(([id]) => id === ctx.currentPlayer);
  if (!currentPlayerEntry) {
    console.error(
      `[claimRegionalOffice] Current player "${ctx.currentPlayer}" not found`
    );
    return false;
  }

  const [, playerProps] = currentPlayerEntry;
  if (playerProps.regionalOffice != null) {
    return false; // no-op: already has a regional office
  }

  const regionTaken = G.players.some(
    ([id, p]) => id !== ctx.currentPlayer && p.regionalOffice === regionCode
  );
  if (regionTaken) {
    console.warn(
      `[claimRegionalOffice] Region "${regionCode}" is already claimed by another player`
    );
    return false;
  }

  useGameStore.setState((state) => ({
    G: {
      ...state.G,
      players: state.G.players.map(([id, props]) =>
        id === ctx.currentPlayer
          ? [id, { ...props, regionalOffice: regionCode as RegionCode }]
          : [id, props]
      ),
    },
  }));

  const updatedState = useGameStore.getState();
  checkPhaseTransition(updatedState.G, updatedState.ctx);

  markMovedThisTurn();
  saveCurrentGameState();
  return true;
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

  markMovedThisTurn();
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
