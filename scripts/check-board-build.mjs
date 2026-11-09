/**
 * Verify the board app's build gating (docs/archived/BOARD_APP_PLAN.md, M6) by scanning dist/.
 *
 *   node scripts/check-board-build.mjs            # after `npm run build`: dist/ must contain no board code
 *   node scripts/check-board-build.mjs --expect   # after `npm run build:board`: dist/ must contain it
 *
 * `npm run check:board-build` runs both builds and both checks, then leaves a plain production build in dist/.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Strings that only appear in playtest code: board (table name, board-only CSS classes, background
 * asset) and bots (docs/BOT_PLAN.md; bot-only CSS class).
 */
const MARKERS = ['board_states', 'boardTopBar', 'routePopover', 'map-board', 'botSeats'];
const DIST = 'dist';
const expectBoard = process.argv.includes('--expect');

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

let all;
try {
  all = files(DIST);
} catch {
  console.error(`No ${DIST}/ directory. Run a build first.`);
  process.exit(2);
}

const hits = [];
for (const file of all) {
  if (MARKERS.some((m) => file.includes(m))) hits.push(`${file} (file name)`);
  if (!/\.(js|css|html)$/.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  for (const marker of MARKERS) if (text.includes(marker)) hits.push(`${file}: "${marker}"`);
}

if (expectBoard && hits.length === 0) {
  console.error('Expected board code in dist/ (build:board), found none.');
  process.exit(1);
}
if (!expectBoard && hits.length > 0) {
  console.error('Board code leaked into the production build:\n  ' + hits.join('\n  '));
  process.exit(1);
}
console.log(expectBoard ? `OK: board code present (${hits.length} matches).` : 'OK: no board code in dist/.');
