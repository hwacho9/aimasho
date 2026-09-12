// Deploy only an allowlisted web build context, never the whole workspace.
// Firebase Web configuration is public. Server keys and test env files are not.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { execFileSync, spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const web = join(root, 'web');
const project = 'aimasho';
const region = 'asia-east1';
const service = 'aimasho-web';
const env = parseEnv(readFileSync(join(web, '.env.local'), 'utf8'));
const allowed = [
  'NEXT_PUBLIC_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_APP_ID',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID', 'NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY',
];
for (const key of allowed.slice(0, 6)) {
  if (!env[key]?.trim()) throw new Error(`Missing public Firebase setting: ${key}`);
}
if (env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== project || env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
  throw new Error('Refusing deployment: use the aimasho production project with emulators disabled.');
}
const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const suffix = `release-${stamp}`;
const revision = `${service}-${suffix}`;
const image = `${region}-docker.pkg.dev/${project}/firebaseapphosting-images/${service}:${suffix}`;
const stage = mkdtempSync(join(tmpdir(), 'aimasho-web-release-'));
for (const entry of ['src', 'public', 'package.json', 'package-lock.json', 'next.config.ts',
  'tsconfig.json', 'postcss.config.mjs', 'eslint.config.mjs', 'Dockerfile']) {
  cpSync(join(web, entry), join(stage, entry), { recursive: true, filter: (path) => !path.endsWith('.DS_Store') });
}
writeFileSync(join(stage, '.env.production'), allowed.filter(k => env[k])
  .map(k => `${k}=${JSON.stringify(env[k])}`).concat('NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false').join('\n') + '\n');
// Explicit ignore file avoids gcloud inheriting a parent Git ignore file.
writeFileSync(join(stage, '.gcloudignore'), '.gcloudignore\n.git\nnode_modules\n.next\n');
console.log(`Prepared allowlisted production sources: ${stage}`);
if (process.argv.includes('--prepare')) process.exit(0);

function gcloud(args, capture = false) {
  if (capture) return execFileSync('gcloud', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
  const result = spawnSync('gcloud', args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`gcloud ${args[0]} ${args[1]} failed; no automatic rollback/deletion was attempted.`);
}
const flags = ['--project', project, '--region', region];
const previousStatus = JSON.parse(gcloud(['run', 'services', 'describe', service, ...flags,
  '--format=json(status)'], true)).status;
const previousTraffic = previousStatus.traffic.filter(t => t.percent > 0)
  .map(t => ({ revisionName: t.revisionName, percent: t.percent }));
const previousRevision = previousTraffic.length === 1 ? previousTraffic[0].revisionName : null;
console.log(`Previous production traffic: ${JSON.stringify(previousTraffic)}`);
gcloud(['builds', 'submit', stage, ...flags, '--tag', image, '--quiet']);
gcloud(['run', 'deploy', service, ...flags, '--image', image,
  '--revision-suffix', suffix, '--no-traffic', '--tag', suffix, '--quiet']);
const status = JSON.parse(gcloud(['run', 'services', 'describe', service, ...flags,
  '--format=json(status)'], true)).status;
const verificationUrl = status.traffic.find(t => t.tag === suffix)?.url;
if (!verificationUrl) throw new Error('No verification URL; production traffic was not changed.');
for (const path of ['/', '/login', '/profile', '/journey']) {
  const response = await fetch(verificationUrl + path, { signal: AbortSignal.timeout(60000) });
  const html = await response.text();
  if (!response.ok || !html.includes('/_next/static/')) throw new Error(`Smoke test failed: ${path} HTTP ${response.status}. Production traffic was not changed.`);
  console.log(`Staged revision: ${path} HTTP ${response.status}`);
}
gcloud(['run', 'services', 'update-traffic', service, ...flags, '--to-revisions', `${revision}=100`, '--quiet']);
const reportDir = resolve(root, '.firebase');
mkdirSync(reportDir, { recursive: true });
writeFileSync(join(reportDir, 'last-web-release.json'), JSON.stringify({
  project, region, service, revision, previousRevision, previousTraffic, image, verificationUrl,
  deployedAt: new Date().toISOString(),
}, null, 2));
console.log(`Web deployed. Next deploy Hosting: npm run deploy:hosting\nURL: https://aimasho.web.app/`);
