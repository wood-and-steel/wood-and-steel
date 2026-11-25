/**
 * src/map/ is shared by the player app and the playtest board app (docs/BOARD_AGENT_GUIDE.md).
 * It must not pull board or bot code into production builds, and, like the board, it only reads
 * game state: drawing never changes G or ctx.
 */
const mapSources = import.meta.glob(['./**/*.{ts,tsx}', '!./**/*.test.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('map isolation', () => {
  it('finds map sources', () => {
    expect(Object.keys(mapSources)).toContain('./MapRoutes.tsx');
  });

  it.each(Object.entries(mapSources))('%s imports nothing from the board or bots', (_file, source) => {
    expect(source).not.toMatch(/from ['"][^'"]*\/(board|bots)\//);
    expect(source).not.toMatch(/import\(['"][^'"]*\/(board|bots)\//);
  });

  it.each(Object.entries(mapSources))('%s never writes game state', (_file, source) => {
    expect(source).not.toMatch(/stores\/gameActions|stores\/moves|saveGameState|useGameStore/);
  });
});
