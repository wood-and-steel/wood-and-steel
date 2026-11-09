import { describe, expect, it } from 'vitest';

/**
 * Guards from docs/BOT_PLAN.md (Isolation and gating): the main app reaches src/bots/ only
 * through flag-gated lazy imports in App.tsx, so production builds contain no bot code.
 */
const appSources = import.meta.glob(
  ['../**/*.{ts,tsx,js,jsx}', '!../bots/**', '!../board/**', '!../**/*.test.{ts,tsx,js,jsx}'],
  { query: '?raw', import: 'default', eager: true }
) as Record<string, string>;

const BOTS_PATH = /['"][./]*\/?bots\//;

describe('bot isolation', () => {
  it('only App.tsx references src/bots, via lazy imports behind __INCLUDE_BOARD__', () => {
    const importers = Object.entries(appSources).filter(([, source]) => BOTS_PATH.test(source));
    expect(importers.map(([file]) => file)).toEqual(['../app/App.tsx']);

    const appSource = importers[0][1];
    expect(appSource).not.toMatch(/^import .*['"][^'"]*\/bots\//m);
    const lazyImports = appSource.match(/import\(['"][^'"]*bots\/[^'"]*['"]\)/g) ?? [];
    expect(lazyImports.length).toBeGreaterThan(0);
    expect(appSource).toMatch(/__INCLUDE_BOARD__\s*\?\s*React\.lazy\(\(\) =>\s*import\(['"][^'"]*bots\//);
  });

  it('bot styles are not part of the global stylesheet', () => {
    const indexCss = import.meta.glob('../shared/styles/index.css', { query: '?raw', import: 'default', eager: true });
    expect(Object.values(indexCss)[0]).not.toMatch(/bots\.css/);
  });
});
