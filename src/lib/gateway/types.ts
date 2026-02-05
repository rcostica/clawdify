// ===== Frame Types (the actual wire format) =====

export interface RequestFrame {
  type: 'req';
  id: string;
  method: string;
  params?: unknown;
}

export interface ResponseFrame {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: ErrorShape;
}

export interface EventFrame {
  type: 'event';
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: { presence: number; health: number };
}

export type GatewayFrame = RequestFrame | ResponseFrame | EventFrame;

export interface ErrorShape {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
  retryAfterMs?: number;
}

// ===== Connect Handshake =====

export interface ConnectChallenge {
  nonce: string;
  ts: number;
}

export interface ConnectParams {
  minProtocol: number;
  maxProtocol: number;
  client: {
    id: string;
    displayName?: string;
    version: string;
    platform: string;
    deviceFamily?: string;
    modelIdentifier?: string;
    mode: string;
    instanceId?: string;
  };
  role?: string;
  scopes?: string[];
  caps?: string[];
  commands?: string[];
  permissions?: Record<string, boolean>;
  device?: {
    id: string;
    publicKey: string;
    signature: string;
    signedAt: number;
    nonce?: string;
  };
  auth?: {
    token?: string;
    password?: string;
  };
  locale?: string;
  userAgent?: string;
}

export interface HelloOk {
  type: 'hello-ok';
  protocol: number;
  server: {
    version: string;
    commit?: string;
    host?: string;
    connId: string;
  };
  features: {
    methods: string[];
    events: string[];
  };
  snapshot: Snapshot;
  canvasHostUrl?: string;
  auth?: {
    deviceToken: string;
    role: string;
    scopes: string[];
    issuedAtMs?: number;
  };
  policy: {
    maxPayload: number;
    maxBufferedBytes: number;
    tickIntervalMs: number;
  };
}

export interface Snapshot {
  presence: PresenceEntry[];
  health: unknown;
  stateVersion: { presence: number; health: number };
  uptimeMs: number;
  configPath?: string;
  stateDir?: string;
  sessionDefaults?: {
    defaultAgentId: string;
    mainKey: string;
    mainSessionKey: string;
    scope?: string;
  };
}

export interface PresenceEntry {
  host?: string;
  ip?: string;
  version?: string;
  platform?: string;
  mode?: string;
  lastInputSeconds?: number;
  ts: number;
  deviceId?: string;
  roles?: string[];
  scopes?: string[];
  instanceId?: string;
}

// ===== Chat Types =====

export interface ChatSendParams {
  sessionKey: string;
  message: string;
  thinking?: string;
  deliver?: boolean;
  attachments?: unknown[];
  timeoutMs?: number;
  idempotencyKey: string; // REQUIRED — not optional
}

export interface ChatSendResult {
  runId: string;
  status: 'started' | 'in_flight' | 'ok';
}

export interface ChatHistoryParams {
  sessionKey: string;
  limit?: number; // 1-1000
}

export interface ChatAbortParams {
  sessionKey: string;
  runId?: string;
}

export interface ChatInjectParams {
  sessionKey: string;
  message: string;
  label?: string;
}

/** Chat event payload — delivered as EventFrame with event="chat" */
export interface ChatEventPayload {
  runId: string;
  sessionKey: string;
  seq: number;
  state: 'delta' | 'final' | 'aborted' | 'error';
  message?: unknown;
  errorMessage?: string;
  usage?: unknown;
  stopReason?: string;
}

// ===== Session Types =====

export interface SessionsListParams {
  limit?: number;
  activeMinutes?: number;
  includeGlobal?: boolean;
  includeUnknown?: boolean;
  includeDerivedTitles?: boolean;
  includeLastMessage?: boolean;
  label?: string;
  spawnedBy?: string;
  agentId?: string;
  search?: string;
}

export interface SessionsPatchParams {
  key: string;
  label?: string | null;
  thinkingLevel?: string | null;
  model?: string | null;
}

export interface SessionsResetParams {
  key: string;
}

export interface SessionsDeleteParams {
  key: string;
  deleteTranscript?: boolean;
}

// ===== Agent Events (tool calls etc.) =====

export interface AgentEventPayload {
  runId: string;
  seq: number;
  stream: string;
  ts: number;
  data: Record<string, unknown>;
}

// ===== Connection Config =====

export interface GatewayConnectionConfig {
  url: string;
  token?: string;
  password?: string;
  /** If true, skip device identity (only works with allowInsecureAuth on Gateway) */
  insecureAuth?: boolean;
}

// 🔒 SECURITY: Gateway URL validation — prevent connecting to arbitrary endpoints
/**
 * Check if an IP address is private, localhost, or Tailscale (CGNAT range).
 * These are safe for ws:// because they're either local or VPN-encrypted.
 */
function isPrivateOrTailscaleIP(hostname: string): boolean {
  // Localhost
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1'
  ) {
    return true;
  }

  // Check if it's an IP address (simple check)
  const parts = hostname.split('.');
  if (parts.length !== 4) {
    return false; // Domain name - not private
  }

  const octets = parts.map(Number);
  if (octets.some((n) => isNaN(n) || n < 0 || n > 255)) {
    return false; // Invalid IP
  }

  const [a, b] = octets;

  // 10.0.0.0/8 - Private
  if (a === 10) return true;

  // 172.16.0.0/12 - Private (172.16.x.x - 172.31.x.x)
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 - Private
  if (a === 192 && b === 168) return true;

  // 100.64.0.0/10 - CGNAT range (Tailscale uses this)
  // Covers 100.64.0.0 - 100.127.255.255
  if (a === 100 && b !== undefined && b >= 64 && b <= 127) return true;

  return false;
}

export function validateGatewayUrl(url: string): {
  valid: boolean;
  error?: string;
  isInsecure?: boolean;
} {
  try {
    const parsed = new URL(url);
    // Must be ws: or wss: protocol
    if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
      return { valid: false, error: 'URL must use ws:// or wss:// protocol' };
    }
    // Block obviously dangerous targets
    if (parsed.hostname === '' || parsed.hostname === '0.0.0.0') {
      return { valid: false, error: 'Invalid hostname' };
    }
    // Warn about insecure connections only for public IPs/domains
    // Private IPs and Tailscale (CGNAT) are safe - either local or VPN-encrypted
    const isSafeNetwork = isPrivateOrTailscaleIP(parsed.hostname);
    const isInsecure = parsed.protocol === 'ws:' && !isSafeNetwork;
    return { valid: true, isInsecure };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}
