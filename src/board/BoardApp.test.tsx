/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../app/App';
import { setStorageAdapter } from '../utils/storage';
import { MemoryStorageAdapter } from '../utils/storage/memoryStorageAdapter.testHelper';
import type { SerializedState } from '../utils/stateSerialization';
import { setBoardStateAdapter } from './boardStateAdapter';
import { MemoryBoardStateAdapter } from './memoryBoardStateAdapter.testHelper';

const adapter = new MemoryStorageAdapter();
let boardAdapter: MemoryBoardStateAdapter;

const state = {
  G: {
    contracts: [],
    players: [
      ['0', { name: 'Ada', activeCities: ['Atlanta', 'Charleston', 'Savannah'], hubCity: 'Atlanta', regionalOffice: 'SE', avatarColor: '#f83765' }],
      ['1', { name: 'Ben', activeCities: ['Boston', 'Portland ME'], hubCity: null, regionalOffice: null, avatarColor: '#0e86f4' }],
    ],
    independentRailroads: {
      Erie: {
        name: 'Erie',
        routes: [
          { key: 'Chicago-Cleveland', addedInRound: 0 },
          { key: 'Chicago-Detroit', addedInRound: 1 },
        ],
      },
    },
  },
  ctx: {
    phase: 'play',
    currentPlayer: '1',
    numPlayers: 2,
    playOrder: ['1', '0'],
    playOrderPos: 0,
    turn: 4,
    round: 2,
  },
} as unknown as SerializedState;

async function renderAt(path: string) {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    );
  });
  return result;
}

describe('BoardApp (/board)', () => {
  beforeEach(async () => {
    adapter.clear();
    setStorageAdapter(adapter);
    boardAdapter = new MemoryBoardStateAdapter();
    setBoardStateAdapter(boardAdapter);
    await adapter.saveGame('BCDFG', state, { gameMode: 'byod' });
  });

  it('lists games when no code is given', async () => {
    await renderAt('/board');
    expect(await screen.findByRole('link', { name: /BCDFG/ })).toHaveAttribute('href', '/board?game=BCDFG');
  });

  it('shows read-only game state: top bar, indie routes, hub, regional office, trays', async () => {
    const { container } = await renderAt('/board?game=bcdfg');
    await waitFor(() => expect(screen.getByText('Live')).toBeInTheDocument());

    expect(screen.getByRole('link', { name: 'BCDFG' })).toBeInTheDocument();
    expect(screen.getByText('Play')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    expect(container.querySelectorAll('.boardMap__indieRoute')).toHaveLength(2);
    expect(container.querySelectorAll('.boardMap__hub')).toHaveLength(1);
    expect(container.querySelector('.boardMap__hub title')).toHaveTextContent("Ada's Hub: Atlanta");
    expect(container.querySelector('.boardMap__regionalOffice title')).toHaveTextContent("Ada's Regional Office: SE");
    expect(container.querySelector('[data-route="Chicago-Detroit"] title')).toHaveTextContent(
      'Chicago-Detroit · length 2 · Erie'
    );

    // Trays follow play order; the current player is highlighted.
    const trays = container.querySelectorAll('.boardTray');
    expect([...trays].map((t) => t.getAttribute('aria-label'))).toEqual(["Ben's tray", "Ada's tray"]);
    expect(trays[0]).toHaveClass('boardTray--current');
    expect(trays[0].querySelectorAll('.boardToken')).toHaveLength(3);

    // First open seeds board state from G.
    await waitFor(() => expect(screen.getByText('Board saved')).toBeInTheDocument());
    expect(boardAdapter.rows.get('BCDFG')?.state).toMatchObject({
      seeded: true,
      track: { 'Charleston-Savannah': ['0'], 'Boston-Portland ME': ['1'] },
      seenIndependentRailroads: { Erie: ['Chicago-Cleveland', 'Chicago-Detroit'] },
    });
  });

  it('shows a board error without hiding the game when board state fails to load', async () => {
    boardAdapter.load = () => Promise.reject(new Error('The board_states table does not exist.'));
    const { container } = await renderAt('/board?game=BCDFG');
    expect(await screen.findByRole('alert')).toHaveTextContent('The board_states table does not exist.');
    expect(container.querySelectorAll('.boardMap__indieRoute')).toHaveLength(2);
  });

  it('reports a missing game', async () => {
    await renderAt('/board?game=ZZZZZ');
    expect(await screen.findByText('Game "ZZZZZ" was not found.')).toBeInTheDocument();
  });
});
