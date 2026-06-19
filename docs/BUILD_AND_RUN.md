# Build and run

## Setup

```bash
npm install
```

Requires Node.js (see `package.json` for the version pinned in devDependencies).

## Development

```bash
npm start
```

Starts the Vite dev server with hot reload. Open the URL shown in the terminal (usually `http://localhost:5173`).

Development builds include the **simulator** at `/sim` — a batch tool for testing independent railroad growth. It is not shipped in production.

Optional environment variables (create a `.env.local` file in the project root):

- `VITE_STORAGE_TYPE` — `localStorage` (default) or `supabase`
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — required when using Supabase storage

## Production

```bash
npm run build
```

Creates an optimized static site in `dist/`. The simulator code under `src/sim/` is omitted from this build.

```bash
npm run preview
```

Serves the contents of `dist/` locally so you can smoke-test the production build before deploying.

## Checks

```bash
npm test
```

Runs the Vitest test suite.

```bash
npm run typecheck
```

Runs TypeScript type checking without emitting files.
