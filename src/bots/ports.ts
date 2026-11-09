/**
 * What the bot runner needs from the outside world (docs/BOT_PLAN.md, Ports). The host's browser
 * implements these today (src/bots/host/hostPorts.ts); a server runner can implement them later
 * without changing the runner, engine, or heuristic.
 */
import type { PrivateContractSpec } from '../Contract';
import type { BoardOp } from '../board/boardOps';
import type { GameContext, GameState } from '../stores/gameStore';
import type { GameMove } from './engine/actions';
import type { BotStates } from './state/botStates';

export interface GamePort {
  /** Current G and ctx. */
  getState(): { G: GameState; ctx: GameContext };
  /** Make an app move as the current player; resolves once it is saved. */
  applyMove(move: GameMove): Promise<void>;
  /** Private contract offers for the current player, as the offer dialog generates them. */
  privateContractOffers(): PrivateContractSpec[];
}

export interface BoardPort {
  /** The stored board state (raw; normalized by buildWorld), or null if there is no row yet. */
  load(): Promise<unknown | null>;
  /** Save one op to the board, seeding the row from G if needed. */
  apply(op: BoardOp): Promise<void>;
}

export interface BotStatePort {
  load(): Promise<BotStates | null>;
  /** Read-modify-write; `change` must be re-appliable (it may run again after a conflict). */
  update(change: (states: BotStates) => BotStates): Promise<BotStates>;
}

export interface Clock {
  sleep(ms: number): Promise<void>;
  /** ISO timestamp. */
  now(): string;
}

export interface BotPorts {
  game: GamePort;
  board: BoardPort;
  bots: BotStatePort;
  clock: Clock;
}
