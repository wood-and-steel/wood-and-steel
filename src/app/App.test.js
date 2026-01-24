import { render, screen } from '@testing-library/react';
import App from './App';

test('renders game UI with starting cities prompt', () => {
  render(<App />);
  const buttons = screen.getAllByRole('button', { name: /choose starting cities/i });
  expect(buttons.length).toBeGreaterThan(0);
  expect(buttons[0]).toBeInTheDocument();
});
