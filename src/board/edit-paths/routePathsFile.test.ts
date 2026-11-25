import { readFileSync } from 'fs';
import { resolve } from 'path';
import { EDITED_ROUTES, FLAGGED_ROUTES, ROUTE_PATHS } from '../../map/routePaths';
import { formatRoutePathsFile } from './routePathsFile';

describe('routePaths.ts file', () => {
  it('formats routePaths.ts exactly as scripts/trace-routes.py does', () => {
    const onDisk = readFileSync(resolve(process.cwd(), 'src/map/routePaths.ts'), 'utf-8');
    expect(formatRoutePathsFile(ROUTE_PATHS, FLAGGED_ROUTES, EDITED_ROUTES)).toBe(onDisk.replace(/\r\n/g, '\n'));
  });
});
