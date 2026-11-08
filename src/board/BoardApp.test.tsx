/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../app/App';
import { useGameStore } from '../stores/gameStore';
import { setStorageAdapter } from '../utils/storage';
import { MemoryStorageAdapter } from '../utils/storage/memoryStorageAdapter.testHelper';
import type { SerializedState } from '../utils/stateSerialization';
import { setBoardStateAdapter } from './boardStateAdapter';
import { CITY_POINTS } from './geometry/cityPoints';
import { trackPathD } from './geometry/trackPaths';
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

  it('zooms in steps up to 400% and back to fit width', async () => {
    await renderAt('/board?game=BCDFG');
    await waitFor(() => expect(screen.getByText('Live')).toBeInTheDocument());
    const zoomIn = screen.getByRole('button', { name: 'Zoom in' });
    fireEvent.click(zoomIn);
    expect(screen.getByText('125%')).toBeInTheDocument();
    for (let i = 0; i < 10; i++) fireEvent.click(zoomIn);
    expect(screen.getByText('400%')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fit width' }));
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('reports a missing game', async () => {
    await renderAt('/board?game=ZZZZZ');
    expect(await screen.findByText('Game "ZZZZZ" was not found.')).toBeInTheDocument();
  });

  describe('track (M3)', () => {
    async function openReadyBoard() {
      const view = await renderAt('/board?game=BCDFG');
      await waitFor(() => expect(screen.getByText('Board saved')).toBeInTheDocument());
      const hit = (key: string) => view.container.querySelector(`[data-route="${key}"]`)!;
      const strokes = (key: string) =>
        [...view.container.querySelectorAll(`[data-track="${key}"] .boardMap__trackStroke`)].map((el) =>
          el.getAttribute('data-owner')
        );
      return { ...view, hit, strokes };
    }

    it('draws seeded starting routes in player colors', async () => {
      const { container, strokes } = await openReadyBoard();
      expect(strokes('Charleston-Savannah')).toEqual(['0']);
      expect(container.querySelector('[data-owner="0"]')).toHaveAttribute('stroke', '#f83765');
    });

    it('claims an unclaimed route for the current player with one click', async () => {
      const { hit, strokes } = await openReadyBoard();
      fireEvent.click(hit('Atlanta-Birmingham'));
      expect(strokes('Atlanta-Birmingham')).toEqual(['1']);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await waitFor(() => expect(boardAdapter.rows.get('BCDFG')?.state).toMatchObject({ track: { 'Atlanta-Birmingham': ['1'] } }));
    });

    it('opens the popover on a claimed route to add a parallel owner, change the owner, and unclaim', async () => {
      const { hit, strokes } = await openReadyBoard();
      fireEvent.click(hit('Charleston-Savannah'));
      const dialog = screen.getByRole('dialog', { name: 'Route Charleston-Savannah' });

      // The current player (Ben) is suggested and focused as a parallel owner.
      const parallel = within(dialog).getByRole('group', { name: 'Parallel' });
      const ben = within(parallel).getByRole('button', { name: 'Ben' });
      expect(ben).toHaveFocus();
      fireEvent.click(ben);
      expect(strokes('Charleston-Savannah')).toEqual(['0', '1']);

      fireEvent.click(within(within(dialog).getByRole('group', { name: 'Owner' })).getByRole('button', { name: 'Ben' }));
      expect(strokes('Charleston-Savannah')).toEqual(['1']);

      fireEvent.click(within(dialog).getByRole('button', { name: 'Unclaim' }));
      expect(strokes('Charleston-Savannah')).toEqual([]);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('shift-click opens the popover on an unclaimed route; Escape closes it', async () => {
      const { hit, strokes } = await openReadyBoard();
      fireEvent.click(hit('Atlanta-Birmingham'), { shiftKey: true });
      expect(strokes('Atlanta-Birmingham')).toEqual([]);
      const dialog = screen.getByRole('dialog');
      expect(within(within(dialog).getByRole('group', { name: 'Parallel' })).getByRole('button', { name: 'Ada' })).toBeDisabled();
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('keeps the center of an indie route clear for the indie', async () => {
      const { container, hit } = await openReadyBoard();
      fireEvent.click(hit('Chicago-Detroit'));
      const stroke = container.querySelector('[data-track="Chicago-Detroit"] .boardMap__trackStroke')!;
      expect(stroke.getAttribute('d')).toBe(trackPathD('Chicago-Detroit', 1));
    });
  });

  describe('tokens (M4)', () => {
    // jsdom has no layout or PointerEvent: lay the map out at 1/10 scale from (0, 0) and put the
    // tray strip below y = 500.
    const SCALE = 10;
    const MAP_RECT = { left: 0, top: 0, right: 666, bottom: 417.3, width: 666, height: 417.3, x: 0, y: 0 } as DOMRect;
    const toClient = (city: string) => ({ clientX: CITY_POINTS[city].x / SCALE, clientY: CITY_POINTS[city].y / SCALE });
    const TRAY_POINT = { clientX: 50, clientY: 600 };

    beforeAll(() => {
      if (!window.PointerEvent) {
        (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = class extends MouseEvent {} as typeof MouseEvent;
      }
    });

    beforeEach(() => {
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(MAP_RECT);
      document.elementFromPoint = (_x: number, y: number) =>
        y > 500 ? document.querySelector('[data-token-drop="tray"]') : null;
    });

    afterEach(() => {
      vi.restoreAllMocks();
      delete (document as { elementFromPoint?: unknown }).elementFromPoint;
    });

    async function openReadyBoard() {
      const view = await renderAt('/board?game=BCDFG');
      await waitFor(() => expect(screen.getByText('Board saved')).toBeInTheDocument());
      return view;
    }

    function drag(from: Element, to: { clientX: number; clientY: number }) {
      fireEvent.pointerDown(from, { button: 0, clientX: 1, clientY: 1 });
      fireEvent.pointerMove(window, to);
      fireEvent.pointerUp(window, to);
    }

    it('drags an engine from the tray onto a city, then back to the tray', async () => {
      const { container } = await openReadyBoard();
      const trayToken = () => container.querySelector('.boardTrays [data-token="engine-1-0"]');
      const mapToken = () => container.querySelector('.boardMap [data-token="engine-1-0"]');

      fireEvent.pointerDown(trayToken()!, { button: 0, ...TRAY_POINT });
      fireEvent.pointerMove(window, toClient('Atlanta'));
      expect(container.querySelector('.boardMap__snapTarget')).toBeInTheDocument();
      expect(container.querySelector('.tokenGhost')).toBeInTheDocument();
      fireEvent.pointerUp(window, toClient('Atlanta'));

      expect(mapToken()).toHaveAttribute('data-city', 'Atlanta');
      expect(trayToken()).toBeNull();
      expect(container.querySelector('.tokenGhost')).toBeNull();
      await waitFor(() =>
        expect(boardAdapter.rows.get('BCDFG')?.state).toMatchObject({ engines: { '1': ['Atlanta', null] } })
      );

      drag(mapToken()!, TRAY_POINT);
      expect(mapToken()).toBeNull();
      expect(trayToken()).toBeInTheDocument();
    });

    it('moves a Railyard between cities and cancels a drop away from every city', async () => {
      const { container } = await openReadyBoard();
      const yard = () => container.querySelector('[data-token="railyard-0"]')!;
      drag(yard(), toClient('Denver'));
      expect(yard()).toHaveAttribute('data-city', 'Denver');
      drag(yard(), toClient('Omaha'));
      expect(yard()).toHaveAttribute('data-city', 'Omaha');
      // Pacific Ocean, far from any city: the token stays put.
      drag(yard(), { clientX: 2, clientY: 400 });
      expect(yard()).toHaveAttribute('data-city', 'Omaha');
    });

    it('Escape cancels a drag', async () => {
      const { container } = await openReadyBoard();
      fireEvent.pointerDown(container.querySelector('[data-token="engine-0-1"]')!, { button: 0, ...TRAY_POINT });
      fireEvent.pointerMove(window, toClient('Denver'));
      fireEvent.keyDown(window, { key: 'Escape' });
      fireEvent.pointerUp(window, toClient('Denver'));
      expect(container.querySelector('.boardMap [data-token="engine-0-1"]')).toBeNull();
    });
  });

  describe('acquisitions (M5)', () => {
    it("converts an acquired railroad's routes to the acquirer's track", async () => {
      const { container } = await renderAt('/board?game=BCDFG');
      await waitFor(() => expect(screen.getByText('Board saved')).toBeInTheDocument());

      // The app's acquire move removes the railroad and adds its cities to the acquirer.
      const { G } = useGameStore.getState();
      act(() => {
        useGameStore.setState({
          G: {
            ...G,
            players: G.players.map(([id, props]) =>
              id === '1' ? [id, { ...props, activeCities: [...props.activeCities, 'Chicago', 'Cleveland', 'Detroit'] }] : [id, props]
            ),
            independentRailroads: {},
          },
        });
      });

      expect(container.querySelectorAll('.boardMap__indieRoute')).toHaveLength(0);
      expect(container.querySelector('[data-track="Chicago-Cleveland"] [data-owner="1"]')).toBeInTheDocument();
      expect(container.querySelector('[data-track="Chicago-Detroit"] [data-owner="1"]')).toBeInTheDocument();
      await waitFor(() =>
        expect(boardAdapter.rows.get('BCDFG')?.state).toMatchObject({
          track: { 'Chicago-Cleveland': ['1'], 'Chicago-Detroit': ['1'] },
          seenIndependentRailroads: {},
        })
      );
    });
  });
});
