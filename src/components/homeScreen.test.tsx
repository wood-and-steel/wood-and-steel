/// <reference types="@testing-library/jest-dom" />
/**
 * Stage 3 Home (docs/PLAYER_APP_REDESIGN_PLAN.md): contracts and the market as rows valued for
 * the viewing player, the claim sheet with its optional cargo, another player's card, and the
 * toolbar's ties for every player.
 */
import React from 'react';
import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { moneyValue, type Contract } from '../Contract';
import { newPlayerProps } from '../stores/playerDefaults';
import type { GameContext, GameState, PlayerProps } from '../stores/gameStore';
import { formatMoney } from '../utils/money';
import { ContractRows } from './ContractRows';
import { ClaimSheet } from './ClaimSheet';
import { PlayerSheet } from './PlayerSheet';
import { PlayerToolbar } from './PlayerToolbar';
import { PlayerBoard } from './PlayerBoard';

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

describe('ContractRows', () => {
  test('shows the value to the player, struck through to the net when debt service lowers it', () => {
    const central = contract({ destinationKey: 'Chicago', commodity: 'cotton' });
    render(<ContractRows contracts={[central]} player={player({ debt: 10000 })} actionsFor={() => []} emptyText="" />);
    const row = screen.getByRole('button', { name: /Cotton to Chicago/ });
    expect(within(row).getByText(formatMoney(moneyValue(central)), { selector: 's' })).toBeInTheDocument();
    expect(within(row).getByText(formatMoney(moneyValue(central) - 2000), { selector: 'strong' })).toBeInTheDocument();
  });

  test('marks a claimed market contract and an expiring open one', () => {
    render(
      <ContractRows
        contracts={[
          contract({ id: 'm1', type: 'market', playerID: '0' }),
          contract({ id: 'm2', type: 'market', playerID: null, commodity: 'wood', roundsLeft: 2 }),
          contract({ id: 'm3', type: 'market', playerID: null, commodity: 'wine', roundsLeft: 1 }),
        ]}
        player={player()}
        actionsFor={() => []}
        emptyText=""
      />
    );
    expect(within(screen.getByRole('button', { name: /Coal to Boston/ })).getByText('Market')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: /Wood to Boston/ })).getByText('2 rounds')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: /Wine to Boston/ })).getByText('Last round')).toBeInTheDocument();
  });

  test('a row opens its actions; rows without actions, and fulfilled ones, are not clickable', () => {
    const onFulfill = vi.fn();
    render(
      <ContractRows
        contracts={[contract(), contract({ id: 'k2', commodity: 'wood', fulfilled: true })]}
        player={player()}
        actionsFor={(c) => (c.fulfilled ? [] : [{ label: 'Fulfill', onSelect: () => onFulfill(c.id) }])}
        emptyText=""
      />
    );
    expect(screen.getByRole('button', { name: /Wood to Boston/ })).toBeDisabled();
    expect(within(screen.getByRole('button', { name: /Wood to Boston/ })).getByText('Delivered')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Coal to Boston/ }));
    fireEvent.click(screen.getByText('Fulfill'));
    expect(onFulfill).toHaveBeenCalledWith('k1');
  });

  test('says so when there are none', () => {
    render(<ContractRows contracts={[]} actionsFor={() => []} emptyText="No contracts right now." />);
    expect(screen.getByText('No contracts right now.')).toBeInTheDocument();
  });
});

describe('ClaimSheet', () => {
  const market = contract({ id: 'm1', type: 'market', playerID: null, commodity: 'lead', destinationKey: 'Boston' });

  test('suggests an engine with no cargo recorded, and can claim without recording', () => {
    const onClaim = vi.fn(() => true);
    render(
      <ClaimSheet
        contract={market}
        player={player({ engines: ['american', 'mogul'], cargo: ['coal', null] })}
        refusal={null}
        onClaim={onClaim}
        onClose={() => {}}
      />
    );
    const options = screen.getByRole('radiogroup', { name: 'Record cargo' });
    expect(within(options).getByRole('radio', { name: /Dark: 2-6-0 Mogul/ })).toBeChecked();
    expect(within(options).getByRole('radio', { name: /Light: 4-4-0 American.*Replaces coal/ })).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Claim contract' }));
    expect(onClaim).toHaveBeenLastCalledWith(1);
    fireEvent.click(within(options).getByRole('radio', { name: "Don't record cargo" }));
    fireEvent.click(screen.getByRole('button', { name: 'Claim contract' }));
    expect(onClaim).toHaveBeenLastCalledWith(undefined);
  });

  test('suggests the engine already carrying the commodity, and says so', () => {
    const onClaim = vi.fn(() => true);
    render(
      <ClaimSheet
        contract={market}
        player={player({ engines: ['mogul', 'american'], cargo: ['lead', null] })}
        refusal={null}
        onClaim={onClaim}
        onClose={() => {}}
      />
    );
    const options = screen.getByRole('radiogroup', { name: 'Record cargo' });
    expect(within(options).getByRole('radio', { name: /Light: 2-6-0 Mogul.*Carrying lead/ })).toBeChecked();
    expect(within(options).getByRole('radio', { name: /Dark: 4-4-0 American/ })).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Claim contract' }));
    expect(onClaim).toHaveBeenLastCalledWith(0);
  });

  test('explains why it can’t be claimed instead of offering to', () => {
    render(
      <ClaimSheet
        contract={market}
        player={player()}
        refusal="Claiming market contracts needs a Mogul or better."
        onClaim={() => true}
        onClose={() => {}}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('needs a Mogul');
    expect(screen.queryByRole('button', { name: 'Claim contract' })).toBeNull();
  });
});

describe('PlayerSheet', () => {
  test("shows another player's money, ties, engines, claimed contract, upgrades and debt service, not their private contract", () => {
    const ben = player({
      name: 'Ben',
      cash: 8000,
      debt: 15000,
      engines: ['american', 'mogul'],
      cargo: ['grain', null],
      upgrades: ['upgraded-stations', 'railyard'],
      hubCity: 'Atlanta',
      centralDebtServicePaid: true,
    });
    const G = {
      players: [['1', ben]],
      contracts: [
        contract({ id: 'p1', playerID: '1', commodity: 'cotton', destinationKey: 'Boston' }),
        contract({ id: 'm1', type: 'market', playerID: '1', commodity: 'imports', destinationKey: 'Richmond' }),
        contract({ id: 'f1', playerID: '1', fulfilled: true }),
      ],
      independentRailroads: {},
    } as unknown as GameState;
    render(<PlayerSheet G={G} playerID="1" onClose={() => {}} />);
    const sheet = screen.getByRole('dialog', { name: 'Ben' });
    expect(within(sheet).getByText('$8K')).toBeInTheDocument();
    expect(within(sheet).getByText('$15K')).toBeInTheDocument();
    expect(within(sheet).getByText('Grain')).toBeInTheDocument();
    expect(within(sheet).getByText('not recorded')).toBeInTheDocument();
    expect(within(sheet).getByText('Imports to Richmond')).toBeInTheDocument();
    expect(within(sheet).queryByText(/Cotton/)).toBeNull();
    expect(within(sheet).getByText('Hub · Atlanta')).toBeInTheDocument();
    expect(within(sheet).getByText('Railyard')).toBeInTheDocument();
    expect(within(sheet).getByText('Central paid')).toBeInTheDocument();
  });
});

describe('PlayerToolbar', () => {
  test("lists each other player's ties, not their money, and opens their card when pressed", () => {
    const onOpenPlayer = vi.fn();
    const G = {
      players: [
        ['0', player({ name: 'Ada' })],
        ['1', player({ name: 'Ben', cash: 21000, debt: 15000 })],
      ],
      contracts: [contract({ id: 'f1', playerID: '1', fulfilled: true })],
      independentRailroads: {},
    } as unknown as GameState;
    const ctx = { phase: 'play', currentPlayer: '0', playOrder: ['0', '1'], playOrderPos: 0, numPlayers: 2, turn: 1, round: 1 } as GameContext;
    render(<PlayerToolbar G={G} ctx={ctx} playerID="0" startingContractExists currentPhase="play" onOpenPlayer={onOpenPlayer} />);
    const ben = screen.getByRole('button', { name: /^Ben, \d+ ties?\. Show their board$/ });
    expect(ben).not.toHaveTextContent('$');
    fireEvent.click(ben);
    expect(onOpenPlayer).toHaveBeenCalledWith('1');
    expect(screen.queryByRole('button', { name: '+M' })).toBeNull();
  });
});

describe('PlayerBoard (Home)', () => {
  test('lists the player’s contracts, then the market, upgrades and fulfilled contracts', () => {
    const G = {
      players: [['0', player({ hubCity: 'Boston' })]],
      contracts: [
        contract({ id: 'p1' }),
        contract({ id: 'm1', type: 'market', playerID: null, commodity: 'wine' }),
        contract({ id: 'f1', fulfilled: true, commodity: 'wood' }),
      ],
      independentRailroads: {},
    } as unknown as GameState;
    const ctx = { phase: 'play', currentPlayer: '0', playOrder: ['0'], playOrderPos: 0, numPlayers: 1, turn: 1, round: 1 } as GameContext;
    render(
      <PlayerBoard
        G={G}
        ctx={ctx}
        playerID="0"
        startingContractExists
        currentPhase="play"
        onStartingPairSelect={() => {}}
        onToggleFulfilled={() => {}}
        onDelete={() => {}}
        onClaimContract={() => {}}
      />
    );
    const sections = screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'));
    expect(sections).toEqual(['Your contracts', 'Market contracts', 'Your upgrades', 'Fulfilled contracts']);
    expect(within(screen.getByRole('region', { name: 'Market contracts' })).getByText('Wine to Boston')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Your upgrades' })).getByText('Hub · Boston')).toBeInTheDocument();
  });
});

describe('Contract rows: menus, ranges and empty states (review fixes)', () => {
  test('the menu takes focus, arrow keys move through it, and Escape gives focus back to the row', () => {
    render(
      <ContractRows
        contracts={[contract()]}
        player={player()}
        actionsFor={() => [
          { label: 'Fulfill', onSelect: () => {} },
          { label: 'Discard', onSelect: () => {} },
        ]}
        emptyText=""
      />
    );
    const row = screen.getByRole('button', { name: /Coal to Boston/ });
    row.focus();
    fireEvent.click(row);
    expect(document.activeElement).toHaveTextContent('Fulfill');
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement).toHaveTextContent('Discard');
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement).toHaveTextContent('Fulfill');
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByText('Discard')).toBeNull();
    expect(document.activeElement).toBe(row);
  });

  test('an open menu is forgotten when its row loses its actions, so it does not come back later', () => {
    const actions = [{ label: 'Fulfill', onSelect: () => {} }];
    const view = (withActions: boolean) => (
      <ContractRows contracts={[contract()]} player={player()} actionsFor={() => (withActions ? actions : [])} emptyText="" />
    );
    const { rerender } = render(view(true));
    fireEvent.click(screen.getByRole('button', { name: /Coal to Boston/ }));
    expect(screen.getByText('Fulfill')).toBeInTheDocument();
    rerender(view(false));
    rerender(view(true));
    expect(screen.queryByText('Fulfill')).toBeNull();
  });

  test('shows a range when the player’s engines would pay differently', () => {
    const c = contract();
    const value = moneyValue(c);
    render(<ContractRows contracts={[c]} player={player({ engines: ['mountain', 'prairie'] })} actionsFor={() => []} emptyText="" />);
    const bonus = Math.floor((value * 4) / 3 / 1000) * 1000;
    expect(screen.getByTitle('Depends on which engine delivers')).toHaveTextContent(`${formatMoney(value)}–${formatMoney(bonus)}`);
  });

  test('an empty market says the market is closed only before anyone owns a Mogul', () => {
    const board = (engines: PlayerProps['engines']) => (
      <PlayerBoard
        G={{ players: [['0', player({ engines })]], contracts: [], independentRailroads: {} } as unknown as GameState}
        ctx={{ phase: 'play', currentPlayer: '0', playOrder: ['0'], playOrderPos: 0, numPlayers: 1, turn: 1, round: 1 } as GameContext}
        playerID="0"
        startingContractExists
        currentPhase="play"
        onStartingPairSelect={() => {}}
        onToggleFulfilled={() => {}}
        onDelete={() => {}}
      />
    );
    const { rerender } = render(board(['american', null]));
    expect(screen.getByText('The market opens when someone buys a Mogul.')).toBeInTheDocument();
    rerender(board(['mogul', null]));
    expect(screen.getByText('No open market contracts.')).toBeInTheDocument();
  });
});
