/**
 * Device Identity Module
 *
 * The Gateway requires device identity for non-local connections. This involves:
 * 1. Generating an ECDSA P-256 keypair via WebCrypto
 * 2. Deriving a deviceId from the public key fingerprint
 * 3. Signing the challenge nonce
 * 4. Persisting the keypair in IndexedDB
 */

const DB_NAME = 'clawdify-device';
const STORE_NAME = 'keys';
const KEY_ID = 'device-keypair';

interface StoredIdentity {
  deviceId: string;
  publicKey: string; // base64 SPKI
  privateKey: CryptoKey;
}

let cached: StoredIdentity | null = null;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, // private key NOT extractable
    ['sign', 'verify'],
  );
}

function arrayToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

async function deriveDeviceId(publicKey: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey('spki', publicKey);
  const hash = await crypto.subtle.digest('SHA-256', spki);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hex.slice(0, 32); // 32-char hex fingerprint
}

export async function getDeviceIdentity(): Promise<StoredIdentity | null> {
  // Check if WebCrypto is available (requires secure context)
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    console.warn('WebCrypto not available — device identity disabled');
    return null;
  }

  if (cached) return cached;

  try {
    const db = await openDB();

    // Try to load existing
    const existing = await new Promise<{
      deviceId?: string;
      publicKeyB64?: string;
      privateKey?: CryptoKey;
    } | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(KEY_ID);
      req.onsuccess = () => resolve(req.result as typeof existing);
      req.onerror = () => reject(req.error);
    });

    if (existing?.privateKey && existing?.publicKeyB64 && existing?.deviceId) {
      cached = {
        deviceId: existing.deviceId,
        publicKey: existing.publicKeyB64,
        privateKey: existing.privateKey,
      };
      return cached;
    }

    // Generate new
    const keyPair = await generateKeyPair();
    const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const publicKeyB64 = arrayToBase64(spki);
    const deviceId = await deriveDeviceId(keyPair.publicKey);

    // Store
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(
        { deviceId, publicKeyB64, privateKey: keyPair.privateKey },
        KEY_ID,
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    cached = {
      deviceId,
      publicKey: publicKeyB64,
      privateKey: keyPair.privateKey,
    };
    return cached;
  } catch (err) {
    console.warn('Failed to create device identity:', err);
    return null;
  }
}

/**
 * Build the signing payload for challenge nonce.
 * Must match what the Gateway expects.
 */
export function buildSignPayload(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token: string | null;
  nonce: string | undefined;
}): string {
  return JSON.stringify({
    deviceId: params.deviceId,
    clientId: params.clientId,
    clientMode: params.clientMode,
    role: params.role,
    scopes: params.scopes,
    signedAt: params.signedAtMs,
    token: params.token,
    nonce: params.nonce,
  });
}

export async function signChallenge(
  privateKey: CryptoKey,
  payload: string,
): Promise<string> {
  const encoded = new TextEncoder().encode(payload);
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    encoded,
  );
  return arrayToBase64(signature);
}
