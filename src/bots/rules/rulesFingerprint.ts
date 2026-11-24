/**
 * SHA-256 of the rules sources the bots were last reviewed against (see rulesSources.ts).
 * rulesFingerprint.test.ts fails when they change. Don't edit by hand: follow
 * docs/BOT_AGENT_GUIDE.md (Rule changes), then run `npm run bots:ack-rules`.
 *
 * What changed since the last review:
 *   git diff $(git log -1 --format=%H -- src/bots/rules/rulesFingerprint.ts) -- "docs/Game rules.md" src/stores/moveValidation.ts src/data src/rules/playerBoard.ts
 */
export const RULES_FINGERPRINT = '76124153820f1ff5773d012bee604c423482334c40c16ddcc51d9995767ebc3a';
