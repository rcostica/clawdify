import type { RelayConfig } from './types.js';
import { createRelayServer } from './server.js';

// ── Logging ────────────────────────────────────────────────────────────────

type LogLevel = 'info' | 'warn' | 'error';

export function log(
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>,
): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...meta,
  };
  const line = JSON.stringify(entry);

  if (level === 'error') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

// ── Config ─────────────────────────────────────────────────────────────────

function loadConfig(): RelayConfig {
  const relaySecret = process.env['RELAY_SECRET'];
  if (!relaySecret) {
    log('error', 'RELAY_SECRET environment variable is required');
    process.exit(1);
  }

  return {
    port: parseInt(process.env['PORT'] ?? '8080', 10),
    relaySecret,
    maxMessageSize: parseInt(process.env['MAX_MESSAGE_SIZE'] ?? '1048576', 10),
    roomTtlMs: parseInt(process.env['ROOM_TTL_MS'] ?? '86400000', 10),
    gracePeriodMs: parseInt(process.env['GRACE_PERIOD_MS'] ?? '30000', 10),
    statsToken: process.env['STATS_TOKEN'] ?? null,
  };
}

// ── Main ───────────────────────────────────────────────────────────────────

const config = loadConfig();
const server = createRelayServer(config);

// Start
server.start();

// ── Graceful shutdown ──────────────────────────────────────────────────────

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  log('info', `received ${signal}, shutting down gracefully`);

  try {
    await server.stop();
    process.exit(0);
  } catch (err) {
    log('error', `shutdown error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// Catch unhandled errors
process.on('unhandledRejection', (reason) => {
  log('error', `unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}`);
});

process.on('uncaughtException', (err) => {
  log('error', `uncaught exception: ${err.message}`);
  process.exit(1);
});
