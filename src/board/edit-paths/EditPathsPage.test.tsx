import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { routes } from '../../data/routes';
import { FLAGGED_ROUTES } from '../geometry/routePaths';
import { EditPathsPage } from './EditPathsPage';

describe('EditPathsPage', () => {
  it('draws every route and lists flagged routes first', () => {
    const { container } = render(<EditPathsPage />);
    expect(container.querySelectorAll('.editPaths__route')).toHaveLength(routes.size);
    expect(container.querySelectorAll('.editPaths__route--flagged')).toHaveLength(Object.keys(FLAGGED_ROUTES).length);
    // With nothing flagged, the page opens on the "All" filter.
    const flaggedCount = Object.keys(FLAGGED_ROUTES).length;
    expect(container.querySelectorAll('.editPaths__listItem')).toHaveLength(flaggedCount > 0 ? flaggedCount : routes.size);
  });

  it('selects a route, shows handles, and splits it', () => {
    const { container } = render(<EditPathsPage />);
    fireEvent.click(screen.getByRole('button', { name: /^All/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Atlanta-Birmingham' }));
    expect(screen.getByRole('heading', { name: 'Atlanta-Birmingham' })).toBeTruthy();
    // 1 segment: 2 anchors + 2 control points
    expect(container.querySelectorAll('.editPaths__handle')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Split into 2' }));
    expect(container.querySelectorAll('.editPaths__handle')).toHaveLength(7);
    expect(screen.getByText('1 unsaved route(s)')).toBeTruthy();
  });
});
