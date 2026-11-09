/**
 * BotWorld: one bot's view of the game, built from G/ctx, the board, and its bot_states record
 * (docs/BOT_PLAN.md, Bot engine). The engine plans against it and applyAction returns a
 * predicted next world; the runner rebuilds it from real state between actions.
 */
import type { Contract, PrivateContractSpec } from '../../Contract';
import type { GameContext, GameState, PlayerProps } from '../../stores/gameStore';
import {
  normalizeBoardState,
  playerCargo,
  playerEngineTypes,
  type BoardState,
  type CargoPair,
  type EngineSlot,
  type EngineTypePair,
} from '../../board/boardOps';
import { seedBoardState } from '../../board/boardSeed';
import { ENGINE_TYPES, type EngineTypeId, type UpgradeId } from '../../board/playerBoardData';
import type { BotRecord } from '../state/botStates';
import { ACTIONS_PER_TURN } from './rulesData';

/** Action kinds that count toward the two actions per turn. */
export type ActionKind =
  | 'runTrains'
  | 'buildTrack'
  | 'buyEngine'
  | 'acquireRailroad'
  | 'borrow'
  | 'repay'
  | 'buyUpgrade'
  | 'redrawPrivateContract';

export interface TurnState {
  /** Actions taken this turn, in order. */
  actions: ActionKind[];
  /** Engines already run this turn. */
  enginesRun: EngineSlot[];
  /** A private contract was fulfilled or discarded; the runner must fetch offers. */
  awaitingOffers: boolean;
  /** Offers fetched by the runner, to choose from. */
  offers: PrivateContractSpec[] | null;
}

export interface BotWorld {
  playerID: string;
  phase: string;
  round: number;
  turn: number;
  currentPlayer: string;
  contracts: Contract[];
  players: [string, PlayerProps][];
  independentRailroads: GameState['independentRailroads'];
  /** Whole board (every player), so costs and competition can be judged. */
  board: BoardState;
  bot: BotRecord;
  turnState: TurnState;
}

export function emptyTurnState(): TurnState {
  return { actions: [], enginesRun: [], awaitingOffers: false, offers: null };
}

export interface BuildWorldInput {
  G: GameState;
  ctx: GameContext;
  /** Board state, or null if no board row exists yet (seeded from G here, as the board would). */
  board: unknown;
  bot: BotRecord;
  playerID: string;
  turnState?: TurnState;
}

export function buildWorld({ G, ctx, board, bot, playerID, turnState }: BuildWorldInput): BotWorld {
  const boardState = board == null ? seedBoardState(G, { ...ctx, phase: 'play' }) : normalizeBoardState(board);
  return {
    playerID,
    phase: ctx.phase,
    round: ctx.round ?? 0,
    turn: ctx.turn ?? 0,
    currentPlayer: ctx.currentPlayer,
    contracts: structuredClone(G.contracts ?? []),
    players: structuredClone(G.players ?? []),
    independentRailroads: structuredClone(G.independentRailroads ?? {}),
    board: structuredClone(boardState),
    bot: structuredClone(bot),
    turnState: turnState ? structuredClone(turnState) : emptyTurnState(),
  };
}

// --- Small accessors -----------------------------------------------------------

export function playerProps(world: BotWorld, playerID: string = world.playerID): PlayerProps | undefined {
  return world.players.find(([id]) => id === playerID)?.[1];
}

export function engineTypes(world: BotWorld, playerID: string = world.playerID): EngineTypePair {
  return playerEngineTypes(world.board, playerID);
}

export function cargo(world: BotWorld, playerID: string = world.playerID): CargoPair {
  return playerCargo(world.board, playerID);
}

export function engineCities(world: BotWorld, playerID: string = world.playerID): [string | null, string | null] {
  return world.board.engines[playerID] ?? [null, null];
}

export function upgrades(world: BotWorld, playerID: string = world.playerID): UpgradeId[] {
  return world.board.upgrades[playerID] ?? [];
}

export function hasUpgrade(world: BotWorld, upgrade: UpgradeId, playerID: string = world.playerID): boolean {
  return upgrades(world, playerID).includes(upgrade);
}

export function engineLevel(engine: EngineTypeId): number {
  return ENGINE_TYPES.findIndex((e) => e.id === engine);
}

/** The player's best engine level, or -1 with no engines. */
export function bestEngineLevel(world: BotWorld, playerID: string = world.playerID): number {
  return Math.max(-1, ...engineTypes(world, playerID).map((t) => (t ? engineLevel(t) : -1)));
}

export function otherPlayerIDs(world: BotWorld): string[] {
  return world.players.map(([id]) => id).filter((id) => id !== world.playerID);
}

/** The bot's unfulfilled private contract(s). */
export function openPrivateContracts(world: BotWorld): Contract[] {
  return world.contracts.filter((c) => c.type === 'private' && c.playerID === world.playerID && !c.fulfilled);
}

/** Market contracts the bot has claimed but not fulfilled. */
export function claimedMarketContracts(world: BotWorld): Contract[] {
  return world.contracts.filter((c) => c.type === 'market' && c.playerID === world.playerID && !c.fulfilled);
}

/** Unclaimed market contracts. */
export function openMarketContracts(world: BotWorld): Contract[] {
  return world.contracts.filter((c) => c.type === 'market' && c.playerID === null && !c.fulfilled);
}

/** Contracts the bot can deliver to right now: its private ones and the market ones it claimed. */
export function deliverableContracts(world: BotWorld): Contract[] {
  return [...openPrivateContracts(world), ...claimedMarketContracts(world)];
}

export function fulfilledContracts(world: BotWorld, playerID: string = world.playerID): Contract[] {
  return world.contracts.filter((c) => c.playerID === playerID && c.fulfilled);
}

export function actionsLeft(world: BotWorld): number {
  return ACTIONS_PER_TURN - world.turnState.actions.length;
}
