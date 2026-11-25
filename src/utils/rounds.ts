/**
 * `ctx.round` is already counted from 1 in play: the setup phase ends partway through the last
 * setup turn, so that turn's end runs the play phase's round-end hook and moves round 0 to 1.
 */
export function displayRound(round: number): number {
  return round + 0;
}
