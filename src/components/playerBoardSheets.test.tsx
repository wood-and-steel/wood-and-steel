/// <reference types="@testing-library/jest-dom" />
/**
 * The Stage 2 sheets (docs/PLAYER_APP_REDESIGN_PLAN.md): the delivery receipt shows only the
 * lines that apply and blocks a delivery that would bankrupt the player; Loans shows what a
 * loan costs and only the repayments the rules allow; Pay for track refuses more than the cash.
 */
import React from 'react';
import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { moneyValue, type Contract } from '../Contract';
import { newPlayerProps } from '../stores/playerDefaults';
import type { PlayerProps } from '../stores/gameStore';
import type { Moves } from '../stores/moves';
import { DeliveryReceipt } from './DeliveryReceipt';
import { LoansSheet } from './LoansSheet';
import { ActionsSheet } from './ActionsSheet';
import { EnginesPanel } from './EnginesPanel';
import { formatMoney } from '../utils/money';
import { RadioOption, Sheet } from './Sheet';
import { EditPlaytestDialog } from './EditPlaytestDialog';
import { ENGINE_TYPES } from '../rules/playerBoard';
import { UPGRADE_KEYS, UPGRADE_NAMES, UPGRADE_PRICES } from '../rules/rulesData';

const player = (props: Partial<PlayerProps> = {}): PlayerProps => ({ ...newPlayerProps('Ada'), ...props });

const contract = (props: Partial<Contract> = {}): Contract => ({
  id: 'k1',
  commodity: 'coal',
  destinationKey: 'Boston',
  type: 'private',
  fulfilled: false,
  playerID: '0',
  creationTime: 0,
  turnsHeld: 0,
  ...props,
});

describe('DeliveryReceipt', () => {
  test('with no bonuses or debt service, shows the value and the total only', () => {
    const c = contract();
    render(<DeliveryReceipt playerID="0" contract={c} player={player()} ties={3} onDeliver={() => true} onClose={() => {}} />);
    expect(screen.getByText('Contract value')).toBeInTheDocument();
    expect(screen.queryByText('Debt service')).toBeNull();
    expect(screen.queryByText('Upgraded Stations')).toBeNull();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.getByText('To your cash').nextSibling).toHaveTextContent(`+${formatMoney(moneyValue(c))}`);
    expect(screen.getByRole('button', { name: 'Deliver and choose a new contract' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Coal is available in:' })).toHaveTextContent('Atlanta, Butte, Calgary');
  });

  test('asks which engine delivered only when they pay differently, and shows the bonus lines', () => {
    const onDeliver = vi.fn(() => true);
    const c = contract({ type: 'market' });
    render(
      <DeliveryReceipt playerID="0"
        contract={c}
        player={player({ engines: ['prairie', 'mountain'], upgrades: ['upgraded-stations'] })}
        ties={0}
        onDeliver={onDeliver}
        onClose={() => {}}
      />
    );
    const engines = screen.getByRole('radiogroup', { name: 'Delivering engine' });
    expect(screen.queryByText(/×1⅓/)).toBeNull();
    fireEvent.click(within(engines).getByRole('radio', { name: /Mountain/ }));
    expect(screen.getByText('4-8-2 Mountain ×1⅓')).toBeInTheDocument();
    expect(screen.getByText('Upgraded Stations')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Deliver' }));
    expect(onDeliver).toHaveBeenCalledWith(1);
  });

  test('shows first-Central debt service, and blocks a delivery that would bankrupt the player', () => {
    const { unmount } = render(
      <DeliveryReceipt playerID="0"
        contract={contract({ destinationKey: 'Chicago', commodity: 'cotton' })}
        player={player({ debt: 10000 })}
        ties={0}
        onDeliver={() => true}
        onClose={() => {}}
      />
    );
    expect(screen.getByText('Debt service').nextSibling).toHaveTextContent('-$2K');
    expect(screen.getByText(/First Central delivery: one-time/)).toBeInTheDocument();
    unmount();

    render(
      <DeliveryReceipt playerID="0"
        contract={contract()}
        player={player({ cash: 0, debt: 200000, westernDeliveryMade: true })}
        ties={0}
        onDeliver={() => true}
        onClose={() => {}}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Borrow first using Loans');
    expect(screen.queryByRole('button', { name: /Deliver/ })).toBeNull();
  });

  test('a blocked delivery has no Loans button of its own (Loans is in the money strip)', () => {
    render(
      <DeliveryReceipt playerID="0"
        contract={contract()}
        player={player({ cash: 0, debt: 200000, westernDeliveryMade: true })}
        ties={0}
        onDeliver={() => true}
        onClose={() => {}}
      />
    );
    expect(screen.queryByRole('button', { name: 'Loans' })).toBeNull();
  });
});

describe('LoansSheet', () => {
  test('borrowing steps by $5K and shows cash, debt and debt service before and after', () => {
    const onBorrow = vi.fn(() => true);
    render(<LoansSheet player={player({ debt: 10000 })} isMyTurn onBorrow={onBorrow} onRepay={() => true} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Borrow $5K more' }));
    expect(screen.getByText('Debt service').nextSibling).toHaveTextContent('$2K → $4K');
    fireEvent.click(screen.getByRole('button', { name: 'Borrow $10K' }));
    expect(onBorrow).toHaveBeenCalledWith(10000);
  });

  test('offers only the repayments the rules allow', () => {
    const { unmount } = render(
      <LoansSheet player={player({ debt: 15000 })} isMyTurn onBorrow={() => true} onRepay={() => true} onClose={() => {}} />
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Repay' }));
    expect(screen.getByText('Repaying opens once your debt reaches $20K.')).toBeInTheDocument();
    unmount();

    render(<LoansSheet player={player({ debt: 20000 })} isMyTurn onBorrow={() => true} onRepay={() => true} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Repay' }));
    expect(screen.getAllByRole('radio').map((r) => r.closest('label')?.querySelector('strong')?.textContent)).toEqual(['Repay $5K']);
  });

  test('off turn, it only shows the numbers', () => {
    render(<LoansSheet player={player()} isMyTurn={false} onBorrow={() => true} onRepay={() => true} onClose={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Borrow $5K' })).toBeNull();
    expect(screen.getByText('You can borrow on your turn.')).toBeInTheDocument();
  });
});

describe('ActionsSheet', () => {
  const G = { contracts: [], players: [['0', player()]], independentRailroads: {} } as never;

  test('Pay for track takes thousands and refuses more than the cash', () => {
    const payForTrack = vi.fn(() => true);
    render(
      <ActionsSheet
        G={G}
        playerID="0"
        player={player()}
        moves={{ payForTrack } as unknown as Moves}
        round={1}
        onNewPrivateContract={() => {}}
        onClose={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Pay for track/ }));
    const input = screen.getByRole('textbox', { name: 'Track cost in thousands of dollars' });
    expect(input).toHaveAttribute('inputmode', 'numeric');
    fireEvent.change(input, { target: { value: '18' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pay $18K' }));
    expect(screen.getByRole('alert')).toHaveTextContent("That's more than your $10K cash");
    expect(payForTrack).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pay $7K' }));
    expect(payForTrack).toHaveBeenCalledWith(7000);
  });

  test('refusing more than the cash, and the refusal goes once Loans has added enough', () => {
    const sheet = (cash: number) => (
      <ActionsSheet
        G={G}
        playerID="0"
        player={player({ cash })}
        moves={{ payForTrack: () => true } as unknown as Moves}
        round={1}
        onNewPrivateContract={() => {}}
        onClose={() => {}}
      />
    );
    const { rerender } = render(sheet(10000));
    fireEvent.click(screen.getByRole('button', { name: /Pay for track/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Track cost in thousands of dollars' }), { target: { value: '18' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pay $18K' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Loans' })).toBeNull();
    rerender(sheet(20000));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('an engine the player is short for shows the shortfall in place of Buy', () => {
    render(
      <ActionsSheet
        G={G}
        playerID="0"
        player={player({ cash: 0 })}
        moves={{} as Moves}
        initialView="engine"
        round={1}
        onNewPrivateContract={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.queryByRole('button', { name: /^Buy for/ })).toBeNull();
    expect(screen.getAllByText(/short$/).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Loans' })).toBeNull();
  });

  test("Enter in the track field pays, and doesn't submit the game page's form (+M or End Turn)", () => {
    const payForTrack = vi.fn(() => true);
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <button type="submit" name="marketContract">
          +M
        </button>
        <ActionsSheet
          G={G}
          playerID="0"
          player={player()}
          moves={{ payForTrack } as unknown as Moves}
          round={1}
          onNewPrivateContract={() => {}}
          onClose={() => {}}
        />
      </form>
    );
    fireEvent.click(screen.getByRole('button', { name: /Pay for track/ }));
    const input = screen.getByRole('textbox', { name: 'Track cost in thousands of dollars' });
    fireEvent.change(input, { target: { value: '4' } });
    expect(input.closest('form')).toBeNull();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(payForTrack).toHaveBeenCalledWith(4000);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('lists engine purchases with their price and what they trade in', () => {
    render(
      <ActionsSheet
        G={G}
        playerID="0"
        player={player()}
        moves={{} as Moves}
        round={1}
        onNewPrivateContract={() => {}}
        onClose={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Buy an engine/ }));
    expect(screen.getAllByRole('button', { name: 'Buy for $5K' })).toHaveLength(2);
    // The light or dark token is shown as the engine picture, named for screen readers.
    const tradeIn = screen.getByText(/trades in your/);
    expect(tradeIn).toHaveTextContent(/trades in your\s*2-4-0 John Bull/);
    expect(within(tradeIn).getByRole('img', { name: 'Light' })).toBeInTheDocument();
    const empty = screen.getByText(/on your empty/);
    expect(within(empty).getByRole('img', { name: 'Dark' })).toBeInTheDocument();
    expect(empty).toHaveTextContent(/token/);
    // The distance is the number and the segments picture.
    expect(within(tradeIn).getByRole('img', { name: 'segments' })).toBeInTheDocument();
  });

  test('can open straight on Buy an engine, with Back to the Actions menu', () => {
    render(
      <ActionsSheet
        G={G}
        playerID="0"
        player={player()}
        moves={{} as Moves}
        round={1}
        onNewPrivateContract={() => {}}
        initialView="engine"
        onClose={() => {}}
      />
    );
    expect(screen.getByRole('heading', { name: 'Buy an engine' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Back/ }));
    expect(screen.getByRole('button', { name: /Discard and draw new contract/ })).toHaveTextContent(
      'Replace your private contract'
    );
  });

  test('Upgrades lists the cheapest first and has no Back button', () => {
    render(
      <ActionsSheet
        G={G}
        playerID="0"
        player={player()}
        moves={{} as Moves}
        round={1}
        onNewPrivateContract={() => {}}
        initialView="upgrade"
        onClose={() => {}}
      />
    );
    const sheet = screen.getByRole('dialog', { name: 'Upgrades' });
    expect(within(sheet).queryByRole('button', { name: /Back/ })).toBeNull();
    const names = Array.from(sheet.querySelectorAll('.upgrades__item .sheet__row > span:first-child')).map(
      (el) => el.textContent
    );
    const prices = names.map((name) => UPGRADE_PRICES[UPGRADE_KEYS.find((key) => UPGRADE_NAMES[key] === name)!]);
    expect(prices).toHaveLength(UPGRADE_KEYS.length);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });
});

describe('EnginesPanel', () => {
  test("tapping an engine's name opens Buy an engine; cargo shows its icon and name", () => {
    const onBuyEngine = vi.fn();
    render(
      <EnginesPanel
        player={player({ engines: ['john-bull', 'mogul'], cargo: ['coal', null] })}
        playerID="0"
        canEdit
        onSetCargo={() => true}
        onBuyEngine={onBuyEngine}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '2-4-0 John Bull' }));
    expect(onBuyEngine).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Light engine cargo: Coal' })).toHaveTextContent('Coal');
    expect(screen.getByRole('button', { name: 'Dark engine cargo: none' })).toHaveTextContent('Set cargo');
  });

  test('picks cargo from a sheet of commodities by group, with their icons', () => {
    const onSetCargo = vi.fn(() => true);
    render(
      <EnginesPanel
        player={player({ engines: ['john-bull', 'mogul'], cargo: ['coal', null] })}
        playerID="0"
        canEdit
        onSetCargo={onSetCargo}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Light engine cargo: Coal' }));
    const sheet = screen.getByRole('dialog', { name: 'Light engine cargo' });
    const groups = within(sheet).getAllByRole('region').map((g) => g.getAttribute('aria-label'));
    expect(groups).toEqual(['Metals', 'Mined goods', 'Crops', 'Finished goods', 'Livestock']);
    expect(within(sheet).getByRole('button', { name: 'Coal' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Wine' }));
    expect(onSetCargo).toHaveBeenLastCalledWith(0, 'wine');
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Light engine cargo: Coal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear cargo' }));
    expect(onSetCargo).toHaveBeenLastCalledWith(0, null);
  });

  test("a cargo picker left open when the turn ends doesn't come back next turn", () => {
    const props = { player: player(), playerID: '0', onSetCargo: () => true };
    const { rerender } = render(<EnginesPanel {...props} canEdit />);
    fireEvent.click(screen.getByRole('button', { name: /Light engine cargo/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    rerender(<EnginesPanel {...props} canEdit={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(<EnginesPanel {...props} canEdit />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('without onBuyEngine, engine names are plain text', () => {
    render(<EnginesPanel player={player()} playerID="0" canEdit={false} onSetCargo={() => true} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('Sheet', () => {
  function Harness() {
    const [open, setOpen] = React.useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open
        </button>
        <button type="button">End Turn</button>
        {open && (
          <Sheet title="Loans" onClose={() => setOpen(false)}>
            <button type="button">Borrow</button>
          </Sheet>
        )}
      </>
    );
  }

  test('takes focus, keeps Tab inside, and gives focus back to its opener when it closes', async () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open' });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole('dialog', { name: 'Loans' }).contains(document.activeElement)).toBe(true);

    const close = screen.getByRole('button', { name: 'Close' });
    const borrow = screen.getByRole('button', { name: 'Borrow' });
    borrow.focus();
    fireEvent.keyDown(borrow, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(borrow);

    fireEvent.click(close);
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  test("Tab reaches the money strip's Loans button from a sheet, and nothing else outside it", () => {
    render(
      <>
        <button type="button">End Turn</button>
        <div data-sheet-reachable>
          <button type="button">Loans</button>
        </div>
        <Sheet title="Actions" onClose={() => {}}>
          <button type="button">Buy an engine</button>
        </Sheet>
      </>
    );
    const loans = screen.getByRole('button', { name: 'Loans', hidden: true });
    const close = screen.getByRole('button', { name: 'Close' });
    const buy = screen.getByRole('button', { name: 'Buy an engine' });
    buy.focus();
    fireEvent.keyDown(buy, { key: 'Tab' });
    expect(document.activeElement).toBe(loans);
    fireEvent.keyDown(loans, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(loans);
    fireEvent.keyDown(loans, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(buy);
  });

  test('everything behind the sheet but the money strip is inert, until the sheet closes', async () => {
    function InertHarness() {
      const [open, setOpen] = React.useState(true);
      return (
        <div data-testid="app">
          <button type="button">End Turn</button>
          <div data-sheet-reachable data-testid="strip">
            <button type="button">Loans</button>
          </div>
          {open && (
            <Sheet title="Actions" onClose={() => setOpen(false)}>
              <button type="button">Buy an engine</button>
            </Sheet>
          )}
        </div>
      );
    }
    render(<InertHarness />);
    const endTurn = screen.getByRole('button', { name: 'End Turn', hidden: true });
    expect(endTurn).toHaveAttribute('inert');
    expect(screen.getByTestId('strip')).not.toHaveAttribute('inert');
    expect(screen.getByTestId('app')).not.toHaveAttribute('inert');
    expect(screen.getByRole('dialog', { name: 'Actions' })).not.toHaveAttribute('inert');
    expect(screen.getByRole('dialog', { name: 'Actions' })).not.toHaveAttribute('aria-modal');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(endTurn).not.toHaveAttribute('inert');
  });

  test('a radio group is one Tab stop, at its checked option', () => {
    render(
      <Sheet title="Deliver" onClose={() => {}}>
        <RadioOption name="engine" checked={false} onSelect={() => {}}>
          Light engine
        </RadioOption>
        <RadioOption name="engine" checked onSelect={() => {}}>
          Dark engine
        </RadioOption>
        <button type="button">Deliver</button>
      </Sheet>
    );
    const close = screen.getByRole('button', { name: 'Close' });
    close.focus();
    fireEvent.keyDown(close, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Dark engine' }));
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Deliver' }));
    fireEvent.keyDown(document.activeElement!, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Dark engine' }));
  });

  function StackHarness() {
    const [actions, setActions] = React.useState(false);
    const [loans, setLoans] = React.useState(false);
    return (
      <>
        <button type="button" onClick={() => setActions(true)}>
          Actions
        </button>
        <button type="button" onClick={() => setLoans(true)}>
          Loans in the money strip
        </button>
        {actions && (
          <Sheet title="Actions" onClose={() => setActions(false)}>
            <button type="button">Buy an engine</button>
          </Sheet>
        )}
        {loans && (
          <Sheet title="Loans" onClose={() => setLoans(false)}>
            <button type="button">Borrow</button>
          </Sheet>
        )}
      </>
    );
  }

  test('Escape on a sheet over another dialog closes only the sheet', () => {
    const onDialogEscape = vi.fn();
    document.addEventListener('keydown', onDialogEscape);
    const onClose = vi.fn();
    render(
      <Sheet title="Loans" onClose={onClose}>
        <button type="button">Borrow</button>
      </Sheet>
    );
    fireEvent.keyDown(screen.getByRole('button', { name: 'Borrow' }), { key: 'Escape' });
    document.removeEventListener('keydown', onDialogEscape);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDialogEscape).not.toHaveBeenCalled();
  });

  test('Loans opens over another sheet; Escape closes only Loans, and focus goes back into the sheet below', async () => {
    render(<StackHarness />);
    const opener = screen.getByRole('button', { name: 'Actions' });
    opener.focus();
    fireEvent.click(opener);
    const buy = screen.getByRole('button', { name: 'Buy an engine' });
    buy.focus();

    fireEvent.click(screen.getByRole('button', { name: 'Loans in the money strip', hidden: true }));
    expect(screen.getByRole('dialog', { name: 'Loans' }).contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Loans' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Actions' })).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(buy));

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Actions' })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});

describe('EditPlaytestDialog player board', () => {
  test('saves only the fields edited, so money changed meanwhile (by Loans over it) is kept', () => {
    const G = (cash: number, debt: number) =>
      ({ contracts: [], players: [['0', { ...player(), cash, debt }]], independentRailroads: {} }) as never;
    const ctx = { phase: 'play', currentPlayer: '0' } as never;
    const setPlayerBoard = vi.fn(() => true);
    const moves = { setPlayerBoard } as unknown as Moves;
    const { rerender, container } = render(<EditPlaytestDialog isOpen onClose={() => {}} G={G(10000, 0)} ctx={ctx} moves={moves} />);
    fireEvent.change(screen.getByLabelText('Player board:'), { target: { value: '0' } });
    rerender(<EditPlaytestDialog isOpen onClose={() => {}} G={G(15000, 5000)} ctx={ctx} moves={moves} />);
    fireEvent.change(container.querySelector('#boardLight')!, { target: { value: ENGINE_TYPES[1].id } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Player Board' }));
    expect(setPlayerBoard).toHaveBeenCalledWith('0', { engines: [ENGINE_TYPES[1].id, null] });
  });

  test('forgets the chosen player when closed, so reopening shows current values, not stale ones', () => {
    const G = (cash: number) =>
      ({ contracts: [], players: [['0', { ...player(), cash }]], independentRailroads: {} }) as never;
    const ctx = { phase: 'play', currentPlayer: '0' } as never;
    const moves = {} as Moves;
    const { rerender } = render(<EditPlaytestDialog isOpen onClose={() => {}} G={G(10000)} ctx={ctx} moves={moves} />);
    fireEvent.change(screen.getByLabelText('Player board:'), { target: { value: '0' } });
    expect(screen.getByLabelText('Cash ($K):')).toHaveValue('10');

    rerender(<EditPlaytestDialog isOpen={false} onClose={() => {}} G={G(4000)} ctx={ctx} moves={moves} />);
    rerender(<EditPlaytestDialog isOpen onClose={() => {}} G={G(4000)} ctx={ctx} moves={moves} />);
    expect(screen.getByLabelText('Player board:')).toHaveValue('');
    expect(screen.queryByLabelText('Cash ($K):')).toBeNull();
    fireEvent.change(screen.getByLabelText('Player board:'), { target: { value: '0' } });
    expect(screen.getByLabelText('Cash ($K):')).toHaveValue('4');
  });
});

describe('Acquire a railroad', () => {
  const G = {
    contracts: [],
    players: [['0', player()]],
    independentRailroads: {
      Erie: { name: 'Erie', routes: [{ key: 'Albany-Buffalo', addedInRound: 0 }, { key: 'Buffalo-Erie', addedInRound: 2 }] },
      Reading: {
        name: 'Reading',
        routes: ['A-B', 'B-C', 'C-D', 'D-E'].map((key) => ({ key, addedInRound: 0 })),
      },
    },
  } as never;

  test('lists each railroad with its routes and price, acquires one, and shows the shortfall when short', () => {
    const acquireIndependentRailroad = vi.fn(() => true);
    const onClose = vi.fn();
    render(
      <ActionsSheet
        G={G}
        round={3}
        playerID="0"
        player={player({ cash: 10000 })}
        moves={{ acquireIndependentRailroad } as unknown as Moves}
        onNewPrivateContract={() => {}}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Acquire a railroad/ }));
    expect(screen.getByRole('dialog', { name: 'Acquire a railroad' })).toBeInTheDocument();
    const erieRoutes = screen.getByRole('list', { name: 'Erie routes' });
    expect(within(erieRoutes).getAllByRole('listitem')).toHaveLength(2);
    expect(within(erieRoutes).getByRole('img', { name: 'new last round' })).toBeInTheDocument();

    // Reading is 4 routes at $3K: $12K against $10K cash.
    expect(screen.getByText('$2K short')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Loans' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Acquire for $6K' }));
    expect(acquireIndependentRailroad).toHaveBeenCalledWith('Erie');
    expect(onClose).toHaveBeenCalled();
  });

  test('Back returns to the Actions menu', () => {
    render(
      <ActionsSheet
        G={G}
        round={0}
        playerID="0"
        player={player()}
        moves={{} as Moves}
        initialView="railroad"
        onNewPrivateContract={() => {}}
        onClose={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Back/ }));
    expect(screen.getByRole('dialog', { name: 'Actions' })).toBeInTheDocument();
  });
});
