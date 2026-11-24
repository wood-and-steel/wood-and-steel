/**
 * Rounds are counted from 0 in `ctx.round` (the first round of play is round 0); players see
 * them counted from 1.
 */
export function displayRound(round: number): number {
  return round + 1;
}
