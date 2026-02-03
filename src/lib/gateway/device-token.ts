/**
 * Device Token Storage
 *
 * The Gateway issues device tokens after successful pairing.
 * Store per deviceId+role in localStorage.
 *
 * 🔒 SECURITY: Device tokens (issued by the Gateway, scoped + rotatable)
 * are the ONLY tokens acceptable in localStorage. User-provided gateway
 * tokens are NEVER stored in localStorage.
 */

const STORAGE_KEY_PREFIX = 'clawdify.deviceToken.';

interface StoredDeviceToken {
  token: string;
  role: string;
  scopes: string[];
}

export function getStoredDeviceToken(
  deviceId: string,
  role: string,
): string | null {
  try {
    const raw = localStorage.getItem(
      `${STORAGE_KEY_PREFIX}${deviceId}.${role}`,
    );
    if (!raw) return null;
    const parsed: StoredDeviceToken = JSON.parse(raw);
    return parsed.token || null;
  } catch {
    return null;
  }
}

export function storeDeviceToken(
  deviceId: string,
  role: string,
  token: string,
  scopes: string[],
): void {
  try {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${deviceId}.${role}`,
      JSON.stringify({ token, role, scopes }),
    );
  } catch {
    // localStorage full or unavailable
  }
}

export function clearDeviceToken(deviceId: string, role: string): void {
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${deviceId}.${role}`);
  } catch {
    // ignore
  }
}
