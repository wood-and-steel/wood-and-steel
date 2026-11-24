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
import { formatMoney } from '../utils/money';
import { Sheet } from './Sheet';
import { EditPlaytestDialog } from './EditPlaytestDialog';

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
        onAcquireRailroad={() => {}}
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
          onAcquireRailroad={() => {}}
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
        onAcquireRailroad={() => {}}
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
});

describe('EditPlaytestDialog player board', () => {
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
