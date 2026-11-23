/// <reference types="@testing-library/jest-dom" />
/**
 * ContractDisplay menu: open market contracts can only be claimed (or discarded), the player's
 * own unfulfilled contracts can be fulfilled, and fulfilled contracts have no menu at all.
 */
import React from 'react';
import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContractDisplay } from './ContractDisplay';
import type { Contract } from '../Contract';

function contract(overrides: Partial<Contract>): Contract {
  return {
    id: 'c1',
    destinationKey: 'Chicago',
    commodity: 'coal',
    type: 'private',
    playerID: '0',
    fulfilled: false,
    creationTime: 0,
    turnsHeld: null,
    ...overrides,
  } as Contract;
}

function renderDisplay(c: Contract) {
  const onCardClick = vi.fn();
  render(
    <ContractDisplay
      contract={c}
      isMenuOpen={true}
      onCardClick={onCardClick}
      onClose={() => {}}
      onCloseOutside={() => {}}
      onToggleFulfilled={() => {}}
      onDelete={() => {}}
      onClaimContract={() => {}}
    />
  );
  return { onCardClick };
}

const menuItems = () => screen.queryAllByRole('menuitem', { hidden: true }).map((el) => el.textContent);

describe('ContractDisplay menu', () => {
  test('open market contract offers Claim and Discard, not Fulfill', () => {
    renderDisplay(contract({ type: 'market', playerID: null }));
    expect(menuItems()).toEqual(['Claim Contract', 'Discard']);
  });

  test('claimed market contract offers Fulfill and Discard', () => {
    renderDisplay(contract({ type: 'market', playerID: '0' }));
    expect(menuItems()).toEqual(['Fulfill Contract', 'Discard']);
  });

  test('unfulfilled private contract offers Fulfill and Discard', () => {
    renderDisplay(contract({}));
    expect(menuItems()).toEqual(['Fulfill Contract', 'Discard']);
  });

  test.each([
    ['private', contract({ fulfilled: true })],
    ['market', contract({ type: 'market', playerID: '0', fulfilled: true })],
  ])('fulfilled %s contract is not clickable and shows no menu', (_label, c) => {
    renderDisplay(c);
    expect(screen.queryByRole('menu', { hidden: true })).toBeNull();
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
