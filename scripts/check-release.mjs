#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const git = (...args) => execFileSync('git', args, { maxBuffer: 64 * 1024 * 1024 });
const text = (...args) => git(...args).toString().trim();
const args = process.argv.slice(2);
const refs = new Set();
const zero = /^0+$/;
function outgoing(local, remote) {
  refs.add(local);
  const commits = remote && !zero.test(remote)
    ? text('rev-list', `${remote}..${local}`)
    : text('rev-list', local, '--not', '--remotes');
  for (const commit of commits.split('\n').filter(Boolean)) refs.add(commit);
}
if (args[0] === '--pre-push') {
  for (const line of fs.readFileSync(0, 'utf8').trim().split('\n').filter(Boolean)) {
    const [, local, , remote] = line.split(/\s+/);
    if (!zero.test(local)) outgoing(local, remote);
  }
} else if (args[0] === '--history') {
  for (const commit of text('rev-list', args[1] || 'HEAD').split('\n').filter(Boolean)) refs.add(commit);
} else if (args[0] === '--range') {
  if (!args[1] || !args[2]) throw new Error('Usage: --range <base> <head>');
  outgoing(args[2], args[1]);
} else refs.add(args[0] || 'HEAD');

let privatePatterns = [];
let privateFile = '';
try { privateFile = text('config', '--get', 'clawdify.privatePatternsFile'); } catch {}
if (privateFile) {
  privatePatterns = JSON.parse(fs.readFileSync(privateFile, 'utf8'));
  if (!Array.isArray(privatePatterns) || privatePatterns.some(s => typeof s !== 'string' || !s)) {
    throw new Error('Invalid private blocklist; expected nonempty literal strings.');
  }
}
const rules = [
  ['credential', /(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AIza[0-9A-Za-z_-]{30,}|\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{32,}|\b(?:AKIA|ASIA)[A-Z0-9]{16}|1\/\/[A-Za-z0-9_-]{50,})/g],
  ['private key', /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/g],
  ['machine home path', /\/(?:home|Users)\/(?!you(?:\/|\b)|example(?:\/|\b)|clawdify(?:\/|\b))[A-Za-z0-9_.-]+/g],
  ['private network hostname', /\b[a-z0-9-]+\.tail[a-z0-9]+\.ts\.net\b/gi],
];
const denied = /^(?:_uploads|backups|memory|projects)(?:\/|$)|^public\/previews\/|(?:^|\/)\.env(?!\.example$)(?:[./]|$)|\.(?:db|sqlite|sqlite3)(?:-.*)?$|\.(?:pem|key|p12|pfx|bak|log)$|^\.next/;
const checked = new Set();
const problems = [];
let files = 0;
for (const ref of refs) {
  if (text('cat-file', '-t', ref) === 'commit') {
    const metadata = text('cat-file', 'commit', ref);
    if (privatePatterns.some(value => metadata.includes(value))) {
      problems.push(`${ref.slice(0, 12)} commit metadata: private instance marker`);
    }
    for (const [label, pattern] of rules) {
      pattern.lastIndex = 0;
      if (pattern.test(metadata)) problems.push(`${ref.slice(0, 12)} commit metadata: ${label}`);
    }
  }
  for (const record of git('ls-tree', '-r', '-z', ref).toString().split('\0').filter(Boolean)) {
    const [meta, file] = record.split('\t');
    const [, kind, oid] = meta.split(' ');
    if (kind !== 'blob') continue;
    const identity = file + ':' + oid;
    if (checked.has(identity)) continue;
    checked.add(identity); files++;
    if (denied.test(file)) problems.push(`${ref.slice(0, 12)} ${file}: runtime/private file path`);
    const data = git('cat-file', 'blob', oid);
    const content = data.toString('utf8');
    // Literal matches include binary assets; never echo matched values.
    if (privatePatterns.some(value => file.includes(value) || data.includes(Buffer.from(value)))) {
      problems.push(`${ref.slice(0, 12)} ${file}: private instance marker`);
    }
    if (data.includes(0)) continue;
    for (const [label, pattern] of rules) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) problems.push(`${ref.slice(0, 12)} ${file}: ${label}`);
    }
  }
}
if (problems.length) {
  console.error('Release blocked:\n' + [...new Set(problems)].join('\n'));
  process.exit(1);
}
console.log(`Release check passed: ${refs.size} revision(s), ${files} unique file versions.`);
