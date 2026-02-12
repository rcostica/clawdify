/**
 * Redact secrets and credentials from text.
 * Replaces API keys, tokens, private keys, and long hex/base64 secrets with [REDACTED].
 */

const SECRET_PATTERNS: { name: string; pattern: RegExp }[] = [
  // Known API key prefixes
  { name: 'github_pat', pattern: /github_pat_[A-Za-z0-9_]{20,}/g },
  { name: 'sk-key', pattern: /sk-[A-Za-z0-9]{20,}/g },
  { name: 'sk-proj', pattern: /sk-proj-[A-Za-z0-9_-]{20,}/g },
  { name: 'sb_secret', pattern: /sb_secret_[A-Za-z0-9_-]{20,}/g },
  { name: 'sb_publishable', pattern: /sb_publishable_[A-Za-z0-9_-]{20,}/g },
  { name: 'supabase_key', pattern: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{20,}/g },
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
  { name: 'pypi_token', pattern: /pypi-[A-Za-z0-9_-]{20,}/g },
  { name: 'stripe_sk', pattern: /sk_live_[A-Za-z0-9]{20,}/g },
  { name: 'stripe_pk', pattern: /pk_live_[A-Za-z0-9]{20,}/g },
  { name: 'stripe_rk', pattern: /rk_live_[A-Za-z0-9]{20,}/g },

  // Private keys (PEM blocks)
  { name: 'private_key', pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE KEY-----/g },
  { name: 'certificate', pattern: /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g },

  // OAuth-style labeled secrets (e.g. "Access Token: abc123...")
  { name: 'oauth_labeled', pattern: /(?:Access Token|Access Token Secret|Consumer Key|Consumer Secret|Client Secret|API Secret)\s*[:=]\s*['"]?([A-Za-z0-9_.-]{20,})['"]?/gi },

  // Generic long hex strings (40+ chars, standalone — likely tokens/hashes)
  { name: 'hex_token', pattern: /(?<![A-Za-z0-9/+])[0-9a-f]{40,}(?![A-Za-z0-9/+])/gi },

  // Generic long base64-like tokens (48+ chars of alphanum+/+=, not part of a URL path or normal text)
  { name: 'base64_token', pattern: /(?<![A-Za-z0-9._:/-])[A-Za-z0-9+/]{48,}={0,3}(?![A-Za-z0-9._:/-])/g },
];

export function redactSecrets(text: string): string {
  let result = text;
  for (const { pattern } of SECRET_PATTERNS) {
    // Reset lastIndex for global regexes
    pattern.lastIndex = 0;
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

export function containsSecrets(text: string): boolean {
  for (const { pattern } of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) return true;
  }
  return false;
}
