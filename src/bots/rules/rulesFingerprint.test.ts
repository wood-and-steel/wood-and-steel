import { describe, expect, it } from 'vitest';
import { computeRulesFingerprint } from './rulesSources';
import { RULES_FINGERPRINT } from './rulesFingerprint';

describe('bot rules fingerprint', () => {
  it('matches the rules the bots were last reviewed against', () => {
    expect(
      computeRulesFingerprint(process.cwd()),
      'The rules, moves, or game data changed since the bots were last reviewed. Follow ' +
        'docs/BOT_AGENT_GUIDE.md (Rule changes): diff since the last review, update the bots, ' +
        'then run `npm run bots:ack-rules`.'
    ).toBe(RULES_FINGERPRINT);
  });
});
