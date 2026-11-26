/**
 * Market contract helpers shared by the moves and the end-of-round hook: drawing replacement
 * market contracts, and expiring open market contracts so the tableau stays fresh.
 *
 * Expiration rules (see docs/Game rules.md, Market contracts):
 * - The market clock starts at the first round-end with any open market contract.
 * - At each market round-end: every countdown ticks down by 1; contracts that reach 0 leave the
 *   tableau and are replaced one-for-one; then maybe one open contract with no countdown starts
 *   one at MARKET_EXPIRATION_ROUNDS. A start is guaranteed after MARKET_EXPIRATION_GUARANTEE_ROUNDS
 *   market round-ends in a row with none, otherwise it happens with MARKET_EXPIRATION_START_CHANCE.
 */
import {
  generateMarketContract,
  leastServedPlayer,
  MARKET_EXPIRATION_GUARANTEE_ROUNDS,
  MARKET_EXPIRATION_ROUNDS,
  MARKET_EXPIRATION_START_CHANCE,
} from '../Contract';
import type { Contract } from '../Contract';
import type { GameState } from './gameStore';

/** Open market contracts: unclaimed and unfulfilled (the tableau). */
export function openMarketContracts(contracts: Contract[]): Contract[] {
  return contracts.filter(isOpenMarketContract);
}

export function isOpenMarketContract(c: Contract): boolean {
  return c.type === 'market' && c.playerID === null && !c.fulfilled;
}

/**
 * Draw a market contract that doesn't duplicate an active contract in `contracts`, or undefined after 50 tries.
 * It is anchored on the player the open market in `contracts` serves worst (leastServedPlayer), not counting
 * `leavingIds`: open contracts about to leave the tableau, which still count for the duplicate check.
 */
export function drawMarketContract(G: GameState, contracts: Contract[], leavingIds: string[] = []): Contract | undefined {
  const staying = openMarketContracts(contracts).filter((c) => !leavingIds.includes(c.id));
  const anchor = leastServedPlayer(G, staying);
  const activeContractKeys = new Set(
    contracts.filter((c) => !c.fulfilled).map((c) => `${c.commodity}|${c.destinationKey}`)
  );

  for (let attempts = 0; attempts < 50; attempts++) {
    const candidate = generateMarketContract(G, anchor);
    if (!candidate) return undefined;
    if (!activeContractKeys.has(`${candidate.commodity}|${candidate.destinationKey}`)) {
      return candidate;
    }
  }
  return undefined;
}

/**
 * A market contract just left (or is about to leave) the open tableau:
 * add one replacement to the front of `contracts`, avoiding duplicates of active contracts.
 * `leavingIds` names open contracts still in `contracts` that are about to leave (see drawMarketContract).
 * One-for-one: does not change the number of contracts in the tableau; it only replaces the one that left.
 */
export function withReplacementMarketContract(
  G: GameState,
  contracts: Contract[],
  leavingIds: string[] = []
): Contract[] {
  const replacement = drawMarketContract(G, contracts, leavingIds);
  if (!replacement) {
    console.error('[withReplacementMarketContract] Failed to generate a replacement market contract');
    return contracts;
  }
  return [replacement, ...contracts];
}

/**
 * End-of-round market expiration. Mutates `G` in place (like growIndependentRailroads),
 * replacing `G.contracts` with a new array when anything changes.
 *
 * @param random - Source of randomness in [0, 1); injectable for tests.
 */
export function advanceMarketExpirations(G: GameState, random: () => number = Math.random): void {
  // Market opening: nothing happens (and nothing counts) until the tableau has contracts.
  if (G.marketRoundsWithoutExpirationStart === undefined) {
    if (openMarketContracts(G.contracts).length === 0) return;
    G.marketRoundsWithoutExpirationStart = 0;
  }

  // Tick every countdown in progress.
  let contracts = G.contracts.map((c) =>
    isOpenMarketContract(c) && c.roundsLeft !== undefined ? { ...c, roundsLeft: c.roundsLeft - 1 } : c
  );

  // Expire contracts that reached 0. Draw each replacement before removing the expired one
  // so the duplicate check keeps the replacement from matching it.
  const expired = contracts.filter((c) => isOpenMarketContract(c) && c.roundsLeft !== undefined && c.roundsLeft <= 0);
  const expiredIds = expired.map((c) => c.id);
  for (const old of expired) {
    contracts = withReplacementMarketContract(G, contracts, expiredIds).filter((c) => c.id !== old.id);
  }

  // Maybe start one countdown.
  const candidates = contracts.filter((c) => isOpenMarketContract(c) && c.roundsLeft === undefined);
  const guaranteed = G.marketRoundsWithoutExpirationStart >= MARKET_EXPIRATION_GUARANTEE_ROUNDS;
  if (candidates.length > 0 && (guaranteed || random() < MARKET_EXPIRATION_START_CHANCE)) {
    const pick = candidates[Math.min(Math.floor(random() * candidates.length), candidates.length - 1)];
    contracts = contracts.map((c) => (c.id === pick.id ? { ...c, roundsLeft: MARKET_EXPIRATION_ROUNDS } : c));
    G.marketRoundsWithoutExpirationStart = 0;
  } else {
    G.marketRoundsWithoutExpirationStart += 1;
  }

  G.contracts = contracts;
}
