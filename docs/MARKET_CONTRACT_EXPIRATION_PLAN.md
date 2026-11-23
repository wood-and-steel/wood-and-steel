# Plan: Market contract expiration

Goal: keep the market tableau fresh. Unclaimed market contracts occasionally start a countdown, and when it runs out they leave the tableau and a new one replaces them. Alongside this, contracts in the tableau can only be claimed, not fulfilled directly, and no contract, private or market, can be unfulfilled.

"In the tableau" means open market contracts: `type === 'market'`, `playerID === null`, `!fulfilled` (same as `openMarketContracts` in `src/stores/gameActions.ts`).

## Rules being implemented

### Expiration

1. Expiration applies only to open market contracts. Claiming a contract cancels its countdown.
2. **The market clock starts when the market opens**, meaning the first round-end at which the tableau has any contracts (for example after a player buys a Mogul and the tableau is filled). Round-ends before that do nothing and do not count toward the guarantee below.
3. At the end of every round after the market opens, in this order:
   1. **Tick.** Every countdown in progress drops by 1.
   2. **Expire.** Every contract whose countdown reached 0 is removed from `G.contracts` and replaced by a newly drawn market contract (one-for-one, same as claiming).
   3. **Maybe start one.** If at least one open contract has no countdown:
      - If no countdown started at either of the previous two market round-ends, one always starts.
      - Otherwise there is a 35% chance one starts.
      - The contract is picked uniformly at random among the open contracts with no countdown.
      - The countdown starts at 5.
4. The tableau shows, on each contract with a countdown, how many rounds it has left.

With tick-before-start, a contract that starts at 5 shows 5, 4, 3, 2, 1 across five rounds and disappears at the end of the round in which it shows 1.

Because the clock starts at the market's first round-end, that round-end and the next one each roll the 35% chance. The third market round-end is guaranteed if neither of the first two started a countdown.

### Claim only, no unfulfil (new)

1. A contract in the tableau can only be claimed. Players can no longer fulfil it directly from the tableau.
2. No fulfilled contract can be unfulfilled, private or market. A player who fulfils by mistake uses Undo, which restores the start-of-turn state.

Together these mean a market contract only leaves the tableau by being claimed or by expiring, and never comes back.

## Decisions

Confirmed:

1. **Order at the end of a round.** Tick and expire first, then maybe start a new countdown. A newly started countdown is not decremented in the same round-end.
2. **Fresh replacements.** A replacement drawn at a round-end can be picked to start expiring right away.
3. **Market opening.** The guarantee counter starts at the market's first round-end, not at the start of the game.
4. **Round-ends where nothing could start** (every open contract already counting down) count as "nothing started", so the next eligible round-end is guaranteed if two in a row were skipped.
5. **Replacement placement.** The list sorts by `creationTime`, so a replacement shows at the end of the tableau rather than in the expired contract's slot. This matches how claim replacements behave today.
6. **Notice to players.** No NavBar hint or toast. The countdown on the card is the only signal.
7. **Card wording.** "3⏱️" in the card header, centered between other content.
8. **Unfulfilling.** Removed for both private and market contracts.
9. **Move name.** Keep `toggleContractFulfilled` even though it now only fulfils. Renaming it would touch `MOVES_BY_PHASE`, the bot coverage list, bot effects and their tests for no behaviour change. A rename to `fulfillContract` can be a separate cleanup.

## Data model

All state lives in `G`, so it persists and undoes with the existing layer. No new store.

- `Contract` in `src/Contract.ts`: add an optional field

  ```ts
  /** Rounds left before this open market contract leaves the tableau; absent when not expiring. */
  roundsLeft?: number;
  ```

  Optional so saved games load without migration. Only open market contracts may have it.
- `GameState` in `src/stores/gameStore.ts`: add

  ```ts
  /**
   * Market round-ends in a row with no expiration countdown started.
   * Absent until the market opens (first round-end with any open market contract).
   */
  marketRoundsWithoutExpirationStart?: number;
  ```

  At a round-end: if the field is absent and the tableau is empty, do nothing. If it is absent and the tableau has contracts, set it to 0 and continue. A start is guaranteed when the value is at least 2. Starting a countdown resets it to 0, and a round-end with no start adds 1. A counter is simpler than storing a round number and needs no special case for the first round, where the store moves `ctx.round` from 0 to 1.
- Add constants next to `MARKET_TABLEAU_SIZE` in `src/Contract.ts`: `MARKET_EXPIRATION_ROUNDS = 5`, `MARKET_EXPIRATION_START_CHANCE = 0.35`, `MARKET_EXPIRATION_GUARANTEE_ROUNDS = 2`.
- Update `docs/GAME_DATA_SCHEMA.md` with both new fields.

## Implementation

### Expiration

1. **Pure end-of-round function.** New module `src/stores/marketExpiration.ts`:

   ```ts
   advanceMarketExpirations(G, random = Math.random): void
   ```

   It mutates `G` in place, like `growIndependentRailroads`, because the `turn.onEnd` hook works that way. It handles market opening, then ticks, expires and replaces, then rolls for a new start, as described above. Taking `random` as a parameter keeps tests deterministic.
2. **Share the replacement draw.** Export the existing replacement logic from `gameActions.ts` (`drawMarketContract` / `withReplacementMarketContract`), or move it into the new module and import it back, so expiration and claiming draw replacements the same way. Draw the replacement **before** removing the expired contract so the duplicate check keeps the new one from matching the old one.
3. **Hook it up.** In `src/stores/phaseConfig.ts`, in the `play` phase `turn.onEnd`, inside the end-of-round branch (`ctx.playOrderPos === ctx.playOrder.length - 1`), call `advanceMarketExpirations(G)` on both the `round >= 1` and `round === 0` paths. `endTurn` in `src/stores/events.ts` already picks up in-place changes to `G.contracts` and snapshots the result for Undo, so no change is needed there.
4. **Cancel on claim.** In `claimMarketContract`, drop `roundsLeft` from the claimed contract.
5. **Moves.** No new move. Expiration happens inside `endTurn`, which is already allowed in `play`. `MOVES_BY_PHASE` does not change.

### Claim only, no unfulfil

1. **Store.** In `toggleContractFulfilled` (`src/stores/gameActions.ts`), replace the current `canToggle` rule with:
   - Allowed: fulfilling an unfulfilled contract that belongs to the current player, which covers their private contract and their claimed market contract.
   - Refused with a warning: any open market contract (`playerID === null`), and any contract that is already fulfilled.

   The move now only ever sets `fulfilled` to true. Remove the branches that become unreachable:
   - the "fulfilled without being claimed" replacement (`leftTableau` and its `withReplacementMarketContract` call);
   - clearing `playerID` when a market contract is unfulfilled;
   - removing the destination from the player's `activeCities` on unfulfil.

   Update the function's doc comment to say it fulfils.
2. **Menu.** In `ContractDisplay` (`src/components/ContractDisplay.tsx`):
   - Open market contracts show **Claim Contract** and **Discard** only, with no Fulfill item.
   - Unfulfilled private and claimed market contracts show **Fulfill Contract** and **Discard**, as today.
   - Fulfilled contracts of either kind have no menu items left, so their cards are not clickable. They still render with the fulfilled stamp.
3. **Bots.** No change. Bots deliver only to their private contracts and the market contract they claimed at pickup (`deliverableContracts` in `src/bots/engine/world.ts`), and they never unfulfil.

## UI

- `ContractCard` (`src/components/ContractCard.tsx`): add an optional `roundsLeft?: number` prop. When set, render a badge in the header, for example `<div className="contract__expiry">3 rounds left</div>`, with an `aria-label` such as "Expires in 3 rounds".
- `ContractDisplay`: pass `contract.roundsLeft` through, only for open market contracts, and apply the menu changes above.
- Styles: add `.contract__expiry` (and an urgent modifier such as `.contract__expiry--last` for 1 round left) in `src/shared/styles/contracts.css`, using existing variables. No inline styles, per `docs/CSS_ARCHITECTURE.md`.
- The playtest board (`src/board/PlayerTrays.tsx`) shows only claimed contracts, so it needs no change.

## Rules doc and bots

- `docs/Game rules.md`, under **Market** contracts:
  - Add a short paragraph describing expiration in player-facing terms.
  - State that market contracts must be claimed before they can be fulfilled.
  - Under **Fulfilling a contract**, state that a fulfilled contract, private or market, can't be unfulfilled.
- That edit changes the bot rules fingerprint. Follow "Rule changes" in `docs/BOT_AGENT_GUIDE.md`:
  - Bot impact is small. Bots read open contracts from `G` each turn, so an expired contract simply disappears from their options. Check that a bot plan built around an open market contract that later expires is dropped cleanly on its next turn, not treated as an error.
  - Bots already claim before delivering, so the claim-only rule needs no bot change.
  - Optional follow-up, not in this change: let the heuristic weigh `roundsLeft` when choosing which open market contract to pursue.
  - Run `npm run bots:ack-rules` and commit the fingerprint with the change.
- Bot tournaments go through the real `endTurn`, so they exercise expiration with no extra wiring. The standalone simulator (`src/sim/runSimulation.ts`) calls `growIndependentRailroads` directly and does not model contracts, so it is unaffected.

## Tests

New `src/stores/marketExpiration.test.ts`, with a stubbed `random`:

- Before the market opens, round-ends change nothing and leave the counter absent.
- The first round-end with contracts in the tableau sets the counter to 0 and rolls the 35% chance, not a guaranteed start.
- With no start at the previous two market round-ends, a start always happens at 5, even when `random` returns 0.99.
- Otherwise a start happens when `random` is below 0.35 and not when it is at or above.
- Picks only among open contracts with no countdown. When all are already counting down, nothing starts and the counter still goes up.
- Countdowns tick by 1 each round-end. At 0 the contract is removed, a replacement is drawn, and the tableau size is unchanged.
- The replacement does not duplicate the expired contract.
- Claimed and fulfilled market contracts, and private contracts, are never ticked or expired.

Changes to `src/stores/marketContracts.test.ts`:

- Replace "fulfilling an unclaimed market contract keeps 3 open market contracts" with a test that fulfilling an open market contract is refused and changes nothing.
- Keep "fulfilling a claimed market contract does not add another".
- Add tests that calling the move again on a fulfilled contract is refused and changes nothing, once for a claimed market contract and once for a private contract. The private case checks that `activeCities` keeps the destination.
- Update the Undo test, which currently fulfils an open contract, to use two claims across turns or a claim plus an expiration.
- Claiming an expiring contract clears `roundsLeft`.
- Undo after claiming an expiring contract restores the countdown.
- Ending the last player's turn in `play` runs expiration (an integration check through `endTurn`).

Component tests:

- `ContractCard` renders the badge text for 3 and for 1, and renders nothing when `roundsLeft` is absent.
- `ContractDisplay` shows no Fulfill item on an open market contract.
- A fulfilled contract card, private or market, is not clickable and shows no menu.

## Out of scope

- Expiration for private contracts.
- Notifications beyond the card badge.
- Bot strategy that reacts to countdowns.
