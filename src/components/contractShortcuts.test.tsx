/// <reference types="@testing-library/jest-dom" />
/**
 * Tapping a contract opens its sheet straight away, and the menu's Discard Contract and Draw
 * Private Contract items.
 */
import React from 'react';
import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { Contract } from '../Contract';
import { newPlayerProps } from '../stores/playerDefaults';
import type { GameContext, GameState } from '../stores/gameStore';
import { DiscardSheet } from './DiscardSheet';
import { NavBar } from './NavBar';
import { PlayerBoard } from './PlayerBoard';

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

const ctx = { phase: 'play', currentPlayer: '0', playOrder: ['0', '1'], playOrderPos: 0, numPlayers: 2, turn: 1, round: 1 } as GameContext;

describe('tapping a contract on Home', () => {
  const G = {
    players: [
      ['0', { ...newPlayerProps('Ada'), engines: ['mogul', null] }],
      ['1', newPlayerProps('Bo')],
    ],
    contracts: [contract(), contract({ id: 'm1', type: 'market', playerID: null, commodity: 'wine' })],
    independentRailroads: {},
  } as unknown as GameState;

  const board = (currentPlayer: string, onToggleFulfilled = vi.fn(), onClaimContract = vi.fn()) => (
    <PlayerBoard
      G={G}
      ctx={{ ...ctx, currentPlayer }}
      playerID="0"
      startingContractExists
      currentPhase="play"
      onStartingPairSelect={() => {}}
      onToggleFulfilled={onToggleFulfilled}
      onClaimContract={onClaimContract}
    />
  );

  test('opens the delivery receipt for your contract and the claim sheet for a market one, without a menu', () => {
    const onToggleFulfilled = vi.fn();
    const onClaimContract = vi.fn();
    render(board('0', onToggleFulfilled, onClaimContract));
    fireEvent.click(screen.getByRole('button', { name: /Coal to Boston/ }));
    expect(onToggleFulfilled).toHaveBeenCalledWith('k1');
    fireEvent.click(screen.getByRole('button', { name: /Wine to Boston/ }));
    expect(onClaimContract).toHaveBeenCalledWith('m1');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  test("can't be tapped on someone else's turn", () => {
    render(board('1'));
    expect(screen.getByRole('button', { name: /Coal to Boston/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Wine to Boston/ })).toBeDisabled();
  });
});

describe('DiscardSheet', () => {
  test("lists the player's contracts and the market, and discards the one chosen", () => {
    const onDiscard = vi.fn();
    const onClose = vi.fn();
    render(
      <DiscardSheet
        mine={[contract(), contract({ id: 'c1', type: 'market', commodity: 'fruit', destinationKey: 'Cincinnati' })]}
        market={[contract({ id: 'm1', type: 'market', playerID: null, commodity: 'wine' })]}
        onDiscard={onDiscard}
        onClose={onClose}
      />
    );
    const yours = screen.getByRole('radiogroup', { name: 'Your contracts' });
    expect(within(yours).getByRole('radio', { name: /Coal to Boston/ })).toBeInTheDocument();
    expect(within(yours).getByRole('radio', { name: /Fruit to Cincinnati.*Claimed market contract/ })).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Discard contract' });
    expect(button).toBeDisabled();
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Market contracts' })).getByRole('radio', { name: /Wine to Boston/ }));
    fireEvent.click(button);
    expect(onDiscard).toHaveBeenCalledWith('m1');
    expect(onClose).toHaveBeenCalled();
  });

  test('says so when there is nothing to discard', () => {
    render(<DiscardSheet mine={[]} market={[]} onDiscard={() => {}} onClose={() => {}} />);
    expect(screen.getByText('There are no contracts to discard.')).toBeInTheDocument();
  });
});

describe('menu', () => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;

  // jsdom can't measure the menu's anchor, so the menu stays hidden for measuring.
  const menuItem = (label: string) =>
    screen.getAllByRole('menuitem', { hidden: true }).find((item) => item.textContent === label)!;

  const navBar = (props: Partial<React.ComponentProps<typeof NavBar>>) => (
    <NavBar
      gameManager={{}}
      onNavigateToLobby={() => {}}
      onOpenEditPlaytest={() => {}}
      activeTab="board"
      onTabChange={() => {}}
      {...props}
    />
  );

  test('has Discard Contract and Draw Private Contract right below Add Contract or City', () => {
    const onDiscardContract = vi.fn();
    const onDrawPrivateContract = vi.fn();
    render(navBar({ onDiscardContract, onDrawPrivateContract, canActFromMenu: true }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Menu' })[0]);
    const items = screen.getAllByRole('menuitem', { hidden: true }).map((i) => i.textContent);
    const add = items.indexOf('Add Contract or City...');
    expect(items.slice(add, add + 3)).toEqual(['Add Contract or City...', 'Discard Contract...', 'Draw Private Contract']);
    fireEvent.click(menuItem('Draw Private Contract'));
    expect(onDrawPrivateContract).toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Menu' })[0]);
    fireEvent.click(menuItem('Discard Contract...'));
    expect(onDiscardContract).toHaveBeenCalled();
  });

  test('disables Draw Private Contract while the player holds one', () => {
    render(navBar({ onDiscardContract: () => {}, onDrawPrivateContract: () => {}, canActFromMenu: true, hasPrivateContract: true }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Menu' })[0]);
    expect(menuItem('Draw Private Contract')).toBeDisabled();
    expect(menuItem('Discard Contract...')).toBeEnabled();
  });
});
