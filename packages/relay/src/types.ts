import type { WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';

// ── Roles ──────────────────────────────────────────────────────────────────

export type Role = 'agent' | 'browser';

// ── Token payload ──────────────────────────────────────────────────────────

export interface TokenPayload {
  /** Unique room identifier */
  roomId: string;
  /** User who owns this room */
  userId: string;
  /** Which side of the relay this token authorises */
  role: Role;
  /** Unix‑epoch expiry (seconds) */
  exp: number;
}

// ── Connections ────────────────────────────────────────────────────────────

export interface RelayConnection {
  ws: WebSocket;
  role: Role;
  roomId: string;
  userId: string;
  ip: string;
  connectedAt: number;
}

// ── Rooms ──────────────────────────────────────────────────────────────────

export interface Room {
  id: string;
  userId: string;
  createdAt: number;
  agent: RelayConnection | null;
  browser: RelayConnection | null;
  /** Handle for the grace‑period timer (set when last peer leaves) */
  graceTimer: ReturnType<typeof setTimeout> | null;
}

// ── Control messages (server → client) ─────────────────────────────────────

export type ServerMessage =
  | { type: 'relay:connected'; roomId: string }
  | { type: 'relay:peer_joined'; role: Role }
  | { type: 'relay:peer_left'; role: Role }
  | { type: 'relay:error'; message: string }
  | { type: 'relay:pong' };

// ── Control messages (client → server) ─────────────────────────────────────

export type ClientMessage =
  | { type: 'relay:ping' };

// ── Config ─────────────────────────────────────────────────────────────────

export interface RelayConfig {
  port: number;
  relaySecret: string;
  maxMessageSize: number;
  roomTtlMs: number;
  gracePeriodMs: number;
  statsToken: string | null;
}

// ── Health / Stats ─────────────────────────────────────────────────────────

export interface HealthResponse {
  status: 'ok';
  rooms: number;
  connections: number;
}

export interface RoomStats {
  id: string;
  userId: string;
  createdAt: number;
  ageMs: number;
  hasAgent: boolean;
  hasBrowser: boolean;
}

export interface StatsResponse {
  rooms: number;
  connections: number;
  roomDetails: RoomStats[];
}

// ── Rate limiter entry ─────────────────────────────────────────────────────

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// ── Augmented request (for IP extraction) ──────────────────────────────────

export type WsUpgradeRequest = IncomingMessage;
