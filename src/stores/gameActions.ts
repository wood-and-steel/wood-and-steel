/**
 * Game action functions that implement game moves.
 * These functions update the Zustand store to modify game state.
 *
 * Each function accesses state directly from the store and updates it
 * according to game rules and move validation.
 */

import { useGameStore } from './gameStore';
import type { GameStoreState, GameState, GameContext, LedgerEntry, PlayerProps, RegionCode } from './gameStore';
import { isMoveAllowed, isMoveAllowedForPlayer } from './moveValidation';
import { drawMarketContract, openMarketContracts, withReplacementMarketContract } from './marketExpiration';
import {
  generateStartingContract as generateStartingContractContract,
  generatePrivateContract as generatePrivateContractContract,
  newContract,
  MARKET_TABLEAU_SIZE,
} from '../Contract';
import type { Contract } from '../Contract';
import { endTurn as endTurnEvent } from './events';
import { checkPhaseTransition } from './phaseManager';
import { routes, cities, commodities } from '../data';
import { getCurrentGameCode, saveGameState } from '../utils/gameManager';
import {
  getEngineType,
  isEngineTypeId,
  type EngineSlot,
  type EngineTypeId,
} from '../rules/playerBoard';
import {
  BORROW_STEP,
  MARKET_CONTRACT_MIN_ENGINE,
  UPGRADE_NAMES,
  UPGRADE_PRICES,
  type UpgradeKey,
} from '../rules/rulesData';
import { LEDGER_LABELS, defaultDeliveringEngine, deliveryBreakdown, repayOptions } from '../rules/finance';
import {
  bestEngineLevel,
  engineLevel,
  enginePurchaseOptions,
  monopolizableCommodities,
  serviceYardOpen,
} from '../rules/engines';
import { indiePricePerRoute } from '../rules/railroads';
import { normalizePlayerProps } from './playerDefaults';

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

// --- Player board helpers --------------------------------------------------------

/** The current player's props, or undefined (logged) if they're missing. */
function currentPlayerProps(G: GameState, ctx: GameContext, move: string): PlayerProps | undefined {
  const entry = G.players.find(([id]) => id === ctx.currentPlayer);
  if (!entry) console.error(`[${move}] Current player "${ctx.currentPlayer}" not found`);
  return entry?.[1];
}

/** `G` with one player's props replaced and money-log entries added to this turn's ledger. */
function withPlayer(G: GameState, playerID: string, props: PlayerProps, entries: LedgerEntry[] = []): GameState {
  const players = G.players.map(([id, p]) => (id === playerID ? [id, props] : [id, p])) as [string, PlayerProps][];
  if (entries.length === 0) return { ...G, players };
  const earlier = G.turnLedger?.playerID === playerID ? G.turnLedger.entries : [];
  return { ...G, players, turnLedger: { playerID, entries: [...earlier, ...entries] } };
}

function isSlot(value: unknown): value is EngineSlot {
  return value === 0 || value === 1;
}

/** Whether `slot` is a token that has an engine on it. */
function isSlotWithEngine(player: PlayerProps, slot: unknown): slot is EngineSlot {
  return isSlot(slot) && player.engines[slot] !== null;
}

function withCargo(cargo: PlayerProps['cargo'], slot: EngineSlot, commodity: string | null): PlayerProps['cargo'] {
  return slot === 0 ? [commodity, cargo[1]] : [cargo[0], commodity];
}

/** A whole, positive number of `step` dollars. */
function isAmount(value: unknown, step: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value % step === 0;
}

/** After a move changes G: check for a phase transition, enable Undo, and save. */
function finishMove(): void {
  const updatedState = useGameStore.getState();
  checkPhaseTransition(updatedState.G, updatedState.ctx);
  markMovedThisTurn();
  saveCurrentGameState();
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

  // Anchored on the player the open market serves worst, like every other market draw.
  const contract = drawMarketContract(G, G.contracts);
  if (!contract) {
    console.error('[generateMarketContract] Failed to generate a market contract that does not duplicate an active contract');
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

/** `G.contracts` with open market contracts added up to MARKET_TABLEAU_SIZE; the same array if none were added. */
function filledMarketTableau(G: GameState): Contract[] {
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
  return contracts;
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

  const contracts = filledMarketTableau(G);
  if (contracts === G.contracts) return;

  useGameStore.setState((state) => ({ G: { ...state.G, contracts } }));

  const updatedState = useGameStore.getState();
  checkPhaseTransition(updatedState.G, updatedState.ctx);

  markMovedThisTurn();
  saveCurrentGameState();
}

/**
 * Claim an open market contract for the current player. Only owners of a Mogul or better can
 * claim, and a player holds at most one claimed contract at a time. `cargoSlot` optionally
 * records the commodity on that engine (cargo is optional; see docs/PLAYER_APP_REDESIGN_PLAN.md).
 */
export function claimMarketContract(contractID: string, cargoSlot?: EngineSlot): boolean {
  const { G, ctx } = useGameStore.getState();

  if (!isMoveAllowed('claimMarketContract', ctx)) {
    console.warn('[claimMarketContract] Move not allowed in current phase');
    return false;
  }

  if (typeof contractID !== 'string' || !contractID) {
    console.error('[claimMarketContract] contractID must be a non-empty string');
    return false;
  }

  const contractIndex = G.contracts.findIndex((c) => c.id === contractID);
  if (contractIndex === -1) {
    console.error(`[claimMarketContract] Contract with ID "${contractID}" not found`);
    return false;
  }

  const contract = G.contracts[contractIndex];
  if (contract.type !== 'market') {
    console.error(`[claimMarketContract] Contract "${contractID}" is not a market contract`);
    return false;
  }

  if (contract.playerID !== null) {
    console.error(`[claimMarketContract] Contract "${contractID}" is already claimed`);
    return false;
  }

  const player = currentPlayerProps(G, ctx, 'claimMarketContract');
  if (!player) return false;

  if (bestEngineLevel(player.engines) < engineLevel(MARKET_CONTRACT_MIN_ENGINE)) {
    console.warn('[claimMarketContract] Claiming market contracts needs a Mogul or better');
    return false;
  }

  const holdsClaim = G.contracts.some(
    (c) => c.type === 'market' && !c.fulfilled && c.playerID === ctx.currentPlayer
  );
  if (holdsClaim) {
    console.warn('[claimMarketContract] The player already holds a claimed market contract');
    return false;
  }

  if (cargoSlot !== undefined && !isSlotWithEngine(player, cargoSlot)) {
    console.warn('[claimMarketContract] cargoSlot must be a token with an engine');
    return false;
  }

  useGameStore.setState((state) => {
    // Claiming cancels any expiration countdown.
    const updatedContracts = state.G.contracts.map((c) => {
      if (c.id !== contractID) return c;
      const { roundsLeft: _roundsLeft, ...rest } = c;
      return { ...rest, playerID: ctx.currentPlayer, turnsHeld: 1 } as Contract;
    });

    const claimed = {
      ...state.G,
      contracts: withReplacementMarketContract(state.G, updatedContracts),
    };
    return {
      G:
        cargoSlot === undefined
          ? claimed
          : withPlayer(claimed, ctx.currentPlayer, {
              ...player,
              cargo: withCargo(player.cargo, cargoSlot, contract.commodity),
            }),
    } as Partial<GameStoreState>;
  });

  finishMove();
  return true;
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
export function toggleContractFulfilled(contractID: string, engineSlot?: EngineSlot): boolean {
  const { G, ctx } = useGameStore.getState();

  if (!isMoveAllowed('toggleContractFulfilled', ctx)) {
    console.warn('[toggleContractFulfilled] Move not allowed in current phase');
    return false;
  }

  if (typeof contractID !== 'string' || !contractID) {
    console.error('[toggleContractFulfilled] contractID must be a non-empty string');
    return false;
  }

  const contractIndex = G.contracts.findIndex((c) => c.id === contractID);
  if (contractIndex === -1) {
    console.error(`[toggleContractFulfilled] Contract with ID "${contractID}" not found`);
    return false;
  }

  const contract = G.contracts[contractIndex];

  if (contract.fulfilled) {
    console.warn(`[toggleContractFulfilled] Contract "${contractID}" is already fulfilled`);
    return false;
  }

  if (contract.playerID !== ctx.currentPlayer) {
    console.warn(
      contract.type === 'market' && contract.playerID === null
        ? `[toggleContractFulfilled] Market contract "${contractID}" must be claimed before it can be fulfilled`
        : `[toggleContractFulfilled] Contract "${contractID}" does not belong to the current player`
    );
    return false;
  }

  const player = currentPlayerProps(G, ctx, 'toggleContractFulfilled');
  if (!player) return false;

  if (engineSlot !== undefined && !isSlotWithEngine(player, engineSlot)) {
    console.warn('[toggleContractFulfilled] engineSlot must be a token with an engine');
    return false;
  }

  const engine = engineSlot !== undefined ? player.engines[engineSlot] : defaultDeliveringEngine(player.engines);
  const receipt = deliveryBreakdown(player, contract, engine);
  if (!receipt.affordable) {
    // Bankruptcy isn't implemented: the player must borrow first (docs/PLAYER_APP_REDESIGN_PLAN.md, Decisions).
    console.warn('[toggleContractFulfilled] Debt service is more than the payout plus cash; borrow first');
    return false;
  }

  // The delivering engine no longer carries the commodity, if that was recorded.
  const cargoSlot =
    engineSlot !== undefined
      ? player.cargo[engineSlot] === contract.commodity
        ? engineSlot
        : undefined
      : ([0, 1] as EngineSlot[]).find((slot) => player.cargo[slot] === contract.commodity);

  const updatedPlayer: PlayerProps = {
    ...player,
    activeCities: player.activeCities.includes(contract.destinationKey)
      ? player.activeCities
      : [...player.activeCities, contract.destinationKey],
    cash: player.cash + receipt.net,
    centralDebtServicePaid: receipt.centralDebtServicePaid,
    westernDeliveryMade: receipt.westernDeliveryMade,
    cargo: cargoSlot === undefined ? player.cargo : withCargo(player.cargo, cargoSlot, null),
  };
  const entries: LedgerEntry[] = [
    {
      label: `Delivered ${contract.commodity} to ${contract.destinationKey}`,
      amount: receipt.value + receipt.engineBonus + receipt.stationsBonus,
    },
  ];
  if (receipt.debtService > 0) entries.push({ label: LEDGER_LABELS.debtService, amount: -receipt.debtService });

  useGameStore.setState((state) => ({
    G: withPlayer(
      {
        ...state.G,
        contracts: state.G.contracts.map((c, idx) =>
          idx === contractIndex ? ({ ...contract, fulfilled: true } as Contract) : c
        ),
      },
      ctx.currentPlayer,
      updatedPlayer,
      entries
    ),
  }));

  finishMove();
  return true;
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

/**
 * Discard and draw: replace the player's unfulfilled private contract with a new one, in one
 * state change and one save (two separate moves could save out of order and lose both).
 * Refused unless it's that player's turn. Returns whether the contract was replaced.
 */
export function replacePrivateContract(playerID: string, commodity: string, destinationKey: string): boolean {
  const { ctx } = useGameStore.getState();

  if (!isMoveAllowed('replacePrivateContract', ctx)) return false;
  if (playerID !== ctx.currentPlayer) {
    console.warn(`[replacePrivateContract] Not player ${playerID}'s turn`);
    return false;
  }

  const contract = newContract(destinationKey, commodity, { type: 'private', playerID });
  if (!contract) {
    console.error('[replacePrivateContract] Contract creation failed');
    return false;
  }

  useGameStore.setState((state) => ({
    G: {
      ...state.G,
      contracts: [
        contract,
        ...state.G.contracts.filter((c) => !(c.playerID === playerID && c.type === 'private' && !c.fulfilled)),
      ],
    },
  }));

  const updatedState = useGameStore.getState();
  checkPhaseTransition(updatedState.G, updatedState.ctx);

  markMovedThisTurn();
  saveCurrentGameState();
  return true;
}

/**
 * Acquire an independent railroad: $3,000 per route ($4,000 once anyone has delivered to the
 * West), refused if the player can't pay. Its cities join the player's active cities, and the
 * player earns ACQUISITION_TIES right away.
 */
export function acquireIndependentRailroad(railroadName: string): boolean {
  const { G, ctx } = useGameStore.getState();

  if (!isMoveAllowed('acquireIndependentRailroad', ctx)) {
    console.warn('[acquireIndependentRailroad] Move not allowed in current phase');
    return false;
  }

  if (typeof railroadName !== 'string' || !railroadName) {
    console.error('[acquireIndependentRailroad] railroadName must be a non-empty string');
    return false;
  }

  const railroad = G.independentRailroads[railroadName];
  if (!railroad) {
    console.error(`[acquireIndependentRailroad] Railroad "${railroadName}" not found`);
    return false;
  }

  const player = currentPlayerProps(G, ctx, 'acquireIndependentRailroad');
  if (!player) return false;

  const price = independentRailroadPrice(G, railroadName);
  if (price > player.cash) {
    console.warn(`[acquireIndependentRailroad] ${railroad.name} costs $${price}; the player has $${player.cash}`);
    return false;
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
    // Remove the acquired railroad from independentRailroads
    const { [railroadName]: _removed, ...restRailroads } = state.G.independentRailroads;
    return {
      G: withPlayer(
        { ...state.G, independentRailroads: restRailroads },
        ctx.currentPlayer,
        {
          ...player,
          // Add all cities from the railroad to the player's active cities (Set avoids duplicates)
          activeCities: Array.from(new Set([...player.activeCities, ...citiesInRailroad])),
          cash: player.cash - price,
          railroadsAcquired: player.railroadsAcquired + 1,
        },
        [{ label: `Acquired ${railroad.name}`, amount: -price }]
      ),
    };
  });

  finishMove();
  return true;
}

/** What an independent railroad costs now: its routes at $3,000 each, or $4,000 after a Western delivery. */
export function independentRailroadPrice(G: GameState, railroadName: string): number {
  const railroad = G.independentRailroads[railroadName];
  return railroad ? railroad.routes.length * indiePricePerRoute(G.contracts) : 0;
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

// --- Money, engines and upgrades (docs/PLAYER_APP_REDESIGN_PLAN.md, Moves) ------------------

/** The smallest unit of money in the game. */
const MONEY_UNIT = 1000;

/** Borrow in $5,000 steps; the rules set no limit. */
export function borrow(amount: number): boolean {
  const { G, ctx } = useGameStore.getState();
  if (!isMoveAllowed('borrow', ctx)) {
    console.warn('[borrow] Move not allowed in current phase');
    return false;
  }
  if (!isAmount(amount, BORROW_STEP)) {
    console.error('[borrow] amount must be a positive multiple of $5,000');
    return false;
  }
  const player = currentPlayerProps(G, ctx, 'borrow');
  if (!player) return false;

  useGameStore.setState({
    G: withPlayer(G, ctx.currentPlayer, { ...player, cash: player.cash + amount, debt: player.debt + amount }, [
      { label: LEDGER_LABELS.borrowed, amount },
    ]),
  });
  finishMove();
  return true;
}

/** Repay $5,000 or $10,000, only with $20,000+ of debt, never below $15,000, and only with the cash. */
export function repay(amount: number): boolean {
  const { G, ctx } = useGameStore.getState();
  if (!isMoveAllowed('repay', ctx)) {
    console.warn('[repay] Move not allowed in current phase');
    return false;
  }
  const player = currentPlayerProps(G, ctx, 'repay');
  if (!player) return false;
  if (!repayOptions(player).includes(amount)) {
    console.warn(`[repay] Can't repay $${amount} with $${player.debt} debt and $${player.cash} cash`);
    return false;
  }

  useGameStore.setState({
    G: withPlayer(G, ctx.currentPlayer, { ...player, cash: player.cash - amount, debt: player.debt - amount }, [
      { label: LEDGER_LABELS.repaid, amount: -amount },
    ]),
  });
  finishMove();
  return true;
}

/** Pay for track built this turn. The app doesn't price track; the player enters what they spent. */
export function payForTrack(amount: number): boolean {
  const { G, ctx } = useGameStore.getState();
  if (!isMoveAllowed('payForTrack', ctx)) {
    console.warn('[payForTrack] Move not allowed in current phase');
    return false;
  }
  if (!isAmount(amount, MONEY_UNIT)) {
    console.error('[payForTrack] amount must be a positive multiple of $1,000');
    return false;
  }
  const player = currentPlayerProps(G, ctx, 'payForTrack');
  if (!player) return false;
  if (amount > player.cash) {
    console.warn(`[payForTrack] $${amount} is more than the player's $${player.cash} cash`);
    return false;
  }

  useGameStore.setState({
    G: withPlayer(G, ctx.currentPlayer, { ...player, cash: player.cash - amount }, [
      { label: LEDGER_LABELS.paidForTrack, amount: -amount },
    ]),
  });
  finishMove();
  return true;
}

/**
 * Buy `engineType` for the token in `slot`: one level above the player's best engine, or two
 * with a Hub for $5,000 more. An engine already on that token is traded in for half its price
 * (rounded down to $1,000); its cargo stays with the token. The first Mogul or better on the
 * table opens the market, filling the tableau.
 */
export function buyEngine(slot: EngineSlot, engineType: EngineTypeId): boolean {
  const { G, ctx } = useGameStore.getState();
  if (!isMoveAllowed('buyEngine', ctx)) {
    console.warn('[buyEngine] Move not allowed in current phase');
    return false;
  }
  if (!isSlot(slot) || !isEngineTypeId(engineType)) {
    console.error('[buyEngine] slot must be 0 or 1 and engineType a known engine');
    return false;
  }
  const player = currentPlayerProps(G, ctx, 'buyEngine');
  if (!player) return false;

  const purchase = enginePurchaseOptions(player.engines, player.hubCity !== null).find(
    (option) => option.slot === slot && option.engine === engineType
  );
  if (!purchase) {
    console.warn(`[buyEngine] ${engineType} isn't available for token ${slot}`);
    return false;
  }
  if (purchase.cost > player.cash) {
    console.warn(`[buyEngine] ${engineType} costs $${purchase.cost}; the player has $${player.cash}`);
    return false;
  }

  const mogulLevel = engineLevel(MARKET_CONTRACT_MIN_ENGINE);
  const opensMarket =
    engineLevel(engineType) >= mogulLevel && G.players.every(([, p]) => bestEngineLevel(p.engines) < mogulLevel);

  const engines: PlayerProps['engines'] = slot === 0 ? [engineType, player.engines[1]] : [player.engines[0], engineType];
  const name = getEngineType(engineType).name;
  const label = purchase.tradeIn ? `Bought ${name}, trading in ${getEngineType(purchase.tradeIn).name}` : `Bought ${name}`;
  let next = withPlayer(G, ctx.currentPlayer, { ...player, engines, cash: player.cash - purchase.cost }, [
    { label, amount: -purchase.cost },
  ]);
  if (opensMarket) next = { ...next, contracts: filledMarketTableau(next) };

  useGameStore.setState({ G: next });
  finishMove();
  return true;
}

/**
 * Buy an upgrade. `choice` is the Hub city, the Regional Office region, or the Commodities
 * Exchange commodity; other upgrades take none. Each upgrade can be bought once; the Service
 * Yard opens once anyone owns a Consolidation; a Hub city, region, or monopoly commodity can't
 * be one another player already holds.
 */
export function buyUpgrade(upgrade: UpgradeKey, choice?: string): boolean {
  const { G, ctx } = useGameStore.getState();
  if (!isMoveAllowed('buyUpgrade', ctx)) {
    console.warn('[buyUpgrade] Move not allowed in current phase');
    return false;
  }
  if (!(upgrade in UPGRADE_PRICES)) {
    console.error(`[buyUpgrade] Unknown upgrade "${upgrade}"`);
    return false;
  }
  const player = currentPlayerProps(G, ctx, 'buyUpgrade');
  if (!player) return false;

  const refusal = upgradeRefusal(G, ctx.currentPlayer, player, upgrade, choice);
  if (refusal) {
    console.warn(`[buyUpgrade] ${refusal}`);
    return false;
  }
  const price = UPGRADE_PRICES[upgrade];
  if (price > player.cash) {
    console.warn(`[buyUpgrade] ${UPGRADE_NAMES[upgrade]} costs $${price}; the player has $${player.cash}`);
    return false;
  }

  let updated: PlayerProps = { ...player, cash: player.cash - price };
  if (upgrade === 'hub') {
    const city = choice as string;
    updated = {
      ...updated,
      hubCity: city,
      activeCities: player.activeCities.includes(city) ? player.activeCities : [...player.activeCities, city],
    };
  } else if (upgrade === 'regional-office') {
    updated = { ...updated, regionalOffice: choice as RegionCode };
  } else {
    updated = { ...updated, upgrades: [...player.upgrades, upgrade] };
    if (upgrade === 'commodities-exchange') updated = { ...updated, exchangeCommodity: choice as string };
  }

  const detail = choice ? ` (${choice})` : '';
  useGameStore.setState({
    G: withPlayer(G, ctx.currentPlayer, updated, [{ label: `Bought ${UPGRADE_NAMES[upgrade]}${detail}`, amount: -price }]),
  });
  finishMove();
  return true;
}

/** Why `player` can't buy `upgrade` with `choice` right now (ignoring cash), or null if they can. */
export function upgradeRefusal(
  G: GameState,
  playerID: string,
  player: PlayerProps,
  upgrade: UpgradeKey,
  choice?: string
): string | null {
  const others = G.players.filter(([id]) => id !== playerID).map(([, p]) => p);
  switch (upgrade) {
    case 'hub':
      if (player.hubCity !== null) return 'Already has a Hub';
      if (!choice || !cities.get(choice)) return 'Choose a city for the Hub';
      if (others.some((p) => p.hubCity === choice)) return `${choice} is already another player's Hub`;
      return null;
    case 'regional-office':
      if (player.regionalOffice !== null) return 'Already has a Regional Office';
      if (!choice || !(VALID_REGION_CODES as readonly string[]).includes(choice)) return 'Choose a region for the Regional Office';
      if (others.some((p) => p.regionalOffice === choice)) return 'Another player already has that region';
      return null;
    case 'commodities-exchange':
      if (player.upgrades.includes(upgrade)) return 'Already has a Commodities Exchange';
      if (!choice || !monopolizableCommodities().includes(choice)) return 'Choose a commodity that can be monopolized';
      if (others.some((p) => p.exchangeCommodity === choice)) return `Another player already has the ${choice} monopoly`;
      return null;
    case 'service-yard':
      if (player.upgrades.includes(upgrade)) return 'Already has a Service Yard';
      if (!serviceYardOpen(G.players.map(([, p]) => p.engines))) return 'Opens once any player owns a Consolidation';
      return null;
    default:
      return player.upgrades.includes(upgrade) ? `Already has a ${UPGRADE_NAMES[upgrade]}` : null;
  }
}

/** Record or clear what an engine carries. Optional bookkeeping: free, and not an action. */
export function setCargo(slot: EngineSlot, commodity: string | null): boolean {
  const { G, ctx } = useGameStore.getState();
  if (!isMoveAllowed('setCargo', ctx)) {
    console.warn('[setCargo] Move not allowed in current phase');
    return false;
  }
  const player = currentPlayerProps(G, ctx, 'setCargo');
  if (!player) return false;
  if (!isSlotWithEngine(player, slot)) {
    console.warn('[setCargo] slot must be a token with an engine');
    return false;
  }
  if (commodity !== null && !commodities.has(commodity)) {
    console.error(`[setCargo] Unknown commodity "${commodity}"`);
    return false;
  }

  useGameStore.setState({ G: withPlayer(G, ctx.currentPlayer, { ...player, cargo: withCargo(player.cargo, slot, commodity) }) });
  finishMove();
  return true;
}

/**
 * Playtest fix-up: set any player's money, engines, cargo and upgrades directly, for games
 * started before the app tracked them. Invalid values fall back to the start values.
 */
export function setPlayerBoard(
  playerID: string,
  board: Partial<Pick<PlayerProps, 'cash' | 'debt' | 'engines' | 'cargo' | 'upgrades' | 'exchangeCommodity'>>
): boolean {
  const { G, ctx } = useGameStore.getState();
  if (!isMoveAllowed('setPlayerBoard', ctx)) {
    console.warn('[setPlayerBoard] Move not allowed in current phase');
    return false;
  }
  const entry = G.players.find(([id]) => id === playerID);
  if (!entry) {
    console.error(`[setPlayerBoard] Player "${playerID}" not found`);
    return false;
  }

  useGameStore.setState({ G: withPlayer(G, playerID, normalizePlayerProps({ ...entry[1], ...board })) });
  finishMove();
  return true;
}
