/**
 * SHA-256 of the rules sources the bots were last reviewed against (see rulesSources.ts).
 * rulesFingerprint.test.ts fails when they change. Don't edit by hand: follow
 * docs/BOT_AGENT_GUIDE.md (Rule changes), then run `npm run bots:ack-rules`.
 *
 * What changed since the last review:
 *   git diff $(git log -1 --format=%H -- src/bots/rules/rulesFingerprint.ts) -- "docs/Game rules.md" src/stores/moveValidation.ts src/data src/board/playerBoardData.ts
 */
export const RULES_FINGERPRINT = '93d50f3b9adbaca227515ec43a2b635593f3ca9065d50f06777526e3c4845b85';
