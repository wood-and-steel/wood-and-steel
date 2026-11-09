import { describe, expect, it } from 'vitest';
import { ACTION_COVERAGE, MOVE_COVERAGE, UPGRADE_COVERAGE } from './coverage';
import {
  MOVE_VALIDATION_FILE,
  RULES_DOC,
  allMoves,
  parseMovesByPhase,
  readRepoFile,
  ruleHeadings,
} from './rulesSources';

const root = process.cwd();
const sorted = (keys: string[]) => [...keys].sort();
const HINT = 'Update src/bots/rules/coverage.ts and the bots (docs/BOT_AGENT_GUIDE.md, Rule changes).';

describe('bot coverage map', () => {
  it('labels every app move, and only those', () => {
    const moves = allMoves(parseMovesByPhase(readRepoFile(root, MOVE_VALIDATION_FILE)));
    expect(moves.length).toBeGreaterThan(5);
    expect(sorted(Object.keys(MOVE_COVERAGE)), HINT).toEqual(moves);
  });

  it('labels every turn action in the rules, and only those', () => {
    const { actions } = ruleHeadings(readRepoFile(root, RULES_DOC));
    expect(sorted(Object.keys(ACTION_COVERAGE)), HINT).toEqual(sorted(actions));
  });

  it('labels every upgrade in the rules, and only those', () => {
    const { upgrades } = ruleHeadings(readRepoFile(root, RULES_DOC));
    expect(upgrades.length).toBeGreaterThan(5);
    expect(sorted(Object.keys(UPGRADE_COVERAGE)), HINT).toEqual(sorted(upgrades));
  });

  it('never uses "Go first next round"', () => {
    expect(ACTION_COVERAGE['Go first next round'].status).toBe('ignored');
  });
});

describe('rules source parsing', () => {
  it('parses MOVES_BY_PHASE from source', () => {
    const parsed = parseMovesByPhase(`const MOVES_BY_PHASE: X = {\n  a: [],\n  setup: ['m1'],\n  play: [\n 'm2',\n "m3",\n ],\n};`);
    expect(parsed).toEqual({ a: [], setup: ['m1'], play: ['m2', 'm3'] });
  });

  it('reads action and upgrade headings, dropping prices', () => {
    const md = [
      '## Turn actions',
      '### Run trains',
      '#### Picking up a commodity',
      '### Buy an upgrade',
      '#### Hub – $15,000 (early-mid)',
      '#### Railyard - $10,000 (mid)',
      '### Borrow money',
      '## End of round',
      '### Not an action',
    ].join('\n');
    expect(ruleHeadings(md)).toEqual({ actions: ['Run trains', 'Buy an upgrade', 'Borrow money'], upgrades: ['Hub', 'Railyard'] });
  });
});
