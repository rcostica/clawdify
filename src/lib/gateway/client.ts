/**
 * Gateway WebSocket Client (CORE)
 *
 * Handles:
 * - WebSocket connection lifecycle
 * - Multi-step handshake (challenge → connect → hello-ok)
 * - Request/response correlation by `id`
 * - Event routing (chat events, tick events, agent events)
 * - Reconnection with exponential backoff
 * - Device identity + token management
 *
 * 🔒 SECURITY: This module directly handles gateway tokens and opens
 * WebSocket connections to user-controlled URLs. Every input is validated.
 * Tokens never appear in logs, URLs, error messages, or stack traces.
 */

import { nanoid } from 'nanoid';
import type {
  GatewayFrame,
  RequestFrame,
  ResponseFrame,
  EventFrame,
  ConnectParams,
  HelloOk,
  ConnectChallenge,
  GatewayConnectionConfig,
  ChatEventPayload,
  AgentEventPayload,
} from './types';
import { validateGatewayUrl } from './types';
import {
  getDeviceIdentity,
  signChallenge,
  buildSignPayload,
} from './device-identity';
import {
  getStoredDeviceToken,
  storeDeviceToken,
  clearDeviceToken,
} from './device-token';

const PROTOCOL_VERSION = 3;
const CLIENT_ID = 'webchat-ui';
const CLIENT_MODE = 'webchat';
const CLIENT_VERSION = '0.1.0';
const ROLE = 'operator';
const SCOPES = ['operator.read', 'operator.write'];
const RPC_TIMEOUT_MS = 30_000;
const CONNECT_TIMEOUT_MS = 10_000;
// 🔒 SECURITY: Max content size per delta to prevent memory exhaustion
const MAX_DELTA_SIZE = 1_048_576; // 1MB

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'handshaking'
  | 'connected'
  | 'error';

interface PendingRequest {
  resolve: (payload: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface GatewayClientEvents {
  onStatusChange?: (status: ConnectionStatus) => void;
  onHello?: (hello: HelloOk) => void;
  onChatEvent?: (payload: ChatEventPayload) => void;
  onAgentEvent?: (payload: AgentEventPayload) => void;
  onEvent?: (event: EventFrame) => void;
  onError?: (error: Error) => void;
  onClose?: (code: number, reason: string) => void;
}

export class GatewayClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();
  private config: GatewayConnectionConfig | null = null;
  private events: GatewayClientEvents = {};
  private status: ConnectionStatus = 'disconnected';
  private connectNonce: string | null = null;
  private connectSent = false;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = 800;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private lastSeq: number | null = null;
  private helloPayload: HelloOk | null = null;
  private instanceId = nanoid(12);

  constructor(events?: GatewayClientEvents) {
    if (events) this.events = events;
  }

  get connectionStatus(): ConnectionStatus {
    return this.status;
  }

  get isConnected(): boolean {
    return this.status === 'connected';
  }

  get hello(): HelloOk | null {
    return this.helloPayload;
  }

  /** Update event handlers (e.g. when React re-renders) */
  setEvents(events: GatewayClientEvents): void {
    this.events = events;
  }

  /** Connect to a Gateway */
  connect(config: GatewayConnectionConfig): void {
    this.closed = false;
    this.config = config;
    this.doConnect();
  }

  /** Disconnect and stop reconnecting */
  disconnect(): void {
    this.closed = true;
    this.cleanup();
    this.setStatus('disconnected');
  }

  /** Send an RPC request and await the response */
  async request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Gateway not connected');
    }

    const id = nanoid();
    const frame: RequestFrame = { type: 'req', id, method, params };

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }, RPC_TIMEOUT_MS);

      this.pending.set(id, {
        resolve: (payload) => resolve(payload as T),
        reject,
        timer,
      });

      this.ws!.send(JSON.stringify(frame));
    });
  }

  // ── Private ──────────────────────────────────────────────

  private setStatus(s: ConnectionStatus): void {
    if (this.status !== s) {
      this.status = s;
      this.events.onStatusChange?.(s);
    }
  }

  private cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    this.flushPending(new Error('Connection closed'));
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close();
      }
      this.ws = null;
    }
    this.connectNonce = null;
    this.connectSent = false;
    this.lastSeq = null;
  }

  private doConnect(): void {
    if (this.closed || !this.config) return;
    this.cleanup();
    this.setStatus('connecting');

    // 🔒 SECURITY: Validate URL before connecting
    const validation = validateGatewayUrl(this.config.url);
    if (!validation.valid) {
      this.setStatus('error');
      this.events.onError?.(
        new Error(validation.error ?? 'Invalid gateway URL'),
      );
      return;
    }

    const wsUrl = this.config.url;
    // 🔒 SECURITY: Token is NEVER sent as a URL query parameter.
    try {
      this.ws = new WebSocket(wsUrl);
    } catch (err) {
      this.setStatus('error');
      this.events.onError?.(
        new Error(
          `Failed to create WebSocket: ${err instanceof Error ? err.message : 'unknown error'}`,
        ),
      );
      this.scheduleReconnect();
      return;
    }

    // Set a timeout for the connect handshake
    this.connectTimer = setTimeout(() => {
      if (this.status !== 'connected') {
        this.ws?.close(4000, 'connect timeout');
        this.setStatus('error');
        this.events.onError?.(
          new Error('Connection timeout — no challenge received'),
        );
        this.scheduleReconnect();
      }
    }, CONNECT_TIMEOUT_MS);

    this.ws.onopen = () => {
      this.setStatus('handshaking');
      // Wait for server to send connect.challenge event
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data as string);
    };

    this.ws.onclose = (event) => {
      const reason = event.reason || 'unknown';
      this.flushPending(
        new Error(`Gateway closed (${event.code}): ${reason}`),
      );
      this.events.onClose?.(event.code, reason);
      if (!this.closed) {
        this.setStatus('disconnected');
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onerror fires before onclose — actual handling in onclose
    };
  }

  private handleMessage(raw: string): void {
    // 🔒 SECURITY: Defensive parsing — never trust data from the wire.
    let frame: GatewayFrame;
    try {
      frame = JSON.parse(raw);
    } catch {
      return; // Drop malformed JSON
    }

    // 🔒 SECURITY: Validate frame shape before processing.
    if (typeof frame !== 'object' || frame === null || !('type' in frame)) {
      return;
    }

    if (frame.type === 'event') {
      const event = frame as EventFrame;
      if (typeof event.event !== 'string') return;
      this.handleEvent(event);
      return;
    }

    if (frame.type === 'res') {
      const res = frame as ResponseFrame;
      if (typeof res.id !== 'string' || typeof res.ok !== 'boolean') return;
      this.handleResponse(res);
      return;
    }

    // Unknown frame type — drop it (fail closed)
  }

  private handleEvent(event: EventFrame): void {
    // ── Connect challenge ──
    if (event.event === 'connect.challenge') {
      const payload = event.payload as ConnectChallenge | undefined;
      const nonce =
        payload && typeof payload.nonce === 'string' ? payload.nonce : null;
      if (nonce) {
        this.connectNonce = nonce;
        this.sendConnect();
      }
      return;
    }

    // ── Sequence tracking ──
    if (typeof event.seq === 'number') {
      if (this.lastSeq !== null && event.seq > this.lastSeq + 1) {
        console.warn(
          `[gateway] seq gap: expected ${this.lastSeq + 1}, got ${event.seq}`,
        );
      }
      this.lastSeq = event.seq;
    }

    // ── Chat events ──
    if (event.event === 'chat') {
      const payload = event.payload as ChatEventPayload;
      // 🔒 SECURITY: Validate basic shape before forwarding
      if (
        payload &&
        typeof payload.runId === 'string' &&
        typeof payload.sessionKey === 'string' &&
        typeof payload.state === 'string'
      ) {
        this.events.onChatEvent?.(payload);
      }
      return;
    }

    // ── Agent events (tool calls, etc.) ──
    if (event.event === 'agent') {
      const payload = event.payload as AgentEventPayload;
      if (payload && typeof payload.runId === 'string') {
        this.events.onAgentEvent?.(payload);
      }
      return;
    }

    // ── Tick (keepalive) ──
    if (event.event === 'tick') {
      return;
    }

    // ── Shutdown ──
    if (event.event === 'shutdown') {
      console.warn('[gateway] Server shutting down:', event.payload);
      return;
    }

    // ── Forward all other events ──
    this.events.onEvent?.(event);
  }

  private handleResponse(res: ResponseFrame): void {
    const pending = this.pending.get(res.id);
    if (!pending) return;
    this.pending.delete(res.id);
    clearTimeout(pending.timer);

    if (res.ok) {
      pending.resolve(res.payload);
    } else {
      const msg = res.error?.message ?? 'Request failed';
      const err = new Error(msg);
      (err as Error & { code?: string }).code = res.error?.code;
      (err as Error & { retryable?: boolean }).retryable =
        res.error?.retryable;
      pending.reject(err);
    }
  }

  private async sendConnect(): Promise<void> {
    if (this.connectSent || !this.config) return;
    this.connectSent = true;

    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }

    const hasSubtle = typeof crypto !== 'undefined' && !!crypto.subtle;
    let device: ConnectParams['device'] = undefined;
    let authToken = this.config.token;
    let usedStoredDeviceToken = false;

    // ── Build device identity (if WebCrypto available and not insecure mode) ──
    if (hasSubtle && !this.config.insecureAuth) {
      try {
        const identity = await getDeviceIdentity();
        if (identity) {
          // Check for stored device token (from prior pairing)
          const storedToken = getStoredDeviceToken(identity.deviceId, ROLE);
          if (storedToken) {
            authToken = storedToken;
            usedStoredDeviceToken = true;
          }

          // Sign the challenge nonce
          const signedAtMs = Date.now();
          const payload = buildSignPayload({
            deviceId: identity.deviceId,
            clientId: CLIENT_ID,
            clientMode: CLIENT_MODE,
            role: ROLE,
            scopes: SCOPES,
            signedAtMs,
            token: authToken ?? null,
            nonce: this.connectNonce ?? undefined,
          });

          const signature = await signChallenge(identity.privateKey, payload);

          device = {
            id: identity.deviceId,
            publicKey: identity.publicKey,
            signature,
            signedAt: signedAtMs,
            nonce: this.connectNonce ?? undefined,
          };
        }
      } catch (err) {
        console.warn('[gateway] Device identity failed:', err);
      }
    }

    // ── Build auth ──
    const auth: ConnectParams['auth'] =
      authToken || this.config.password
        ? { token: authToken, password: this.config.password }
        : undefined;

    // ── Build connect params ──
    const params: ConnectParams = {
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      client: {
        id: CLIENT_ID,
        version: CLIENT_VERSION,
        platform: typeof navigator !== 'undefined' ? navigator.platform : 'web',
        mode: CLIENT_MODE,
        instanceId: this.instanceId,
      },
      role: ROLE,
      scopes: SCOPES,
      device,
      caps: [],
      auth,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      locale: typeof navigator !== 'undefined' ? navigator.language : undefined,
    };

    try {
      const hello = await this.request<HelloOk>('connect', params);

      // ── Store device token if issued ──
      if (hello?.auth?.deviceToken && device) {
        storeDeviceToken(
          device.id,
          hello.auth.role ?? ROLE,
          hello.auth.deviceToken,
          hello.auth.scopes ?? [],
        );
      }

      this.helloPayload = hello;
      this.backoffMs = 800;
      this.setStatus('connected');
      this.events.onHello?.(hello);
    } catch (err) {
      // If we used a stored device token and it failed, clear it
      if (usedStoredDeviceToken && device) {
        clearDeviceToken(device.id, ROLE);
      }
      this.events.onError?.(
        err instanceof Error ? err : new Error(String(err)),
      );
      this.ws?.close(4001, 'connect failed');
    }
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 1.7, 15_000);
    this.reconnectTimer = setTimeout(() => this.doConnect(), delay);
  }

  private flushPending(error: Error): void {
    for (const [, req] of this.pending) {
      clearTimeout(req.timer);
      req.reject(error);
    }
    this.pending.clear();
  }
}

// Re-export MAX_DELTA_SIZE for use in stores
export { MAX_DELTA_SIZE };
