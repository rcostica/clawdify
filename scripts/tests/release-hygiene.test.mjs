import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const checker = fileURLToPath(new URL('../check-release.mjs', import.meta.url));
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-hygiene-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  git('init', '-q'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.com');
  const commit = (file, content) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
    git('add', '-A'); git('commit', '-qm', 'fixture'); return git('rev-parse', 'HEAD');
  };
  const run = (...args) => spawnSync(process.execPath, [checker, ...args], { cwd: root, encoding: 'utf8' });
  return { root, git, commit, run };
}
test('generic app routes and example configuration pass', t => {
  const f = fixture(t);
  f.commit('src/app/api/projects/route.ts', 'export const example = "https://example.com";');
  f.commit('.env.example', 'OPENCLAW_GATEWAY_TOKEN=\n');
  assert.equal(f.run('HEAD').status, 0);
});
test('runtime databases and local env files are blocked', t => {
  const f = fixture(t);
  f.commit('.env.local', 'SAMPLE=value'); f.commit('runtime.db', Buffer.alloc(0));
  const r = f.run('HEAD'); assert.equal(r.status, 1);
  assert.match(r.stderr, /runtime\/private file path/);
});
test('credential detection does not print the matched value', t => {
  const f = fixture(t);
  const credential = 'gh' + 'p_' + 'A'.repeat(36);
  f.commit('config.ts', credential);
  const r = f.run('HEAD'); assert.equal(r.status, 1);
  assert.match(r.stderr, /credential/); assert.ok(!r.stderr.includes(credential));
});
test('machine paths and private hostnames are blocked', t => {
  const f = fixture(t);
  f.commit('config.ts', '/home/' + 'test-owner/work\n' + 'host.tail' + '123456.ts.net');
  const r = f.run('HEAD'); assert.equal(r.status, 1);
  assert.match(r.stderr, /machine home path/); assert.match(r.stderr, /private network hostname/);
});
test('private literal blocklist checks binary files without revealing values', t => {
  const f = fixture(t);
  const marker = 'private-fixture-' + Date.now();
  const list = path.join(f.root, '.git', 'private-patterns.json');
  fs.writeFileSync(list, JSON.stringify([marker]));
  f.git('config', 'clawdify.privatePatternsFile', list);
  f.commit('image.bin', Buffer.from('\0' + marker));
  const r = f.run('HEAD'); assert.equal(r.status, 1);
  assert.match(r.stderr, /private instance marker/); assert.ok(!r.stderr.includes(marker));
});
test('a cleaned tip cannot hide a credential in an outgoing earlier commit', t => {
  const f = fixture(t);
  const base = f.commit('config.ts', 'generic');
  f.commit('config.ts', 'gh' + 'p_' + 'B'.repeat(36));
  const head = f.commit('config.ts', 'generic again');
  assert.equal(f.run(head).status, 0);
  assert.equal(f.run('--range', base, head).status, 1);
  const r = spawnSync(process.execPath, [checker, '--pre-push'], {
    cwd: f.root, encoding: 'utf8', input: `refs/heads/main ${head} refs/heads/main ${base}\n`,
  });
  assert.equal(r.status, 1);
});

test('private commit metadata is blocked without printing the value', t => {
  const f = fixture(t);
  f.commit('app.ts', 'generic');
  const marker = 'private-commit-fixture-' + Date.now();
  const list = path.join(f.root, '.git', 'private-patterns.json');
  fs.writeFileSync(list, JSON.stringify([marker]));
  f.git('config', 'clawdify.privatePatternsFile', list);
  f.git('commit', '--allow-empty', '-qm', marker);
  const r = f.run('--history', 'HEAD');
  assert.equal(r.status, 1); assert.match(r.stderr, /commit metadata/);
  assert.ok(!r.stderr.includes(marker));
});
test('private filenames are blocked even when their content is generic', t => {
  const f = fixture(t);
  const marker = 'private-filename-fixture-' + Date.now();
  const list = path.join(f.root, '.git', 'private-patterns.json');
  fs.writeFileSync(list, JSON.stringify([marker]));
  f.git('config', 'clawdify.privatePatternsFile', list);
  f.commit(marker + '.txt', 'generic');
  assert.equal(f.run('HEAD').status, 1);
});
