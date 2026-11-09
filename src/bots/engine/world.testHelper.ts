/**
 * Compact BotWorld fixtures for engine tests. Default: bot "0" (Avery) on Boston–Portland ME,
 * Boston–New York and New York–Philadelphia, a John Bull in Boston, $10,000; player "1" (Ben)
 * on Norfolk–Raleigh. It's the bot's turn in the play phase.
 */
import type { Contract } from '../../Contract';
import type { PlayerProps } from '../../stores/gameStore';
import { emptyBoardState, type BoardState } from '../../board/boardOps';
import { createBotRecord, type BotRecord } from '../state/botStates';
import { emptyTurnState, type BotWorld, type TurnState } from './world';

export interface WorldSpec {
  phase?: string;
  currentPlayer?: string;
  players?: Record<string, Partial<PlayerProps>>;
  board?: Partial<BoardState>;
  contracts?: Partial<Contract>[];
  independentRailroads?: BotWorld['independentRailroads'];
  bot?: Partial<BotRecord>;
  turnState?: Partial<TurnState>;
}

let contractCount = 0;
export function contract(fields: Partial<Contract>): Contract {
  contractCount += 1;
  return {
    id: `c${contractCount}`,
    destinationKey: 'Philadelphia',
    commodity: 'machinery',
    type: 'private',
    fulfilled: false,
    playerID: '0',
    creationTime: 0,
    turnsHeld: 0,
    ...fields,
  };
}

export function makeWorld(spec: WorldSpec = {}): BotWorld {
  const players: Record<string, Partial<PlayerProps>> = spec.players ?? {
    '0': { name: 'Avery (bot)', activeCities: ['Boston', 'Portland ME'] },
    '1': { name: 'Ben', activeCities: ['Norfolk', 'Raleigh'] },
  };
  const board: BoardState = {
    ...emptyBoardState(),
    seeded: true,
    track: {
      'Boston-Portland ME': ['0'],
      'Boston-New York': ['0'],
      'New York-Philadelphia': ['0'],
      'Norfolk-Raleigh': ['1'],
    },
    engines: { '0': ['Boston', null], '1': ['Norfolk', null] },
    ...spec.board,
  };
  return {
    playerID: '0',
    phase: spec.phase ?? 'play',
    round: 3,
    turn: 6,
    currentPlayer: spec.currentPlayer ?? '0',
    contracts: (spec.contracts ?? []).map((c) => contract(c)),
    players: Object.entries(players).map(([id, p]) => [
      id,
      { name: `Player ${id}`, activeCities: [], hubCity: null, regionalOffice: null, ...p },
    ]),
    independentRailroads: spec.independentRailroads ?? {},
    board,
    bot: { ...createBotRecord({ name: 'Avery', strategy: 'builder' }, 1), ...spec.bot },
    turnState: { ...emptyTurnState(), ...spec.turnState },
  };
}
