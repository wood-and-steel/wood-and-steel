/**
 * A two-player game for runner tests: bot "0" (Avery) and human "1" (Hana, the host), stored in
 * in-memory adapters and loaded into the real game store, so bots play through the real moves.
 */
import type { Contract } from '../../Contract';
import { emptyBoardState, type BoardState } from '../../board/boardOps';
import { setBoardStateAdapter } from '../../board/boardStateAdapter';
import { MemoryBoardStateAdapter } from '../../board/memoryBoardStateAdapter.testHelper';
import { useGameStore, type GameContext, type GameState, type PlayerProps } from '../../stores/gameStore';
import { createNewGame, saveGameState, updateGameMetadata, type PlayerSeat } from '../../utils/gameManager';
import { setStorageAdapter } from '../../utils/storage';
import { MemoryStorageAdapter } from '../../utils/storage/memoryStorageAdapter.testHelper';
import { createHostPorts } from '../host/hostPorts';
import type { BotPorts, Clock } from '../ports';
import { setBotStatesAdapter } from '../state/botStatesAdapter';
import { ensureBotStates } from '../state/botStatesSync';
import { MemoryBotStatesAdapter } from '../state/memoryBotStatesAdapter.testHelper';

export const HOST = 'host-device';
export const BOT_SEATS: Record<string, PlayerSeat> = {
  [HOST]: { joinedAt: 'T', playerName: 'Hana', playerID: '1' },
  'bot:a': { joinedAt: 'T', playerName: 'Avery (bot)', playerID: '0', bot: { name: 'Avery', strategy: 'builder' } },
};

/** Sleeps yield to the event loop but take no real time. */
export const fastClock: Clock = {
  sleep: () => new Promise((resolve) => setTimeout(resolve, 0)),
  now: () => new Date().toISOString(),
};

export interface HostGameSpec {
  phase: 'setup' | 'play';
  currentPlayer?: string;
  players?: Record<string, Partial<PlayerProps>>;
  contracts?: Contract[];
  /** Board row to store; omitted means no row yet. */
  board?: Partial<BoardState>;
}

export interface HostGame {
  code: string;
  ports: BotPorts;
  storage: MemoryStorageAdapter;
  boardAdapter: MemoryBoardStateAdapter;
  botAdapter: MemoryBotStatesAdapter;
}

export async function setUpHostGame(spec: HostGameSpec): Promise<HostGame> {
  localStorage.clear();
  const storage = new MemoryStorageAdapter();
  setStorageAdapter(storage);
  const boardAdapter = new MemoryBoardStateAdapter();
  setBoardStateAdapter(boardAdapter);
  const botAdapter = new MemoryBotStatesAdapter();
  setBotStatesAdapter(botAdapter);

  const code = await createNewGame({ hostDeviceId: HOST, numPlayers: 2, hostPlayerName: 'Hana' });
  await updateGameMetadata(code, { playerSeats: BOT_SEATS });

  const players = spec.players ?? {
    '0': { activeCities: spec.phase === 'setup' ? [] : ['Boston', 'Portland ME'] },
    '1': { activeCities: spec.phase === 'setup' ? [] : ['Norfolk', 'Raleigh'] },
  };
  const G: GameState = {
    contracts: spec.contracts ?? [],
    players: Object.entries(players).map(([id, p]) => [
      id,
      { name: id === '0' ? 'Avery (bot)' : 'Hana', activeCities: [], hubCity: null, regionalOffice: null, ...p },
    ]),
    independentRailroads: {},
    byodGameStarted: true,
  };
  const ctx: GameContext = {
    phase: spec.phase,
    currentPlayer: spec.currentPlayer ?? '0',
    numPlayers: 2,
    playOrder: ['0', '1'],
    playOrderPos: spec.currentPlayer === '1' ? 1 : 0,
    turn: 3,
    round: 2,
  };
  useGameStore.setState({ G, ctx });
  await saveGameState(code, G, ctx);

  if (spec.board) boardAdapter.write(code, { ...emptyBoardState(), seeded: true, ...spec.board });
  await ensureBotStates(code, BOT_SEATS, { adapter: botAdapter, seed: () => 1 });

  return { code, ports: createHostPorts(code, fastClock), storage, boardAdapter, botAdapter };
}
