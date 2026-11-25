/**
 * How the bots handle every app move and every turn action in the rules (docs/BOT_PLAN.md,
 * Rule changes). coverage.test.ts fails when a move or rules heading is added, renamed, or
 * removed without updating this map, so each change forces a decision about the bots.
 */

export type Coverage =
  /** Bots use it; `where` points at the code. */
  | { status: 'used'; where: string }
  /** Bots deliberately never use it. */
  | { status: 'ignored'; reason: string }
  /** The rules describe it but the app doesn't implement it. */
  | { status: 'notInApp'; reason: string };

/** Every move in MOVES_BY_PHASE (src/stores/moveValidation.ts). */
export const MOVE_COVERAGE: Record<string, Coverage> = {
  generateStartingContract: { status: 'used', where: 'engine/actions.ts chooseStartingCities' },
  generatePrivateContract: {
    status: 'ignored',
    reason: 'Bots pick from generatePrivateContractOffers and add the choice with addContract, as the offer dialog does.',
  },
  generateMarketContract: {
    status: 'ignored',
    reason: 'Adds one market contract; bots open the market with fillMarketTableau instead.',
  },
  fillMarketTableau: {
    status: 'ignored',
    reason: 'The +M playtest button; the buyEngine move fills the tableau when the first Mogul or better is bought.',
  },
  claimMarketContract: { status: 'used', where: 'engine/actions.ts runOne (pickup with claim)' },
  addContract: { status: 'used', where: 'engine/actions.ts choosePrivateContract' },
  toggleContractFulfilled: { status: 'used', where: 'engine/actions.ts runOne (deliver)' },
  deleteContract: { status: 'used', where: 'engine/actions.ts redrawPrivateContract' },
  replacePrivateContract: {
    status: 'ignored',
    reason: "The player app's Discard and draw; bots redraw with deleteContract then addContract in the same tick.",
  },
  acquireIndependentRailroad: { status: 'used', where: 'engine/actions.ts acquireRailroad' },
  addCityToPlayer: {
    status: 'ignored',
    reason: 'A manual playtest edit; active cities change through the moves bots use.',
  },
  claimHubCity: {
    status: 'ignored',
    reason: 'A free playtest edit; bots buy the Hub with buyUpgrade, which charges for it.',
  },
  claimRegionalOffice: {
    status: 'ignored',
    reason: 'A free playtest edit; bots buy the Regional Office with buyUpgrade, which charges for it.',
  },
  endTurn: { status: 'used', where: 'engine/actions.ts endTurn' },
  borrow: { status: 'used', where: 'engine/actions.ts borrow' },
  repay: { status: 'used', where: 'engine/actions.ts repay' },
  payForTrack: { status: 'used', where: 'engine/actions.ts buildTrack (pays the total)' },
  buyEngine: { status: 'used', where: 'engine/actions.ts buyEngine' },
  buyUpgrade: { status: 'used', where: 'engine/actions.ts buyUpgrade' },
  setCargo: { status: 'used', where: 'engine/actions.ts pickUp, runOne (final load), Roundhouse hand-over' },
  setPlayerBoard: {
    status: 'ignored',
    reason: 'A playtest fix-up for games started before the app tracked money and engines.',
  },
};

/** Every "###" heading under "## Turn actions" in docs/Game rules.md. */
export const ACTION_COVERAGE: Record<string, Coverage> = {
  'Run trains': { status: 'used', where: 'engine/movement.ts, engine/actions.ts runTrains' },
  'Build track': { status: 'used', where: 'engine/actions.ts buildTrack, engine/costs.ts trackCost' },
  'Buy an engine': { status: 'used', where: 'engine/actions.ts buyEngine, engine/costs.ts enginePurchases' },
  'Merge with an independent railroad': { status: 'used', where: 'engine/actions.ts acquireRailroad' },
  'Go first next round': {
    status: 'ignored',
    reason: 'Not in the app (play order is random), and bots never choose it (docs/BOT_PLAN.md).',
  },
  'Borrow money': { status: 'used', where: 'engine/actions.ts borrow' },
  'Repay debt': { status: 'used', where: 'engine/actions.ts repay, engine/finance.ts repayOptions' },
  'Buy an upgrade': { status: 'used', where: 'engine/actions.ts buyUpgrade, engine/costs.ts upgradePurchases' },
  'Discard and draw a new Private Contract': { status: 'used', where: 'engine/actions.ts redrawPrivateContract' },
};

/** Every "####" heading under "### Buy an upgrade". */
export const UPGRADE_COVERAGE: Record<string, Coverage> = {
  'Service Yard': { status: 'used', where: 'engine/movement.ts engineReach; available once anyone owns a Consolidation' },
  'Upgraded Stations': { status: 'used', where: 'engine/finance.ts deliveryPayment' },
  Hub: { status: 'used', where: 'engine/costs.ts trackCost discount and enginePurchases skip; claimHubCity' },
  Timetable: { status: 'used', where: 'engine/movement.ts plan, engine/actions.ts runOne' },
  Roundhouse: { status: 'used', where: 'engine/movement.ts roundhouseOptions, engine/actions.ts applyRuns' },
  'Employment Office': { status: 'used', where: 'engine/costs.ts buildLimit' },
  Railyard: { status: 'used', where: 'engine/movement.ts suppliedAt' },
  'Regional Office': {
    status: 'used',
    where: 'engine/costs.ts regionalOfficeRegions; end-of-game ties in engine/scoring.ts. Its extra contract offer is not in the app.',
  },
  'Commodities Exchange Office': { status: 'used', where: 'engine/costs.ts connectedToAllSuppliers, engine/scoring.ts monopoly' },
};
