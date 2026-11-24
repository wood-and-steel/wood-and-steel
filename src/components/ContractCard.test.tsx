/// <reference types="@testing-library/jest-dom" />
/** ContractCard (used by the private contract offers) shows an expiry badge only when given one. */
import React from 'react';
import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContractCard } from './ContractCard';

describe('ContractCard expiry badge', () => {
  test.each([
    [3, '3⏱️'],
    [1, '1⏱️'],
  ])('shows the badge for %i', (roundsLeft, text) => {
    render(<ContractCard commodity="coal" destinationKey="Chicago" variant="market" roundsLeft={roundsLeft} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  test('shows no badge when roundsLeft is absent', () => {
    const { container } = render(<ContractCard commodity="coal" destinationKey="Chicago" variant="market" />);
    expect(container.querySelector('.contract__expiry')).toBeNull();
  });
});
