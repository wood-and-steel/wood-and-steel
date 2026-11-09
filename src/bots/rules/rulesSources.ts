/**
 * Reading the rules sources the bots depend on (docs/BOT_PLAN.md, Rule changes). Node only:
 * used by tests and by `npm run bots:ack-rules`, never by the app.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Files whose changes may need bot changes. Moves are read from moveValidation.ts separately. */
export const FINGERPRINT_FILES = [
  'docs/Game rules.md',
  'src/data/cities.ts',
  'src/data/commodities.ts',
  'src/data/routes.ts',
  'src/data/startingRoutes.ts',
  'src/board/playerBoardData.ts',
] as const;

export const MOVE_VALIDATION_FILE = 'src/stores/moveValidation.ts';
export const RULES_DOC = 'docs/Game rules.md';

export function readRepoFile(root: string, path: string): string {
  return readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');
}

/** MOVES_BY_PHASE, parsed from moveValidation.ts's source (it isn't exported). */
export function parseMovesByPhase(source: string): Record<string, string[]> {
  const start = source.indexOf('MOVES_BY_PHASE');
  const open = source.indexOf('{', source.indexOf('=', start));
  const close = source.indexOf('};', open);
  if (start === -1 || open === -1 || close === -1) throw new Error('MOVES_BY_PHASE not found in moveValidation.ts');
  const body = source.slice(open + 1, close);
  const phases: Record<string, string[]> = {};
  for (const match of body.matchAll(/(\w+):\s*\[([^\]]*)\]/g)) {
    phases[match[1]] = [...match[2].matchAll(/['"](\w+)['"]/g)].map((m) => m[1]);
  }
  return phases;
}

/** Every move in any phase, sorted. */
export function allMoves(movesByPhase: Record<string, string[]>): string[] {
  return [...new Set(Object.values(movesByPhase).flat())].sort();
}

/** "Service Yard – $10,000 (early)" -> "Service Yard" */
function headingName(line: string): string {
  return line.replace(/^#+\s*/, '').split(/\s[–-]\s/)[0].trim();
}

/**
 * The action headings the bots must account for: each `###` under "## Turn actions", and each
 * `####` under "### Buy an upgrade".
 */
export function ruleHeadings(markdown: string): { actions: string[]; upgrades: string[] } {
  const lines = markdown.split('\n');
  const start = lines.findIndex((l) => l.trim() === '## Turn actions');
  if (start === -1) throw new Error('"## Turn actions" not found in the rules');
  let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  if (end === -1) end = lines.length;
  const section = lines.slice(start + 1, end);
  const actions: string[] = [];
  const upgrades: string[] = [];
  let inUpgrades = false;
  for (const line of section) {
    if (/^### /.test(line)) {
      const name = headingName(line);
      actions.push(name);
      inUpgrades = name === 'Buy an upgrade';
    } else if (inUpgrades && /^#### /.test(line)) {
      upgrades.push(headingName(line));
    }
  }
  return { actions, upgrades };
}

/** SHA-256 over the fingerprint files and the move list. */
export function computeRulesFingerprint(root: string): string {
  const hash = createHash('sha256');
  for (const path of FINGERPRINT_FILES) {
    hash.update(`${path}\n`);
    hash.update(readRepoFile(root, path));
    hash.update('\n');
  }
  hash.update('MOVES_BY_PHASE\n');
  hash.update(JSON.stringify(parseMovesByPhase(readRepoFile(root, MOVE_VALIDATION_FILE))));
  return hash.digest('hex');
}
