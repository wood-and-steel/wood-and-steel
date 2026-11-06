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

  expect(screen.getByRole('button', { name: /local/i })).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /cloud/i }).length).toBeGreaterThan(0);
});
