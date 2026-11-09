# Board App Phase 2 Plan: Player Tracking

Adds per-player tracking to the `/board` trays: which engine type each engine token is, what each engine is carrying, and which of six upgrades the player has bought. Phase 1 is described in [BOARD_APP_PLAN.md](BOARD_APP_PLAN.md); current conventions are in [BOARD_AGENT_GUIDE.md](../BOARD_AGENT_GUIDE.md).

**Status (2026-11-08):** implemented; milestone notes are below. This plan is kept for its decisions and reasoning, and the agent guide is the current reference.

## Decisions (from Q&A, 2026-11-08)

| Topic | Decision |
|---|---|
| Tray location | Move the trays from the bottom strip to a **full-height right column**, one card per player. The column scrolls when it can't fit. |
| Service Yard | Distance display **includes the +1** for a 2-8-0 Consolidation or better when Service Yard is checked, and shows the breakdown. Display only. |
| Map tokens | **Unchanged.** Engine type and cargo appear only in the tray. |
| Commodities Exchange | **Bought / not bought**, like the other five upgrades. It does not record a commodity. |
| Upgrades tracked | Service Yard, Upgraded Stations, Roundhouse, Employment Office, Timetable, Commodities Exchange. Hub, Railyard, and Regional Office purchases are not tracked. |
| Engine display | Not card-style. A text row with the type name, distance, and any effects from the rules, next to the token it belongs to. |
| Cargo display | The commodity's existing icon plus its name, from `commodityIcons` in `src/shared/assets/icons.js`. |

All Phase 1 invariants still hold: read-only toward `G`/`ctx`, all code in `src/board/`, no production build, every edit a re-appliable `BoardOp`, and silent rules.

## Why a right column

The map is 6660×4173 (1.6:1), which is narrower in proportion than a 16:9 screen. At 1920×1080 a fit-to-width map already overflows vertically, while a column of about 270px still leaves room for a map as tall as the window. `useZoomPan` measures the viewport with a `ResizeObserver`, so fit-to-width adapts without changes.

At 1080p each of five cards gets about 205px of height. A typical card fits. The worst case (two engines with long effects, such as a Challenger) is about 270px, so the column scrolls in that case. At the 1000px minimum width the map keeps about 730px.

## Data: `src/board/playerBoardData.ts` (new)

The repo has no engine or upgrade data outside the rules doc, and only the board needs it, so it stays in `src/board/`.

**Engine types**, in upgrade order. `id` is what gets stored.

| `id` | Name | Distance | Effects |
|---|---|---|---|
| `john-bull` | 2-4-0 John Bull | 1 | Must be traded in for the American |
| `american` | 4-4-0 American | 2 | |
| `mogul` | 2-6-0 Mogul | 3 | After buying, player can fulfill market contracts |
| `consolidation` | 2-8-0 Consolidation | 3 | After buying, Service Yard is available to all players |
| `camelback` | 4-6-0 Camelback | 4 | |
| `prairie` | 2-6-2 Prairie | 5 | |
| `pacific` | 4-6-2 Pacific | 7 | |
| `mikado` | 2-8-2 Mikado | 8 | |
| `mountain` | 4-8-2 Mountain | 9 | Earn 1 1/3x value when fulfilling a contract |
| `challenger` | 4-6-6-4 Challenger | 11 | Gain 2 railroad ties at end of game and earn 1 1/3x value when fulfilling a contract |

**Upgrades**, in player-board order, with `id`, name, price, and effect from the rules (used in the hover title):

`service-yard` ($10,000), `upgraded-stations` ($10,000), `roundhouse` ($10,000), `employment-office` ($10,000), `timetable` ($15,000), `commodities-exchange` ($20,000).

**Commodity groups**, for the picker. These match the player board and don't exist in code yet:

- Metals: aluminum, copper, lead, nickel, precious metals
- Mined goods: bauxite, coal, iron ore, oil
- Livestock: cattle, fish, pork, sheep
- Crops: cotton, fruit, grain, rice, tobacco, wood
- Finished goods: imports, machinery, steel, textiles, tourists, wine

**Helpers:**

- `engineDistance(typeId, hasServiceYard)` returns `{ base, bonus, total }`. The bonus is 1 for Consolidation and later.
- `DEFAULT_ENGINE_TYPES = ['john-bull', null]`.

## Board state

Three additive fields in `BoardState`, matching the existing per-player `Record` style. Slot `0` is the light token and slot `1` the dark token, as in `engines`.

```ts
/** playerID -> [lightTokenType, darkTokenType]; null = no engine. Absent = DEFAULT_ENGINE_TYPES. */
engineTypes: Record<string, [EngineTypeId | null, EngineTypeId | null]>;
/** playerID -> [lightTokenCargo, darkTokenCargo]; commodity key or null = empty */
cargo: Record<string, [string | null, string | null]>;
/** playerID -> upgrades bought */
upgrades: Record<string, UpgradeId[]>;
```

New ops in `boardOps.ts`. Each sets an **absolute value** and touches one slot or one upgrade. A toggle would flip back when re-applied after a save conflict, and replacing a whole pair would overwrite another screen's edit to the other slot.

```ts
| { type: 'setEngineType'; playerID: string; slot: EngineSlot; engineType: EngineTypeId | null }
| { type: 'setCargo'; playerID: string; slot: EngineSlot; commodity: string | null }
| { type: 'setUpgrade'; playerID: string; upgrade: UpgradeId; owned: boolean }
```

- `setEngineType` to `null` also clears that slot's cargo, because an empty slot has no cargo control. Changing to another type keeps the cargo.
- **Starting engine:** applied on read, not at seeding. `playerEngineTypes(board, playerID)` and `setEngineType` both fall back to `DEFAULT_ENGINE_TYPES` when a player has no entry. Boards already in progress therefore show a John Bull without a migration, and `boardSeed.ts` doesn't change.
- **`normalizeBoardState`:** tolerates missing fields, drops unknown engine IDs, commodities, and upgrades, and dedupes upgrades.
- **Bump `BOARD_STATE_VERSION` to 2.** Today's normalizer rebuilds state field by field, so a stale open tab would silently strip the new fields on its next save. With the bump, that tab refuses the row and tells the user to reload. Version 1 rows still load. The `version: 1` literal type changes to match.
- No SQL change: `state` is `jsonb`.

## UI

### Layout

- `BoardApp.tsx`: wrap the viewport and trays in a new `.boardMain` flex row (viewport `flex: 1; min-width: 0`).
- Move the trays out of `BoardChrome.tsx` into a new `PlayerTrays.tsx`, since they grow well beyond chrome. `<footer>` becomes `<aside>`, and `data-token-drop="tray"` stays on it, so dropping anywhere on the column returns a token.
- `board.css`: `.boardTrays` becomes a fixed-width (about 17rem), vertically scrolling column.

### Player card

```
● Ann                                   ◉ (Railyard, if unplaced)
▭ 2-6-0 Mogul ▾                          [🐖 Pork ▾]
  Travels 3 segments · on Chicago
  After buying, player can fulfill market contracts
▬ No engine ▾
☐ Service Yard          ☑ Upgraded Stations
☐ Roundhouse            ☐ Employment Office
☐ Timetable             ☐ Commodities Exchange
```

- **Token:** always visible at the start of its engine row, **at full color even when placed on the map**, because it's the key for which token is which type. When the token is in the tray it's draggable, as today. When placed, the row says `on <city>` and the token isn't draggable from the tray (drag it on the map). The accessible name includes "Light" or "Dark".
- **Engine type button:** shows the name or "No engine" and opens the engine picker.
- **Stats:** `Travels N segment(s)`. With the Service Yard bonus: `Travels 4 segments (3 +1 Service Yard)`. Effects text sits below and wraps, and is omitted if the engine has none.
- **Cargo button:** the icon and name, or "No commodity". Hidden when the slot has no engine.
- **Upgrades:** six labeled checkboxes in two columns, echoing the physical board's squares. Hover title shows price and effect.
- **Railyard:** the existing draggable token moves to the card header and still appears only while unplaced.
- Silent rules: any type can be set on either token, including duplicates and skipped levels. A token with no engine type can still be dragged. Any screen can edit any player.

### Pickers: `TrayPicker.tsx` (new)

One popover with two content modes. Picking applies immediately and closes it.

- **Engine:** "No engine" first, then the ten types in order with distance. Current choice is marked.
- **Commodity:** "No commodity" first, then the five groups, each commodity as icon plus name. Current choice is marked.

Dismissal and placement already exist in `RoutePopover`. Extract them into `useBoardPopover.ts` and use it from both, rather than copying. Its existing flip-at-window-edge logic makes the picker open to the left of the column. Anchor to the trigger button's rect so keyboard activation works. Picker open/closed state is local to `PlayerTrays`. It also closes on column scroll, and starting a token drag closes it.

Controls are disabled until board state is ready, by passing a nullable `onBoardOp` prop alongside the existing nullable `onTokenPointerDown`.

## Milestones

1. **M1 Data and ops:** `playerBoardData.ts`, new `BoardState` fields, ops, `normalizeBoardState`, version bump. Unit tests only; no UI change.
   - *Status (2026-11-08):* done as planned.
2. **M2 Layout:** the `.boardMain` row, `PlayerTrays.tsx`, and column CSS, with the current tray contents. Confirm that fit-to-width, zoom, and token drag to and from the column still work.
   - *Status (2026-11-08):* done as planned.
3. **M3 Engine rows:** always-visible tokens, `on <city>` state, name/distance/effects, `useBoardPopover`, `TrayPicker` engine mode, and `setEngineType` wiring.
   - *Status (2026-11-08):* done as planned.
4. **M4 Cargo:** `TrayPicker` commodity mode, icon button, and `setCargo` wiring.
   - *Status (2026-11-08):* done as planned. A long engine name with long cargo (Challenger carrying Precious metals) wraps the cargo button onto its own line.
5. **M5 Upgrades:** checkboxes, hover details, `setUpgrade` wiring, and the Service Yard distance display.
   - *Status (2026-11-08):* done. The column went from 17rem to 18rem, because when the column's scrollbar shows, 17rem wraps "Commodities Exchange" and the Service Yard distance text.
6. **M6 Hardening and docs:** full checks below; update `BOARD_AGENT_GUIDE.md` (file table, data shape, right column); archive this plan with status notes, as in Phase 1.
   - *Status (2026-11-08):* unit tests (225), typecheck, and `check:board-build` pass. In the browser, RKLMK (four players, with a temporary copy of a card added in the page as a fifth) fits without scrolling at 1920×1080, including with one worst-case card (301px). At 1000×700 the column scrolls and the map keeps 695px. All browser checks faked `board_states` saves in the page to keep test data out of the real Supabase project. For that reason the **two-browser sync check was not run** against Supabase; two-screen edits are covered by `boardSync.test.ts` with the in-memory adapter. No game with five real players existed to check.

## Tests and verification

| File | Covers |
|---|---|
| `playerBoardData.test.ts` (new) | Commodity groups cover exactly the keys of `commodities`, each with a `commodityIcons` entry; ten engines, six upgrades; `engineDistance` below, at, and above Consolidation |
| `boardOps.test.ts` | Each new op; re-applying is stable; clearing an engine clears only that slot's cargo; missing, malformed, and unknown data in `normalizeBoardState`; version 1 rows load and newer versions throw |
| `boardSync.test.ts` | Two screens editing different slots and different upgrades of one player both survive a conflict |
| `BoardApp.test.tsx` | Old row shows John Bull on the light token; choosing an engine; choosing cargo renders the commodity `<img>`; "No commodity" clears it; upgrade checkbox saves; Service Yard changes the distance text; placed token stays visible and shows its city; token drag still drops back on the column; controls disabled before ready |

Then run the unit tests, typecheck, and `npm run check:board-build`, and check `/board?game=CODE` in the browser with five players at 1920×1080 and at 1000px wide, including a two-browser sync check.

**Rollout:** reload any open board screens after deploying.

## Not in this phase

- Money, debt, railroad ties, or tracking Hub, Railyard, and Regional Office purchases
- Rule enforcement or a purchase flow, including trade-ins and engine-level limits
- Any change to map tokens
- Writing anything to `G`/`ctx`

## Open questions (non-blocking; defaults in brackets)

- **Market contracts on later engines:** the rules let "a Mogul engine or better" claim Market Contracts, but the stats table notes it only on the Mogul. Repeat the effect on later engines? [No; follow the table.]
- **Engine prices in the tray or picker:** not requested. [Omit.]
- **Upgrade hover details:** price and rules text as a native title. [Include; it's the only place the price appears.]
- **Light or dark starting token:** the physical rules let a player start with either. [Light gets the John Bull; change it with the picker.]
