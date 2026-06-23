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

Preview either build locally:

```bash
npm run preview
```

Serves the contents of `dist/` so you can smoke-test before deploying.

## Development

```bash
npm start
```

Starts the Vite dev server with hot reload. Open the URL shown in the terminal (usually `http://localhost:5173`). The simulator is always available at `/sim` in development.

Optional environment variables (create a `.env.local` file in the project root):

- `VITE_STORAGE_TYPE` — `localStorage` (default) or `supabase`
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — required when using Supabase storage

## Checks

```bash
npm test
```

Runs the Vitest test suite.

```bash
npm run typecheck
```

Runs TypeScript type checking without emitting files.
