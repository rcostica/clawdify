import { WebSocketServer, type WebSocket, type RawData } from 'ws';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { RelayConfig, RelayConnection, RateLimitEntry, Role } from './types.js';
import { verifyRoomToken } from './auth.js';
import {
  joinRoom,
  leaveRoom,
  relayMessage,
  handleControlMessage,
  cleanupExpiredRooms,
  closeAllRooms,
  getHealth,
  getStats,
} from './room.js';
import { log } from './index.js';

// ── Rate limiter ───────────────────────────────────────────────────────────

const rateLimits = new Map<string, RateLimitEntry>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  entry.count++;
  return entry.count <= RATE_MAX;
}

/** Periodically purge expired rate-limit entries */
function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [ip, entry] of rateLimits) {
    if (now > entry.resetAt) {
      rateLimits.delete(ip);
    }
  }
}

// ── IP extraction ──────────────────────────────────────────────────────────

function getClientIp(req: IncomingMessage): string {
  // Trust X-Forwarded-For from reverse proxies (Fly.io, Cloudflare, etc.)
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? 'unknown';
}

// ── HTTP handler ───────────────────────────────────────────────────────────

function handleHttp(
  req: IncomingMessage,
  res: ServerResponse,
  config: RelayConfig,
): void {
  // CORS headers for health/stats
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method === 'GET' && req.url === '/health') {
    const health = getHealth();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health));
    return;
  }

  if (req.method === 'GET' && req.url === '/stats') {
    if (!config.statsToken) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${config.statsToken}`) {
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }
    const stats = getStats();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(stats));
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
}

// ── Server bootstrap ───────────────────────────────────────────────────────

export function createRelayServer(config: RelayConfig): {
  start: () => void;
  stop: () => Promise<void>;
} {
  const httpServer = createServer((req, res) => handleHttp(req, res, config));

  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws',
    maxPayload: config.maxMessageSize,
  });

  // ── WebSocket connection handler ───────────────────────────────────────

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const ip = getClientIp(req);

    // Rate limit
    if (!checkRateLimit(ip)) {
      log('warn', `rate limited`, { ip });
      ws.close(1008, 'rate limited');
      return;
    }

    // Parse query params
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const token = url.searchParams.get('token');
    const role = url.searchParams.get('role') as Role | null;

    if (!token || !role) {
      ws.close(1008, 'missing token or role');
      return;
    }

    if (role !== 'agent' && role !== 'browser') {
      ws.close(1008, 'invalid role');
      return;
    }

    // Verify token
    const result = verifyRoomToken(token, config.relaySecret);
    if (!result.ok) {
      log('warn', `auth failed: ${result.error}`, { ip });
      ws.close(1008, result.error);
      return;
    }

    const { payload } = result;

    // Role in token must match query param
    if (payload.role !== role) {
      ws.close(1008, 'role mismatch');
      return;
    }

    // Build connection object
    const conn: RelayConnection = {
      ws,
      role: payload.role,
      roomId: payload.roomId,
      userId: payload.userId,
      ip,
      connectedAt: Date.now(),
    };

    // Join room
    const joined = joinRoom(conn, config);
    if (!joined) {
      log('warn', `${role} slot already taken`, { roomId: payload.roomId });
      ws.close(1008, `${role} already connected`);
      return;
    }

    // ── Message handler ────────────────────────────────────────────────

    ws.on('message', (data: RawData, isBinary: boolean) => {
      // Text messages might be control messages
      if (!isBinary) {
        const text = data.toString('utf8');
        const isControl = handleControlMessage(conn, text);
        if (isControl) return;

        // Forward text as-is
        relayMessage(conn, data as Buffer | ArrayBuffer | Buffer[], false);
      } else {
        // Binary — always forward
        relayMessage(conn, data as Buffer | ArrayBuffer | Buffer[], true);
      }
    });

    // ── Close / error handlers ─────────────────────────────────────────

    ws.on('close', () => {
      leaveRoom(conn, config);
    });

    ws.on('error', (err) => {
      log('error', `ws error: ${err.message}`, { roomId: conn.roomId, role: conn.role });
      // The 'close' event will fire after 'error', so leaveRoom is called there
    });
  });

  // ── Periodic cleanup ─────────────────────────────────────────────────

  let cleanupInterval: ReturnType<typeof setInterval> | null = null;
  let rateLimitCleanupInterval: ReturnType<typeof setInterval> | null = null;

  function start(): void {
    httpServer.listen(config.port, () => {
      log('info', `relay server listening on port ${config.port}`);
    });

    // Run room TTL cleanup every 60 seconds
    cleanupInterval = setInterval(() => {
      cleanupExpiredRooms(config);
    }, 60_000);

    // Run rate-limit cleanup every 5 minutes
    rateLimitCleanupInterval = setInterval(() => {
      cleanupRateLimits();
    }, 300_000);
  }

  async function stop(): Promise<void> {
    log('info', 'shutting down...');

    if (cleanupInterval) clearInterval(cleanupInterval);
    if (rateLimitCleanupInterval) clearInterval(rateLimitCleanupInterval);

    // Close all WebSocket connections gracefully
    closeAllRooms();

    // Close the WS server
    await new Promise<void>((resolve, reject) => {
      wss.close((err) => (err ? reject(err) : resolve()));
    });

    // Close the HTTP server
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => (err ? reject(err) : resolve()));
    });

    log('info', 'shutdown complete');
  }

  return { start, stop };
}
