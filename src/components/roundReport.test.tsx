/// <reference types="@testing-library/jest-dom" />
/**
 * Stage 4 round report (docs/PLAYER_APP_REDESIGN_PLAN.md): the sheet, and when it opens by
 * itself on this device.
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import type { Contract } from '../Contract';
import { newPlayerProps } from '../stores/playerDefaults';
import type { GameContext, GameState, RoundReport } from '../stores/gameStore';
import { useRoundReport } from '../hooks/useRoundReport';
import { NavBar } from './NavBar';
import { PlayerToolbar } from './PlayerToolbar';
import { RoundReportSheet } from './RoundReportSheet';

const report = (overrides: Partial<RoundReport> = {}): RoundReport => ({
  round: 2,
  routesAdded: { 'Erie Railroad': ['Cleveland-Detroit'] },
  marketExpired: [{ id: 'x', commodity: 'cattle', destinationKey: 'Boston' }],
  marketAdded: [{ id: 'n', commodity: 'wine', destinationKey: 'Denver' }],
  marketLastRound: [],
  ...overrides,
});

const lastRound: Contract = {
  id: 'l',
  commodity: 'coal',
  destinationKey: 'Atlanta',
  type: 'market',
  fulfilled: false,
  playerID: null,
  creationTime: 0,
  turnsHeld: null,
  roundsLeft: 1,
};

const G = {
  contracts: [lastRound],
  players: [
    ['0', newPlayerProps('Ada')],
    ['1', newPlayerProps('Bo')],
  ],
  independentRailroads: {
    'Erie Railroad': {
      name: 'Erie Railroad',
      routes: [
        { key: 'Cleveland-Pittsburgh', addedInRound: 1 },
        { key: 'Cleveland-Detroit', addedInRound: 2 },
      ],
    },
  },
} as GameState;

const ctx: GameContext = {
  phase: 'play',
  currentPlayer: '0',
  numPlayers: 2,
  playOrder: ['0', '1'],
  playOrderPos: 0,
  turn: 6,
  round: 3,
};

describe('RoundReportSheet', () => {
  test('shows each railroad that grew on its own map, the market changes, and who starts next', () => {
    render(
      <RoundReportSheet report={report()} G={G} ctx={ctx} autoOpen onAutoOpenChange={() => {}} onClose={() => {}} />
    );
    expect(screen.getByRole('heading', { name: 'End of round 2' })).toBeInTheDocument();
    expect(screen.getByText('Erie Railroad')).toBeInTheDocument();
    expect(screen.getByText(/2 routes · \$/)).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: 'Erie Railroad: existing routes Cleveland – Pittsburgh; new route Cleveland – Detroit',
      })
    ).toBeInTheDocument();
    expect(screen.getByText('New: Cleveland – Detroit')).toBeInTheDocument();
    expect(within(screen.getByText('Cattle to Boston').parentElement!).getByText('Expired')).toBeInTheDocument();
    expect(screen.getByText('New: Wine to Denver')).toBeInTheDocument();
    expect(within(screen.getByText('Coal to Atlanta').parentElement!).getByText('Last round')).toBeInTheDocument();
    expect(screen.getByText('Round 3 starts with')).toBeInTheDocument();
    expect(screen.getByText('Ada')).toBeInTheDocument();
  });

  test('says when no railroad grew, and leaves out an empty market section', () => {
    render(
      <RoundReportSheet
        report={report({ routesAdded: {}, marketExpired: [], marketAdded: [] })}
        G={{ ...G, contracts: [] }}
        ctx={ctx}
        autoOpen
        onAutoOpenChange={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText('No independent railroads grew.')).toBeInTheDocument();
    expect(screen.queryByText('Market')).not.toBeInTheDocument();
  });

  test('its switch turns opening after every round off and on', () => {
    const onAutoOpenChange = vi.fn();
    render(
      <RoundReportSheet report={report()} G={G} ctx={ctx} autoOpen onAutoOpenChange={onAutoOpenChange} onClose={() => {}} />
    );
    const toggle = screen.getByRole('switch', { name: 'Open this after every round' });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(onAutoOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('useRoundReport', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  test('opens a new report with news by itself, once', () => {
    const { result, rerender } = renderHook(({ r }) => useRoundReport(r, 'ABCDE'), {
      initialProps: { r: undefined as RoundReport | undefined },
    });
    expect(result.current.isOpen).toBe(false);
    rerender({ r: report() });
    expect(result.current.isOpen).toBe(true);
    expect(result.current.unseen).toBe(false);
    act(() => result.current.close());
    rerender({ r: report() });
    expect(result.current.isOpen).toBe(false);
  });

  test('with the switch off, leaves a new report unseen until it is opened', () => {
    const { result, rerender } = renderHook(({ r }) => useRoundReport(r, 'ABCDE'), {
      initialProps: { r: undefined as RoundReport | undefined },
    });
    act(() => result.current.setAutoOpen(false));
    rerender({ r: report() });
    expect(result.current.isOpen).toBe(false);
    expect(result.current.unseen).toBe(true);
    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);
    expect(result.current.unseen).toBe(false);
    expect(window.localStorage.getItem('woodAndSteel.roundReport.autoOpen')).toBe('false');
  });

  test('opens a report whose only news is a market contract entering its last round', () => {
    const { result } = renderHook(() =>
      useRoundReport(
        report({
          routesAdded: {},
          marketExpired: [],
          marketAdded: [],
          marketLastRound: [{ id: 'l', commodity: 'coal', destinationKey: 'Atlanta' }],
        }),
        'ABCDE'
      )
    );
    expect(result.current.isOpen).toBe(true);
  });

  test("doesn't open a report with no news, and doesn't flag it", () => {
    const { result } = renderHook(() =>
      useRoundReport(report({ routesAdded: {}, marketExpired: [], marketAdded: [] }), 'ABCDE')
    );
    expect(result.current.isOpen).toBe(false);
    expect(result.current.unseen).toBe(false);
  });

  test('remembers per game which report this device has seen', () => {
    window.localStorage.setItem('woodAndSteel.roundReport.seen.ABCDE', '2');
    const { result } = renderHook(() => useRoundReport(report(), 'ABCDE'));
    expect(result.current.isOpen).toBe(false);
    const other = renderHook(() => useRoundReport(report(), 'FGHJK'));
    expect(other.result.current.isOpen).toBe(true);
  });
});

describe('round label', () => {
  test('shows the round, opens the report, and has a dot while one is unseen', () => {
    const onOpen = vi.fn();
    const { container } = render(
      <PlayerToolbar
        G={G}
        ctx={{ ...ctx, currentPlayer: '1' }}
        playerID="0"
        startingContractExists
        currentPhase="play"
        onOpenRoundReport={onOpen}
        roundReportUnseen
      />
    );
    const label = screen.getByRole('button', { name: 'Round 3, new round report' });
    expect(container.querySelector('.playerToolbar__roundDot')).not.toBeNull();
    fireEvent.click(label);
    expect(onOpen).toHaveBeenCalled();
  });

  test('is disabled before the first report', () => {
    render(<PlayerToolbar G={G} ctx={ctx} playerID="0" startingContractExists currentPhase="play" />);
    expect(screen.getByRole('button', { name: 'Round 3' })).toBeDisabled();
  });
});

describe('Show Round Report in the menu', () => {
  const openMenu = (props: Partial<React.ComponentProps<typeof NavBar>>) => {
    render(<NavBar gameManager={{}} onNavigateToLobby={() => {}} onOpenEditPlaytest={() => {}} {...props} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Menu' })[0]);
    return screen.getAllByRole('menuitem', { hidden: true });
  };

  test('comes last and opens the latest report', () => {
    const onShowRoundReport = vi.fn();
    const items = openMenu({ onShowRoundReport, hasRoundReport: true });
    const show = items[items.length - 1];
    expect(show).toHaveTextContent('Show Round Report');
    fireEvent.click(show);
    expect(onShowRoundReport).toHaveBeenCalled();
  });

  test('is disabled before the first round has ended', () => {
    const onShowRoundReport = vi.fn();
    const items = openMenu({ onShowRoundReport, hasRoundReport: false });
    const show = items.find((i) => i.textContent === 'Show Round Report')!;
    expect(show).toBeDisabled();
    fireEvent.click(show);
    expect(onShowRoundReport).not.toHaveBeenCalled();
  });

  test('is not in the menu outside play', () => {
    const items = openMenu({});
    expect(items.map((i) => i.textContent)).not.toContain('Show Round Report');
  });
});
