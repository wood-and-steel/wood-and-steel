/**
 * Guards from docs/archived/BOARD_APP_PLAN.md: the board is read-only with respect to G/ctx,
 * and the main app imports nothing from src/board/ except the lazy, flag-gated entry points.
 */
const boardSources = import.meta.glob(['./**/*.{ts,tsx}', '!./**/*.test.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const appSources = import.meta.glob(['../**/*.{ts,tsx,js,jsx}', '!../board/**', '!../**/*.test.{ts,tsx,js,jsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('board isolation', () => {
  it('finds board sources', () => {
    expect(Object.keys(boardSources)).toContain('./BoardApp.tsx');
  });

  it.each(Object.entries(boardSources))('%s never writes game state', (_file, source) => {
    expect(source).not.toMatch(/stores\/gameActions|stores\/moves|saveGameState/);
  });

  it('only App.tsx references src/board, via lazy imports', () => {
    const importers = Object.entries(appSources).filter(([, source]) => /['"][./]*\/?board\//.test(source));
    expect(importers.map(([file]) => file)).toEqual(['../app/App.tsx']);
    const appSource = importers[0][1];
    const boardImports = appSource.match(/import\(['"][^'"]*board\/[^'"]*['"]\)/g) ?? [];
    expect(boardImports.length).toBeGreaterThan(0);
    expect(appSource).not.toMatch(/^import .*['"][^'"]*\/board\//m);
  });
});
