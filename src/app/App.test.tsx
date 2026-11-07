/// <reference types="@testing-library/jest-dom" />
import { test, expect } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

test('renders lobby screen on initial load', async () => {
  await act(async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
  });

  await waitFor(() => {
    expect(screen.getByText(/wood and steel lobby/i)).toBeInTheDocument();
  });

  // Single mode: no storage/mode tabs, join form always shown
  expect(screen.queryByRole('button', { name: /local/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /hotseat/i })).not.toBeInTheDocument();
  expect(screen.getByLabelText(/join a game/i)).toBeInTheDocument();
});
