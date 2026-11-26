/**
 * SHA-256 of the rules sources the bots were last reviewed against (see rulesSources.ts).
 * rulesFingerprint.test.ts fails when they change. Don't edit by hand: follow
 * docs/BOT_AGENT_GUIDE.md (Rule changes), then run `npm run bots:ack-rules`.
 *
 * What changed since the last review:
 *   git diff $(git log -1 --format=%H -- src/bots/rules/rulesFingerprint.ts) -- "docs/Game rules.md" src/stores/moveValidation.ts src/data src/rules/playerBoard.ts
 */
export const RULES_FINGERPRINT = '4bec01e8e195a350bec8f97c671e9aced5e58c6b560a85346f785d041db55f23';
