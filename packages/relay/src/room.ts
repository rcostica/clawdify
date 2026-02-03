import type { WebSocket } from 'ws';
import type {
  Room,
  RelayConnection,
  Role,
  ServerMessage,
  HealthResponse,
  StatsResponse,
  RoomStats,
  RelayConfig,
} from './types.js';
import { log } from './index.js';

// ── Room store ─────────────────────────────────────────────────────────────

const rooms = new Map<string, Room>();

// ── Helpers ────────────────────────────────────────────────────────────────

function sendControl(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function getPeer(room: Room, role: Role): RelayConnection | null {
  return role === 'agent' ? room.browser : room.agent;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Add a connection to a room. Creates the room if it doesn't exist.
 * Returns false if the role slot is already occupied.
 */
export function joinRoom(
  conn: RelayConnection,
  _config: RelayConfig,
): boolean {
  let room = rooms.get(conn.roomId);

  if (!room) {
    room = {
      id: conn.roomId,
      userId: conn.userId,
      createdAt: Date.now(),
      agent: null,
      browser: null,
      graceTimer: null,
    };
    rooms.set(conn.roomId, room);
    log('info', `room created`, { roomId: room.id });
  }

  // Cancel grace timer if pending
  if (room.graceTimer) {
    clearTimeout(room.graceTimer);
    room.graceTimer = null;
  }

  // Check if slot is already taken
  if (conn.role === 'agent' && room.agent !== null) {
    return false;
  }
  if (conn.role === 'browser' && room.browser !== null) {
    return false;
  }

  // Assign to slot
  if (conn.role === 'agent') {
    room.agent = conn;
  } else {
    room.browser = conn;
  }

  // Send connected confirmation
  sendControl(conn.ws, { type: 'relay:connected', roomId: room.id });

  // Notify existing peer
  const peer = getPeer(room, conn.role);
  if (peer) {
    sendControl(peer.ws, { type: 'relay:peer_joined', role: conn.role });
    sendControl(conn.ws, { type: 'relay:peer_joined', role: peer.role });
    log('info', `room paired`, { roomId: room.id });
  }

  log('info', `${conn.role} joined`, { roomId: room.id });
  return true;
}

/**
 * Remove a connection from its room. Notifies the peer.
 * Starts the grace timer if the room is now empty.
 */
export function leaveRoom(conn: RelayConnection, config: RelayConfig): void {
  const room = rooms.get(conn.roomId);
  if (!room) return;

  const role = conn.role;

  // Only remove if it's the SAME connection (not a replacement)
  if (role === 'agent' && room.agent === conn) {
    room.agent = null;
  } else if (role === 'browser' && room.browser === conn) {
    room.browser = null;
  } else {
    return; // Connection was already replaced
  }

  log('info', `${role} left`, { roomId: room.id });

  // Notify remaining peer
  const remaining = role === 'agent' ? room.browser : room.agent;
  if (remaining) {
    sendControl(remaining.ws, { type: 'relay:peer_left', role });
  }

  // Start grace timer if room is now empty
  if (!room.agent && !room.browser && !room.graceTimer) {
    room.graceTimer = setTimeout(() => {
      // Double-check room is still empty
      const current = rooms.get(room.id);
      if (current && !current.agent && !current.browser) {
        rooms.delete(room.id);
        log('info', `room destroyed (grace expired)`, { roomId: room.id });
      }
    }, config.gracePeriodMs);
  }
}

/**
 * Forward a message from one peer to the other.
 * Returns true if the message was forwarded.
 */
export function relayMessage(
  conn: RelayConnection,
  data: Buffer | ArrayBuffer | Buffer[],
  isBinary: boolean,
): boolean {
  const room = rooms.get(conn.roomId);
  if (!room) return false;

  const peer = getPeer(room, conn.role);
  if (!peer || peer.ws.readyState !== peer.ws.OPEN) return false;

  peer.ws.send(data, { binary: isBinary });
  return true;
}

/**
 * Handle a control message from a client.
 */
export function handleControlMessage(
  conn: RelayConnection,
  text: string,
): boolean {
  try {
    const msg = JSON.parse(text) as { type?: string };
    if (typeof msg.type !== 'string' || !msg.type.startsWith('relay:')) {
      return false; // Not a control message — forward it
    }

    if (msg.type === 'relay:ping') {
      sendControl(conn.ws, { type: 'relay:pong' });
      return true;
    }

    // Unknown control message — ignore
    return true;
  } catch {
    return false; // Not JSON — forward it
  }
}

// ── Cleanup ────────────────────────────────────────────────────────────────

/**
 * Clean up rooms that have exceeded the max TTL.
 */
export function cleanupExpiredRooms(config: RelayConfig): void {
  const now = Date.now();
  for (const [id, room] of rooms) {
    if (now - room.createdAt > config.roomTtlMs) {
      // Close any remaining connections
      if (room.agent) {
        sendControl(room.agent.ws, {
          type: 'relay:error',
          message: 'room expired',
        });
        room.agent.ws.close(1000, 'room expired');
      }
      if (room.browser) {
        sendControl(room.browser.ws, {
          type: 'relay:error',
          message: 'room expired',
        });
        room.browser.ws.close(1000, 'room expired');
      }
      if (room.graceTimer) {
        clearTimeout(room.graceTimer);
      }
      rooms.delete(id);
      log('info', `room destroyed (TTL expired)`, { roomId: id });
    }
  }
}

/**
 * Close all connections and destroy all rooms. Used during shutdown.
 */
export function closeAllRooms(): void {
  for (const [id, room] of rooms) {
    if (room.agent) {
      room.agent.ws.close(1001, 'server shutting down');
    }
    if (room.browser) {
      room.browser.ws.close(1001, 'server shutting down');
    }
    if (room.graceTimer) {
      clearTimeout(room.graceTimer);
    }
    rooms.delete(id);
    log('info', `room destroyed (shutdown)`, { roomId: id });
  }
}

// ── Stats ──────────────────────────────────────────────────────────────────

export function getHealth(): HealthResponse {
  let connections = 0;
  for (const room of rooms.values()) {
    if (room.agent) connections++;
    if (room.browser) connections++;
  }
  return { status: 'ok', rooms: rooms.size, connections };
}

export function getStats(): StatsResponse {
  const now = Date.now();
  const roomDetails: RoomStats[] = [];
  let connections = 0;

  for (const room of rooms.values()) {
    const hasAgent = room.agent !== null;
    const hasBrowser = room.browser !== null;
    if (hasAgent) connections++;
    if (hasBrowser) connections++;

    roomDetails.push({
      id: room.id,
      userId: room.userId,
      createdAt: room.createdAt,
      ageMs: now - room.createdAt,
      hasAgent,
      hasBrowser,
    });
  }

  return { rooms: rooms.size, connections, roomDetails };
}
