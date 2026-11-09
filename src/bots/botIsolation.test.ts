import { describe, expect, it } from 'vitest';

/**
 * Guards from docs/BOT_PLAN.md (Isolation and gating): the main app reaches src/bots/ only
 * through flag-gated lazy imports in App.tsx, so production builds contain no bot code.
 */
const appSources = import.meta.glob(
  ['../**/*.{ts,tsx,js,jsx}', '!../bots/**', '!../board/**', '!../**/*.test.{ts,tsx,js,jsx}'],
  { query: '?raw', import: 'default', eager: true }
) as Record<string, string>;

/** Decision logic that must run anywhere (host browser, tournament, a future server). */
const pureSources = import.meta.glob(['./rng.ts', './ports.ts', './heuristic/**/*.ts', './engine/**/*.ts', './runner/**/*.ts', '!./**/*.test.ts', '!./**/*.testHelper.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

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

  it.each(Object.entries(pureSources))('%s is pure (no stores, React, Supabase, or browser globals)', (_file, source) => {
    // Type-only imports are erased at build time, so they're allowed.
    const runtimeImports = source.split('\n').filter((line) => /^import (?!type )/.test(line)).join('\n');
    expect(runtimeImports).not.toMatch(/from ['"][^'"]*stores\//);
    expect(runtimeImports).not.toMatch(/from ['"]react['"]|from ['"]@supabase\//);
    expect(source).not.toMatch(/\b(window|document|localStorage|sessionStorage)\b/);
  });

  it('the board imports only the read side of bot state', () => {
    const boardSources = import.meta.glob(['../board/**/*.{ts,tsx}', '!../board/**/*.test.{ts,tsx}'], {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;
    const imports = Object.values(boardSources).flatMap((source) => source.match(/from ['"][^'"]*bots\/[^'"]*['"]/g) ?? []);
    expect(imports.length).toBeGreaterThan(0);
    for (const line of imports) expect(line).toMatch(/bots\/state\/(botStates|botStatesAdapter)['"]/);
  });
});

