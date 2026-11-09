/**
 * In-memory BotStatesAdapter for tests only: the board's in-memory JSON row adapter, which
 * already mirrors conditional saves and realtime for any table.
 */
import { MemoryBoardStateAdapter } from '../../board/memoryBoardStateAdapter.testHelper';

export class MemoryBotStatesAdapter extends MemoryBoardStateAdapter {}
