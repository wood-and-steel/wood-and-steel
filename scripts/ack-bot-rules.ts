/**
 * Record that the bots have been reviewed against the current rules (docs/BOT_AGENT_GUIDE.md,
 * Rule changes): rewrites src/bots/rules/rulesFingerprint.ts with the current hash.
 * Run with `npm run bots:ack-rules` after updating the bots, not to silence the test.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeRulesFingerprint } from '../src/bots/rules/rulesSources';

const root = process.cwd();
const hash = computeRulesFingerprint(root);
const file = join(root, 'src/bots/rules/rulesFingerprint.ts');
writeFileSync(
  file,
  `/**
 * SHA-256 of the rules sources the bots were last reviewed against (see rulesSources.ts).
 * rulesFingerprint.test.ts fails when they change. Don't edit by hand: follow
 * docs/BOT_AGENT_GUIDE.md (Rule changes), then run \`npm run bots:ack-rules\`.
 *
 * What changed since the last review:
 *   git diff $(git log -1 --format=%H -- src/bots/rules/rulesFingerprint.ts) -- "docs/Game rules.md" src/stores/moveValidation.ts src/data src/board/playerBoardData.ts
 */
export const RULES_FINGERPRINT = '${hash}';
`
);
console.log(`Bot rules fingerprint updated: ${hash}`);
