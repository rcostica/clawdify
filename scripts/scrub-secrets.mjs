#!/usr/bin/env node
/**
 * One-time script to scrub secrets from existing messages in clawdify.db
 */
import { createRequire } from 'module';
import { homedir } from 'os';
import { join } from 'path';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const SECRET_PATTERNS = [
  { name: 'github_pat', pattern: /github_pat_[A-Za-z0-9_]{20,}/g },
  { name: 'sk-key', pattern: /sk-[A-Za-z0-9]{20,}/g },
  { name: 'sk-proj', pattern: /sk-proj-[A-Za-z0-9_-]{20,}/g },
  { name: 'sb_secret', pattern: /sb_secret_[A-Za-z0-9_-]{20,}/g },
  { name: 'sb_publishable', pattern: /sb_publishable_[A-Za-z0-9_-]{20,}/g },
  { name: 'supabase_jwt', pattern: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{20,}/g },
  { name: 'xoxb', pattern: /xoxb-[A-Za-z0-9-]{20,}/g },
  { name: 'xoxp', pattern: /xoxp-[A-Za-z0-9-]{20,}/g },
  { name: 'ghp', pattern: /ghp_[A-Za-z0-9]{20,}/g },
  { name: 'gho', pattern: /gho_[A-Za-z0-9]{20,}/g },
  { name: 'ghs', pattern: /ghs_[A-Za-z0-9]{20,}/g },
  { name: 'ghu', pattern: /ghu_[A-Za-z0-9]{20,}/g },
  { name: 'glpat', pattern: /glpat-[A-Za-z0-9_-]{20,}/g },
  { name: 'aws_key', pattern: /AKIA[A-Z0-9]{16}/g },
  { name: 'bearer', pattern: /Bearer\s+[A-Za-z0-9_.-]{40,}/g },
  { name: 'npm_token', pattern: /npm_[A-Za-z0-9]{20,}/g },
  { name: 'stripe_sk', pattern: /sk_live_[A-Za-z0-9]{20,}/g },
  { name: 'stripe_pk', pattern: /pk_live_[A-Za-z0-9]{20,}/g },
  { name: 'private_key', pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE KEY-----/g },
  { name: 'oauth_labeled', pattern: /(?:Access Token|Access Token Secret|Consumer Key|Consumer Secret|Client Secret|API Secret)\s*[:=]\s*['"]?([A-Za-z0-9_.-]{20,})['"]?/gi },
  { name: 'hex_token', pattern: /(?<![A-Za-z0-9/+])[0-9a-f]{40,}(?![A-Za-z0-9/+])/gi },
  { name: 'base64_token', pattern: /(?<![A-Za-z0-9._:/-])[A-Za-z0-9+/]{48,}={0,3}(?![A-Za-z0-9._:/-])/g },
];

function redactSecrets(text) {
  let result = text;
  for (const { pattern } of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

function containsSecrets(text) {
  for (const { pattern } of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) return true;
  }
  return false;
}

const dbPath = join(homedir(), '.clawdify', 'clawdify.db');
console.log(`Opening database: ${dbPath}`);
const db = new Database(dbPath);

const allMessages = db.prepare('SELECT id, content FROM messages').all();
console.log(`Scanning ${allMessages.length} messages...`);

const update = db.prepare('UPDATE messages SET content = ? WHERE id = ?');
let redactedCount = 0;

const transaction = db.transaction(() => {
  for (const msg of allMessages) {
    if (containsSecrets(msg.content)) {
      const redacted = redactSecrets(msg.content);
      if (redacted !== msg.content) {
        update.run(redacted, msg.id);
        redactedCount++;
        // Log a safe snippet (first 60 chars of the redacted version)
        const snippet = redacted.substring(0, 120).replace(/\n/g, ' ');
        console.log(`  Redacted message ${msg.id}: "${snippet}..."`);
      }
    }
  }
});

transaction();
console.log(`\nDone. Redacted ${redactedCount} messages out of ${allMessages.length} total.`);
db.close();
