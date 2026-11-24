# Player app redesign plan

The player app takes over everything on the tabletop player board (engine types on the light and dark tokens, cargo, upgrades) and starts tracking cash and debt. Design sketches: [player-app-redesign.html](player-app-redesign.html) (published copy: <https://claude.ai/artifact/9vz33EYYa2mos4WSsckoUf>).

The game's existing rules don't change. Some existing moves gain money effects (fulfilling a contract pays; acquiring a railroad costs), and new moves cover borrowing, repaying, buying and paying for track.

## Decisions

From the design review (2026-11-23):

- **Nothing gets recorded twice.** Players never report track, engine positions or Railyard cities. Recording cargo is optional; a contract can be fulfilled without it.
- **Cash never goes negative.** A purchase the player can't afford is refused with an explanation. A Loans button on every screen is the way out; nothing combines borrowing with buying.
- **A delivery the player can't pay for is blocked.** When debt service is more than the payout plus cash, the receipt says to borrow first. Bankruptcy stays unimplemented; `Game rules.md` will say so.
- **Board data is public.** Every player's cash and debt shows on Home; tapping a player shows their engines, cargo and upgrades. Private contracts stay private.
- **The app doesn't count actions.**
- **No track cost calculator.** "Pay for track" takes a typed amount in thousands, using the phone's own numeric keyboard.
- **Bonus ties come at game end.** Commodities Exchange monopoly ties (like Regional Office and Challenger ties) are awarded at the end of the game. Only contract ties count toward the 30 that end it. End-of-game screens are out of scope.
- **G is the only home for this data.** Cash, debt, engine types, cargo and upgrades live in `G`. The board app reads them from `G`; bots change them only through moves. `board_states` keeps track, engine positions and Railyard cities; `bot_states` keeps plans and narration.
- **Old games get defaults plus a fix-up.** Games saved before this work load with $10K cash, $0 debt, a John Bull and no upgrades. The playtest edit dialog can correct any player's cash, debt, engines, cargo and upgrades.
- **Ship in usable stages** (below).

## Data model

All new per-player fields go on `PlayerProps` in `src/stores/gameStore.ts`, so they travel with `G.players` through serialization and sync.

| Field | Type | Start value | Notes |
|---|---|---|---|
| `cash` | `number` | `10000` | Dollars; never negative |
| `debt` | `number` | `0` | Multiples of $5,000 |
| `engines` | `[EngineTypeId \| null, EngineTypeId \| null]` | `['john-bull', null]` | Light token, dark token |
| `cargo` | `[string \| null, string \| null]` | `[null, null]` | Optional; `null` means "not recorded" |
| `upgrades` | `UpgradeId[]` | `[]` | Service Yard, Upgraded Stations, Roundhouse, Employment Office, Timetable, Railyard, Commodities Exchange. The Hub and Regional Office stay in the existing `hubCity` and `regionalOffice` fields |
| `exchangeCommodity` | `string \| null` | `null` | Set when the Commodities Exchange is bought |
| `centralDebtServicePaid` | `boolean` | `false` | A Central delivery has been made |
| `westernDeliveryMade` | `boolean` | `false` | Debt service is due on every delivery from now on |

New game-level fields on `GameState`:

- **`turnLedger`:** `{ playerID, entries: { label, amount }[] }`, the money changes in the current turn. Cleared at `endTurn`. Undo restores it with the rest of `G`.
- **`roundReport`:** `{ round, routesAdded: Record<railroadName, routeKey[]>, marketExpired, marketAdded }`, where the two market lists hold `{ id, commodity, destinationKey }` copies (expired contracts leave `G.contracts`). Written at end of round. It replaces `lastRoundRoutesAdded`.

Values derived from `G`, not stored:
- Whether anyone has delivered to the West (independent railroads cost $4K per route instead of $3K).
- Whether the Service Yard is unlocked (anyone owns a Consolidation or better).
- Which engines a player can buy.
- Each contract's net value to a player.

Persistence: `stateSerialization.ts` already deep-clones `players`, so the new player fields round-trip. Add `turnLedger` and `roundReport` to `serializeState`/`deserializeState`. A new `normalizePlayer` step in deserialization fills missing fields with the start values; this is the migration for old games.

## Shared rules module

The main app can't import from `src/bots/` or `src/board/` (`botIsolation.test.ts`; both are flag-gated). The rules data and pure functions those folders already hold move to a new store-free folder, `src/rules/`, which all three import:

- From `src/board/playerBoardData.ts`: `ENGINE_TYPES`, `UPGRADES`, `COMMODITY_GROUPS` and their id types.
- From `src/bots/engine/rulesData.ts`: prices, borrow and repay limits, debt service constants, regions, independent railroad prices, `tradeInValue`, monopoly sizes.
- From `src/bots/engine/finance.ts`: `serviceOn`, `debtServiceForDelivery`, `deliveryPayment`, `repayOptions`. Rewritten to take plain `{ cash, debt, … }` values instead of `BotRecord`.
- From `src/bots/engine/costs.ts`: the parts that need no track, such as engine purchase options (next level; two levels with a Hub for $5K more; trade-in), the Service Yard gate, and monopolizable commodities.
- From `src/bots/engine/network.ts`: `cityRegion`.
- From `src/board/geometry/cityPoints.ts`: city coordinates, for the round report's mini maps. Deferred to Stage 4, which is the first to need them; the file is generated by `scripts/trace-routes.py` and has many board importers.

The bots and the board re-export or import from `src/rules/`, so their tests keep passing unchanged. Add `src/rules/` to the isolation test's "pure" list.

## Moves

All moves go in `src/stores/gameActions.ts` and are listed under `play` in `MOVES_BY_PHASE` (`moveValidation.ts`) and in `moves.ts`. Each checks it's the current player's turn, refuses anything that would make cash negative, appends to `turnLedger`, and saves as existing moves do.

| Move | What it does |
|---|---|
| `borrow(amount)` | Adds $5K multiples to cash and debt |
| `repay(amount)` | $5K or $10K; only if debt stays at least $15K and cash covers it |
| `payForTrack(amount)` | Subtracts a $1K multiple, at most current cash |
| `buyEngine(slot, engineType, tradeIn)` | Enforces one level above the best owned (two with a Hub, +$5K). Applies the trade-in value or replaces the engine on that token. Cargo stays with the token |
| `buyUpgrade(upgrade, choice?)` | Charges the price and enforces gates (one each; Service Yard unlock; Hub city not taken; region not taken; monopoly commodity not taken). `choice` is the Hub city, the Regional Office region, or the Exchange commodity. The Hub and Regional Office reuse the checks in `claimHubCity` and `claimRegionalOffice` |
| `setCargo(slot, commodity \| null)` | Records or clears cargo. Free; any time in the player's own turn |
| `setPlayerBoard(playerID, partial)` | Playtest fix-up for any player, from the edit dialog |

Existing moves that change:

- **`toggleContractFulfilled(contractID, engineSlot?)`** pays the contract: value, ×1⅓ for a Mountain or Challenger on `engineSlot`, +$3K for Upgraded Stations, minus debt service. It updates the two debt-service flags and clears that engine's cargo if it matches the commodity. It refuses when the net would push cash below zero.
- **`acquireIndependentRailroad(name)`** charges $3K or $4K per route and refuses if the player can't afford it.
- **`claimMarketContract(contractID, cargoSlot?)`** optionally records the commodity on that engine.
- **`endTurn`** clears `turnLedger`. At round end the phase hook writes `roundReport`.

## Stages

Each stage ships on its own and leaves the app fully playable.

### Stage 1: groundwork (no visible change) — done

1. Create `src/rules/` and move the rules data and pure functions into it. Point the bots and the board at it. No behavior change; all tests pass.
2. Add the new `PlayerProps` and `GameState` fields, start values at game creation (`newPlayerProps` in `src/stores/playerDefaults.ts`), `normalizePlayerProps` in deserialization, and serialization of `turnLedger` and `roundReport`.
3. Unit tests for the rules functions under their new names, and for loading an old saved game.

### Stage 2: money, engines and upgrades — done

The core release. Everything the player board tracked moves into the app, inside today's layout.

1. **Moves:** the new moves and the money effects on existing moves, with tests for every refusal and boundary: the repay floor, the Hub engine skip, trade-in rounding, multiplier rounding, first-Central versus Western service, blocked delivery, and the indie price after a Western delivery.
2. **Header:** a persistent strip under the nav bar with cash, debt, ties and a Loans button.
3. **Loans screen:** Borrow and Repay, with debt service before and after and the East/Central/West progress.
4. **Actions sheet:**
   - Buy an engine
   - Buy an upgrade: the upgrades list, Hub city picker, Regional Office region picker, Exchange commodity picker
   - Acquire a railroad: uses the Railroads list, with its price shown
   - Pay for track
   - New private contract: the existing flow
5. **Delivery receipt** replaces the bare fulfill action. It shows only the lines that apply, asks which engine delivered only when the engines would pay differently, and explains a blocked delivery.
6. **Engines on the Contracts tab:** two rows with token color, engine name, range (+1 with a Service Yard) and an optional cargo picker.
7. **Bots** move to `G`:
   - `buildWorld` reads cash, debt, engines, cargo and upgrades from `G`.
   - Actions call the new moves (`callMove`, `isMoveDone`, `GameMove`).
   - `bot_states` drops cash, debt and the debt-service flags; old rows are read without them.
   - Label the new moves in `coverage.ts`.
   - Update `src/sim` and the tournament runner to the same model.
8. **Board app** trays read engine types, cargo and upgrades from `G` and stop writing `setEngineType`, `setCargo` and `setUpgrade`. Old `board_states` rows keep loading with those fields ignored. Check `boardDeliveries.ts`, which reacts to deliveries.
9. **Playtest edit dialog:** fields for each player's cash, debt, engines, cargo and upgrades (`setPlayerBoard`).
10. **Docs:** `Game rules.md` (app state lists, money, blocked-delivery note), `AGENTS.md` state map, `BOT_AGENT_GUIDE.md`, `BOARD_AGENT_GUIDE.md`.

### Stage 3: the new Home — done

1. **Your railroad screen:**
   - The players' money row: tap it for that player's details sheet.
   - Engines.
   - Your contracts and the market as rows with net values and expiry badges, the market above the fold on a small phone.
   - Upgrades below the fold.
   - Actions and End turn side by side.
2. **Claim sheet** with the optional cargo choice.
3. **Money log** for the current turn in the Actions sheet, from `turnLedger`.
4. **Tabs:** Home, Commodities, Railroads. Rare items (lobby, game code, playtest tools, the round report setting) move to the menu.

### Stage 4: round report

1. Write `roundReport` in the end-of-round hook in `phaseConfig.ts`, alongside `growIndependentRailroads` and `advanceMarketExpirations`.
2. The report screen shows:
   - A mini map for each railroad that grew: its own routes and cities only, cropped to fit, drawn from city coordinates. First move `cityPoints.ts` out of `src/board/` (and point `scripts/trace-routes.py` at the new path), since the main app can't import the board.
   - Market expirations and replacements.
   - Who starts the next round.
3. It opens automatically for each player, unless that player switched it off. The setting is per device in `localStorage`, with the switch on the report and in the menu. The round label opens the latest report and shows a dot when a new one is unseen.
4. Remove the "Added N routes" callout and `lastRoundRoutesAdded`.

## Testing

- Unit tests (Vitest) for each move's success and refusal paths and for the `src/rules/` functions.
- A serialization round-trip test for an old game and a new one.
- The bot tournament runner as a regression check: games still finish, and cash never goes negative.
- Each stage: play a short game in the browser across two devices (or two tabs), checking sync, Undo and the board app.

## Not in scope

- Bankruptcy (deliveries that would cause it are blocked).
- End-of-game scoring screens, including monopoly, Regional Office and Challenger ties.
- Track cost calculation, and anything that needs the player's network or engine positions.

## Changes from the sketches

- **Regional Office asks for a region.** The existing `claimRegionalOffice` move records one, so its purchase sheet needs a region picker like the Hub's city picker.

## Decisions made while building Stage 3

- **The toolbar lists each other player's railroad ties, not their money.** Money, engines and the rest are on the player's card, opened by pressing them.
- **Undo, Actions and End Turn stay in the sticky toolbar** rather than a bar at the foot of Home: on phones the tab bar is at the bottom, and the toolbar is reachable from every tab.
- **+M moved to the menu** as "Fill Market Contracts", shown on the player's turn.
- **Contract rows replace the contract cards on Home.** The cards remain for the private contract offers.

## Decisions made while building Stage 2

- **Claiming a market contract needs a Mogul or better**, now that the app knows engines, and a player holds one claimed contract at a time.
- **The first Mogul or better bought opens the market**: `buyEngine` fills the tableau, as the bots already did. The +M button stays as a playtest tool.
- **The board's trays are read-only** for money, engines, cargo, and upgrades, since they live in `G`; the board's engine-type and cargo pickers and its upgrade checkboxes were removed, along with the board clearing cargo on delivery (the fulfil move clears it in `G`).
- **The offer dialog no longer has "Bought a Hub" or "Bought a Regional Office" cards**, which claimed them for free; both are bought, and paid for, from Actions. +P is replaced by Actions → New private contract.
- **Delivering a private contract opens the offers** right after the receipt.
- **Without the delivering engine, the bonus applies only if every engine the player owns earns it.** The receipt asks which engine delivered whenever that would change the payout.
- **Hub and Regional Office playtest moves (`claimHubCity`, `claimRegionalOffice`) stay** but nothing in the UI uses them for free claims any more.
