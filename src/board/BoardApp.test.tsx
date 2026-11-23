/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../app/App';
import { useGameStore, type PlayerProps } from '../stores/gameStore';
import { setStorageAdapter } from '../utils/storage';
import { MemoryStorageAdapter } from '../utils/storage/memoryStorageAdapter.testHelper';
import { commodityIcons } from '../shared/assets/icons';
import type { SerializedState } from '../utils/stateSerialization';
import { emptyBoardState } from './boardOps';
import { setBoardStateAdapter } from './boardStateAdapter';
import { moneyValue, railroadTieValue } from '../Contract';
import { CITY_POINTS } from './geometry/cityPoints';
import { trackPathD } from './geometry/trackPaths';
import { MemoryBoardStateAdapter } from './memoryBoardStateAdapter.testHelper';
import { setBotStatesAdapter } from '../bots/state/botStatesAdapter';
import { MemoryBotStatesAdapter } from '../bots/state/memoryBotStatesAdapter.testHelper';
import { createBotRecord } from '../bots/state/botStates';
import { setBotNarrationPollMs } from './useBotNarration';

const adapter = new MemoryStorageAdapter();
let boardAdapter: MemoryBoardStateAdapter;
let botAdapter: MemoryBotStatesAdapter;

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
    botAdapter = new MemoryBotStatesAdapter();
    setBotStatesAdapter(botAdapter);
    await adapter.saveGame('BCDFG', state, { gameMode: 'byod' });
  });

  describe('bot narration (bots M6)', () => {
    /** Ben (player 1, the current player) is a bot. */
    function writeBen(lines: string[], seenAt: string | null = new Date().toISOString(), turn = 4) {
      const bot = createBotRecord({ name: 'Ben', strategy: 'builder' }, 1);
      botAdapter.write('BCDFG', { version: 1, bots: { '1': { ...bot, log: [{ round: 2, turn, lines }], runnerSeenAt: seenAt } } });
    }

    it('shows the bot’s turn in its tray, and nothing for humans', async () => {
      writeBen(['Built Boston–Syracuse for $3,000', 'Borrowed $5,000']);
      await renderAt('/board?game=BCDFG');
      const narration = await screen.findByRole('region', { name: "Ben's narration" }, { timeout: 3000 });
      expect(within(narration).queryByRole('heading')).not.toBeInTheDocument();
      expect(within(narration).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
        'Built Boston–Syracuse for $3,000',
        'Borrowed $5,000',
      ]);
      expect(screen.queryByRole('region', { name: "Ada's narration" })).not.toBeInTheDocument();
      expect(screen.queryByText("Waiting for the host's app")).not.toBeInTheDocument();
    });

    it('updates live as the bot plays', async () => {
      writeBen(['Borrowed $5,000']);
      await renderAt('/board?game=BCDFG');
      await screen.findByText('Borrowed $5,000', undefined, { timeout: 3000 });
      await act(async () => {
        writeBen(['Borrowed $5,000', 'Bought Upgraded Stations for $10,000']);
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      expect(await screen.findByText('Bought Upgraded Stations for $10,000', undefined, { timeout: 3000 })).toBeInTheDocument();
    });

    it('says when the host’s app isn’t running the bot', async () => {
      writeBen(['Repaid $5,000 debt'], new Date(Date.now() - 120_000).toISOString(), 3);
      await renderAt('/board?game=BCDFG');
      const narration = await screen.findByRole('region', { name: "Ben's narration" }, { timeout: 3000 });
      expect(within(narration).getByRole('status')).toHaveTextContent("Waiting for the host's app");
      expect(within(narration).getByText('Repaid $5,000 debt')).toBeInTheDocument();
    });

    it('picks up narration without realtime, e.g. when the board opened before the bots’ row existed', async () => {
      setBotNarrationPollMs(30);
      try {
        botAdapter.subscribe = () => () => {};
        await renderAt('/board?game=BCDFG');
        await waitFor(() => expect(screen.getByText('Live')).toBeInTheDocument());
        expect(screen.queryByRole('region', { name: "Ben's narration" })).not.toBeInTheDocument();
        await act(async () => {
          writeBen(['Borrowed $5,000']);
        });
        expect(await screen.findByText('Borrowed $5,000', undefined, { timeout: 3000 })).toBeInTheDocument();
      } finally {
        setBotNarrationPollMs(10_000);
      }
    });

    it('a missing bot_states table only means no narration', async () => {
      botAdapter.load = () => Promise.reject(new Error('The bot_states table does not exist.'));
      const { container } = await renderAt('/board?game=BCDFG');
      await waitFor(() => expect(screen.getByText('Live')).toBeInTheDocument());
      expect(container.querySelectorAll('.boardTray')).toHaveLength(2);
      expect(container.querySelector('.boardBot')).toBeNull();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('titles the page with the game code', async () => {
    await renderAt('/board?game=bcdfg');
    await waitFor(() => expect(document.title).toBe('Board BCDFG - Wood & Steel'));
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

    // Trays sit in a column beside the map, in play order; the current player is highlighted.
    expect(container.querySelector('.boardMain > .boardViewport + .boardTrays')).toBe(
      screen.getByRole('complementary', { name: 'Player trays' })
    );
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

  it("lists each player's unfulfilled private and claimed market contracts", async () => {
    const base = { creationTime: 0, turnsHeld: 0, fulfilled: false };
    const contracts = [
      { ...base, id: 'm1', type: 'market', playerID: '0', commodity: 'coal', destinationKey: 'Boston' },
      { ...base, id: 'p1', type: 'private', playerID: '0', commodity: 'cotton', destinationKey: 'Chicago' },
      { ...base, id: 'p2', type: 'private', playerID: '0', commodity: 'steel', destinationKey: 'Denver', fulfilled: true },
      { ...base, id: 'm2', type: 'market', playerID: null, commodity: 'wood', destinationKey: 'Atlanta' },
    ];
    await adapter.saveGame('BCDFG', { ...state, G: { ...state.G, contracts } } as unknown as SerializedState, {
      gameMode: 'byod',
    });
    await renderAt('/board?game=BCDFG');
    const ada = within(await screen.findByRole('region', { name: "Ada's contracts" }));
    const items = ada.getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      `Cotton to Chicago$${moneyValue(contracts[1]) / 1000}KPrivate`,
      `Coal to Boston$${moneyValue(contracts[0]) / 1000}KMarket`,
    ]);
    expect(
      items.map((li) => li.querySelector('.boardContracts__ties')?.getAttribute('alt'))
    ).toEqual([contracts[1], contracts[0]].map((c) => {
      const ties = railroadTieValue(c);
      return `${ties} railroad ${ties === 1 ? 'tie' : 'ties'}`;
    }));
    expect(within(screen.getByRole('region', { name: "Ben's contracts" })).getByText('No contracts')).toBeInTheDocument();

    // Ties earned from fulfilled contracts sit beside each player's name.
    const adaTies = railroadTieValue(contracts[2]);
    const adaTray = screen.getByRole('region', { name: "Ada's tray" });
    expect(adaTray.querySelector('.boardTray__name .boardTray__ties')).toHaveTextContent(String(adaTies));
    expect(screen.getByRole('region', { name: "Ben's tray" }).querySelector('.boardTray__ties')).toHaveTextContent('0');
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
    // jsdom has no layout or PointerEvent: lay the map out at 1/10 scale from (0, 0) and treat
    // everything below y = 500 as the tray column.
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

  describe('player board from G (read-only)', () => {
    type Board = Partial<Pick<PlayerProps, 'cash' | 'debt' | 'engines' | 'cargo' | 'upgrades'>>;

    /** Saves the game with Ada's and Ben's boards changed, then opens the board app. */
    async function openWith(boards: { ada?: Board; ben?: Board } = {}, boardState?: object) {
      const players = (state.G.players as [string, PlayerProps][]).map(([id, p]) => [
        id,
        { ...p, ...(id === '0' ? boards.ada : boards.ben) },
      ]);
      await adapter.saveGame('BCDFG', { ...state, G: { ...state.G, players } } as SerializedState, { gameMode: 'byod' });
      if (boardState) boardAdapter.write('BCDFG', { ...emptyBoardState(), seeded: true, ...boardState });
      await renderAt('/board?game=BCDFG');
      await waitFor(() => expect(screen.getByText('Board saved')).toBeInTheDocument());
    }
    const row = (name: string) => within(screen.getByRole('group', { name }));
    const upgrades = (player: string) => within(screen.getByRole('group', { name: `${player}'s upgrades` }));
    const check = (player: string, name: string) => upgrades(player).getByRole('checkbox', { name });

    it('shows a John Bull on the light token and no engine on the dark one for a game saved before money was tracked', async () => {
      await openWith();
      const light = row("Ben's Light engine");
      expect(light.getByText('2-4-0 John Bull')).toBeInTheDocument();
      expect(light.getByText('Travels 1 segment')).toBeInTheDocument();
      expect(light.getByLabelText('Cargo: No commodity')).toBeInTheDocument();
      const dark = row("Ben's Dark engine");
      expect(dark.getByText('No engine')).toBeInTheDocument();
      expect(dark.queryByText(/Travels/)).toBeNull();
      expect(dark.queryByLabelText(/Cargo:/)).toBeNull();
    });

    it("shows each player's engines and recorded cargo, with no controls to change them", async () => {
      await openWith({ ben: { engines: ['mogul', 'american'], cargo: [null, 'cotton'] } });
      expect(row("Ben's Light engine").getByText('2-6-0 Mogul')).toBeInTheDocument();
      expect(row("Ben's Light engine").getByLabelText('Cargo: No commodity')).toBeInTheDocument();
      const dark = row("Ben's Dark engine");
      expect(dark.getByText('4-4-0 American')).toBeInTheDocument();
      const cargo = dark.getByLabelText('Cargo: Cotton');
      expect(cargo.querySelector('img')).toHaveAttribute('src', (commodityIcons as Record<string, string>).cotton);
      expect(screen.getByRole('complementary', { name: 'Player trays' }).querySelectorAll('button[aria-haspopup]')).toHaveLength(0);
    });

    it("shows every player's cash, with debt in parentheses when they have some", async () => {
      await openWith({ ada: { cash: 13000, debt: 15000 }, ben: { cash: 4000 } });
      const money = (player: string) => screen.getByRole('region', { name: `${player}'s tray` }).querySelector('.boardTray__money');
      expect(money('Ada')).toHaveTextContent('$13k ($15k)');
      expect(money('Ben')).toHaveTextContent('$4k');
    });

    it('checks the upgrades the player owns; the boxes are read-only, with the price and effect on hover', async () => {
      await openWith({ ben: { upgrades: ['timetable', 'railyard'] } });
      expect(upgrades('Ben').getAllByRole('checkbox').map((box) => box.closest('label')?.textContent)).toEqual([
        'Service Yard',
        'Upgraded Stations',
        'Roundhouse',
        'Employment Office',
        'Timetable',
        'Commodities Exchange',
      ]);
      expect(check('Ben', 'Timetable')).toBeChecked();
      expect(check('Ben', 'Timetable')).toBeDisabled();
      expect(check('Ada', 'Timetable')).not.toBeChecked();
      expect(check('Ben', 'Upgraded Stations').closest('label')).toHaveAttribute(
        'title',
        '$10,000: Receive an additional $3,000 for each delivery.'
      );
    });

    it('adds the Service Yard bonus to a Consolidation or better only', async () => {
      await openWith(
        { ada: { engines: ['consolidation', null] }, ben: { engines: ['consolidation', 'mogul'], upgrades: ['service-yard'] } },
        { engines: { '1': ['Atlanta', null] } }
      );
      expect(row("Ben's Light engine").getByText('Travels 4 segments (3 +1 Service Yard) · on Atlanta')).toBeInTheDocument();
      expect(row("Ben's Dark engine").getByText('Travels 3 segments')).toBeInTheDocument();
      expect(row("Ada's Light engine").getByText('Travels 3 segments')).toBeInTheDocument();
    });

    it('keeps a placed token on its row and shows its city', async () => {
      await openWith({}, { engines: { '1': ['Atlanta', null] } });
      const light = screen.getByRole('group', { name: "Ben's Light engine" });
      expect(within(light).getByText('Travels 1 segment · on Atlanta')).toBeInTheDocument();
      expect(light.querySelector('.boardToken')).toBeInTheDocument();
      expect(document.querySelector('.boardTrays [data-token="engine-1-0"]')).toBeNull();
    });

    it('shows the city alone for a placed token with no engine type', async () => {
      await openWith({}, { engines: { '1': [null, 'Denver'] } });
      expect(row("Ben's Dark engine").getByText('on Denver')).toBeInTheDocument();
    });

    it('follows G as it changes', async () => {
      await openWith();
      act(() => {
        const G = useGameStore.getState().G;
        useGameStore.setState({
          G: { ...G, players: G.players.map(([id, p]) => [id, id === '1' ? { ...p, engines: ['american', null] } : p]) },
        });
      });
      expect(row("Ben's Light engine").getByText('4-4-0 American')).toBeInTheDocument();
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
