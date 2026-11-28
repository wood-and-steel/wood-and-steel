/**
 * SHA-256 of the rules sources the bots were last reviewed against (see rulesSources.ts).
 * rulesFingerprint.test.ts fails when they change. Don't edit by hand: follow
 * docs/BOT_AGENT_GUIDE.md (Rule changes), then run `npm run bots:ack-rules`.
 *
 * What changed since the last review:
 *   git diff $(git log -1 --format=%H -- src/bots/rules/rulesFingerprint.ts) -- docs/rulebook docs/RULES_AGENT_GUIDE.md src/stores/moveValidation.ts src/data src/rules/playerBoard.ts
 */
export const RULES_FINGERPRINT = '409d15efa205455d7fc125cc4284f837c971e9ab64767ad574d69565345bd768';
