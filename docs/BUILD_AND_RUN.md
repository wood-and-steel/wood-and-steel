# Build and run

## Setup

```bash
npm install
```

Requires Node.js (see `package.json` for the version pinned in devDependencies).

## Production builds

The simulator (`src/sim/`, route `/sim`) can be included or left out at build time.

### Without simulator (default — for deployment)

```bash
npm run build
```

Creates an optimized static site in `dist/` with no simulator code.

### With simulator

```bash
npm run build:sim
```

Same optimized production build, but includes the simulator at `/sim`. Uses the Vite `sim` build mode (`vite build --mode sim`).

### With the playtest board

```bash
npm run build:board
```

Includes the shared map board at `/board` (`src/board/`, see [BOARD_AGENT_GUIDE.md](BOARD_AGENT_GUIDE.md)). Uses the Vite `board` build mode. The board also needs the `board_states` table: apply `src/board/supabase/board_states.sql` once in the Supabase dashboard's SQL editor. Without it, the board shows a banner and only the read-only game view works.

Playtest bots ([BOT_PLAN.md](BOT_PLAN.md)) ship in the same build and need the `bot_states` table: apply `src/bots/supabase/bot_states.sql` once the same way.

To check that the default build contains no board code (and the board build does):

```bash
npm run check:board-build
```

It runs both builds and leaves a plain production build in `dist/`.

Preview either build locally:

```bash
npm run preview
```

Serves the contents of `dist/` so you can smoke-test before deploying.

## Deploying

The site is hosted on DreamHost at https://woodandsteel.pettiross.com. Deploying needs SSH key access to `pettiross@iad1-shared-e1-16.dreamhost.com`.

```bash
npm run deploy               # production build (no board, no bots), then upload
npm run deploy -- --board    # playtest build (board at /board and bots), then upload
npm run deploy -- --no-build # upload the current dist/ without rebuilding
```

[`scripts/deploy.mjs`](../scripts/deploy.mjs) streams `dist/` over ssh into a staging folder on the server, then uses the server's rsync to sync it into `/home/pettiross/woodandsteel.pettiross.com`. The live site keeps serving the old files until the upload is complete. New files are switched in together at the end, and files the new build no longer has (such as old hashed bundles) are then deleted. If the build fails or the upload is incomplete, the site is left unchanged. Set `DEPLOY_HOST` or `DEPLOY_DIR` to deploy somewhere else.

Both kinds of build deploy to the same folder, so whichever ran last is what the site serves. With `--board`, anyone who visits can open `/board` and the bot seat controls.

## Development

```bash
npm start
```

Starts the Vite dev server with hot reload. Open the URL shown in the terminal (usually `http://localhost:5173`). The simulator is always available at `/sim` and the playtest board at `/board` in development (dev-only route-geometry editor: `/board/edit-paths`).

Environment variables (create a `.env.local` file in the project root):

- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — required; all games are stored in Supabase
- `VITE_SUPABASE_DASHBOARD_URL` — optional override for the lobby’s “resume project” link when cloud is unreachable (defaults to a URL derived from `VITE_SUPABASE_URL`). **Dev-oriented; change before production** — see [Before going live](CLOUD_STORAGE_TESTING.md#before-going-live-paused-project--dashboard-link) in `CLOUD_STORAGE_TESTING.md`.

## Checks

```bash
npm test
```

Runs the Vitest test suite.

```bash
npm run typecheck
```

Runs TypeScript type checking without emitting files.
