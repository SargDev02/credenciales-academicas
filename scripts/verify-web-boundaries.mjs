import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';

// Read-only local scan; values from ignored env files stay in memory and are
// never printed, hashed, copied into reports or passed to browser processes.
const roots = ['apps/raes-web', 'apps/credenly-web', 'services/raes-api', 'services/credenly-api', 'services/connector-poli', 'services/connector-udea'];
const secrets = new Set();
for (const folder of ['.', ...roots]) {
  const file = join(folder, '.env.local');
  if (!existsSync(file)) continue;
  for (const [name, value] of Object.entries(parseEnv(readFileSync(file, 'utf8')))) {
    if (/(SERVICE_ROLE|CLIENT_SECRET|ACCESS_TOKEN|DB_PASSWORD|DATABASE_URL)/.test(name) && value.length >= 20) secrets.add(value);
  }
}
assert.ok(secrets.size > 0, 'Load ignored backend env files before checking real secret values');
const files = [...new Set(execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean))];
const indexed = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
assert.ok(!indexed.some((file) => /(^|\/)\.env($|\.(?!example$))|\.traineddata(?:\.gz)?$|\.credentials\.local$/.test(file)), 'Private env/generated data present in Git');
function scan(file) {
  const text = readFileSync(file).toString();
  assert.ok(![...secrets].some((value) => text.includes(value)), 'Backend secret detected; do not print contents');
  assert.ok(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text), 'Private key detected; do not print contents');
}
for (const file of files) if (existsSync(file)) scan(file);
function walk(folder) { return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(join(folder, entry.name)) : [join(folder, entry.name)]); }
let bundles = 0;
for (const app of roots.slice(0, 2)) {
  const folder = join(app, '.next/static');
  assert.ok(existsSync(folder), 'Build both web applications before checking bundles');
  for (const file of walk(folder).filter((file) => /\.(js|json|map)$/.test(file))) { scan(file); bundles++; }
  for (const file of walk(join(app, 'src')).filter((file) => /\.[jt]sx?$/.test(file))) {
    const text = readFileSync(file, 'utf8');
    assert.ok(!/(?:localStorage|sessionStorage)\.setItem\s*\(/.test(text), 'Manual browser persistence detected');
    assert.ok(!/NEXT_PUBLIC_\w*(?:SECRET|SERVICE_ROLE)/.test(text), 'Private public env variable detected');
  }
}
console.log(JSON.stringify({ versionableFiles: files.length, browserBundles: bundles, backendSecretsFound: 0, privateKeysFound: 0, privateEnvOrTraineddataIndexed: 0, manualBrowserSessionPersistence: 0 }));
