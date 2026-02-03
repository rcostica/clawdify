import { createHmac, timingSafeEqual } from 'node:crypto';
import type { TokenPayload } from './types.js';

// ── Helpers ────────────────────────────────────────────────────────────────

/** URL-safe Base64 encode */
function base64url(buf: Buffer): string {
  return buf.toString('base64url');
}

/** URL-safe Base64 decode (accepts both standard & url-safe) */
function fromBase64url(str: string): Buffer {
  return Buffer.from(str, 'base64url');
}

// ── Token creation ─────────────────────────────────────────────────────────

/**
 * Generate an HMAC-signed room token.
 *
 * Format: `<base64url(payload)>.<base64url(hmac)>`
 */
export function createRoomToken(
  payload: TokenPayload,
  secret: string,
): string {
  const data = Buffer.from(JSON.stringify(payload), 'utf8');
  const encodedData = base64url(data);
  const sig = createHmac('sha256', secret).update(encodedData).digest();
  return `${encodedData}.${base64url(sig)}`;
}

// ── Token verification ─────────────────────────────────────────────────────

export interface TokenResult {
  ok: true;
  payload: TokenPayload;
}

export interface TokenError {
  ok: false;
  error: string;
}

/**
 * Verify an HMAC-signed room token. Returns the decoded payload or an error.
 */
export function verifyRoomToken(
  token: string,
  secret: string,
): TokenResult | TokenError {
  const dotIdx = token.indexOf('.');
  if (dotIdx === -1) {
    return { ok: false, error: 'malformed token' };
  }

  const encodedData = token.slice(0, dotIdx);
  const encodedSig = token.slice(dotIdx + 1);

  // Verify signature (constant-time)
  const expectedSig = createHmac('sha256', secret).update(encodedData).digest();
  const actualSig = fromBase64url(encodedSig);

  if (actualSig.length !== expectedSig.length) {
    return { ok: false, error: 'invalid signature' };
  }

  if (!timingSafeEqual(expectedSig, actualSig)) {
    return { ok: false, error: 'invalid signature' };
  }

  // Decode payload
  let payload: TokenPayload;
  try {
    const raw = fromBase64url(encodedData).toString('utf8');
    payload = JSON.parse(raw) as TokenPayload;
  } catch {
    return { ok: false, error: 'invalid payload' };
  }

  // Validate required fields
  if (
    typeof payload.roomId !== 'string' ||
    typeof payload.userId !== 'string' ||
    typeof payload.role !== 'string' ||
    typeof payload.exp !== 'number'
  ) {
    return { ok: false, error: 'incomplete payload' };
  }

  if (payload.role !== 'agent' && payload.role !== 'browser') {
    return { ok: false, error: 'invalid role' };
  }

  // Check expiry
  if (Date.now() / 1000 > payload.exp) {
    return { ok: false, error: 'token expired' };
  }

  return { ok: true, payload };
}
