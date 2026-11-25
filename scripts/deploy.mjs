#!/usr/bin/env node
// Build the production app and upload dist/ to the DreamHost site folder.
//
//   npm run deploy               production build, then upload
//   npm run deploy -- --board    playtest build (board app and bots), then upload
//   npm run deploy -- --no-build upload the existing dist/ as-is
//
// This PC has no rsync, so dist/ is streamed over ssh as a tarball, unpacked
// into a staging folder on the server, then synced into the site folder with
// the server's rsync. --delay-updates swaps the new files in together at the
// end, and --delete-after removes files the new build no longer has.
//
// Override the target with DEPLOY_HOST / DEPLOY_DIR if it ever moves.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = process.env.DEPLOY_HOST ?? 'pettiross@iad1-shared-e1-16.dreamhost.com';
const DIR = process.env.DEPLOY_DIR ?? '/home/pettiross/woodandsteel.pettiross.com';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const skipBuild = process.argv.includes('--no-build');
const board = process.argv.includes('--board');

if (skipBuild && board) fail('--board and --no-build cannot be used together.');

function fail(message) {
  console.error(`\ndeploy: ${message}`);
  process.exit(1);
}

if (!skipBuild) {
  const script = board ? 'build:board' : 'build';
  console.log(`deploy: building (npm run ${script})…`);
  const build = spawnSync(`npm run ${script}`, { cwd: root, stdio: 'inherit', shell: true });
  if (build.status !== 0) fail('build failed; nothing was uploaded.');
}

if (!existsSync(join(dist, 'index.html'))) fail(`${dist} has no index.html; run the build first.`);

// Runs on the server. The staging folder is made readable before syncing,
// because rsync -a copies the staging folder's own permissions onto DIR.
const remote = `
set -e
dest='${DIR}'
[ -d "$dest" ] || { echo "remote folder $dest does not exist" >&2; exit 1; }
stage=$(mktemp -d "$HOME/.woodandsteel-deploy.XXXXXX")
trap 'rm -rf "$stage"' EXIT
tar -xzf - -C "$stage"
[ -f "$stage/index.html" ] || { echo "upload has no index.html; site left unchanged" >&2; exit 1; }
chmod -R u=rwX,go=rX "$stage"
rsync -a --delete-after --delay-updates --exclude=/.well-known --stats "$stage"/ "$dest"/ | grep -E 'Number of (regular )?files transferred|Number of deleted files' || true
echo "deployed to $dest"
`;

console.log(`deploy: uploading dist/ to ${HOST}:${DIR}…`);

const tar = spawn('tar', ['-czf', '-', '-C', dist, '.'], { stdio: ['ignore', 'pipe', 'inherit'] });
const ssh = spawn('ssh', ['-o', 'BatchMode=yes', HOST, remote], { stdio: ['pipe', 'inherit', 'inherit'] });
tar.stdout.pipe(ssh.stdin);

const exitCode = (child) => new Promise((resolve) => child.on('close', resolve));
const [tarCode, sshCode] = await Promise.all([exitCode(tar), exitCode(ssh)]);

if (tarCode !== 0) fail(`tar exited with ${tarCode}.`);
if (sshCode !== 0) fail(`ssh exited with ${sshCode}.`);
console.log('deploy: done. https://woodandsteel.pettiross.com');
