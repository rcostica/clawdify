import os from 'os';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { gatewayRpc, invokeTool, toGatewaySessionKey } from '@/lib/gateway/client';

const SESSIONS_PATH = process.env.OPENCLAW_SESSIONS_PATH ||
  path.join(os.homedir(), '.openclaw/agents/main/sessions');

type GatewaySession = {
  key: string;
  totalTokens?: number;
  contextTokens?: number;
  totalTokensFresh?: boolean;
  model?: string;
  modelProvider?: string;
};

type SessionDescription = {
  session: GatewaySession | null;
};

type ToolInvokeResult = {
  result?: {
    details?: {
      statusText?: string;
    };
    content?: Array<{
      text?: string;
      content?: string;
    }>;
  };
};

type SessionStats = {
  found: boolean;
  context: number;
  max: number;
  compactions: number;
  model: string | null;
  fresh?: boolean;
  source?: 'gateway' | 'gateway+file-fallback' | 'file-fallback';
  error?: string;
};

const EMPTY_STATS: SessionStats = {
  found: false,
  context: 0,
  max: 200000,
  compactions: 0,
  model: null,
};

function parseCompactionCount(result: ToolInvokeResult): number {
  const statusText = result.result?.details?.statusText
    || result.result?.content?.[0]?.text
    || result.result?.content?.[0]?.content
    || '';
  const match = statusText.match(/Compactions:\s*(\d+)/i);
  return match ? Number(match[1]) : 0;
}

async function getGatewayStats(sessionKey: string): Promise<SessionStats> {
  // sessions.describe accepts legacy/non-canonical keys and returns the
  // canonical session row, so Clawdify does not need to know key internals.
  const gatewaySessionKey = toGatewaySessionKey(sessionKey) || sessionKey;
  const description = await gatewayRpc<SessionDescription>('sessions.describe', {
    key: gatewaySessionKey,
  });
  const session = description.session;
  if (!session) return { ...EMPTY_STATS, source: 'gateway' };

  let compactions = 0;
  try {
    // The structured session row does not currently expose the historical
    // compaction counter. Keep this non-critical display value via OpenClaw's
    // supported read-only status tool rather than its storage file.
    const status = await invokeTool('session_status', {}, { sessionKey: session.key }) as ToolInvokeResult;
    compactions = parseCompactionCount(status);
  } catch (error) {
    console.warn('[session-stats] Could not read compaction count from Gateway:', error);
  }

  const model = session.modelProvider && session.model
    ? `${session.modelProvider}/${session.model}`
    : session.model || null;
  let context = session.totalTokens || 0;
  let fresh = session.totalTokensFresh || false;
  let source: SessionStats['source'] = 'gateway';

  if (context === 0) {
    // OpenClaw intentionally omits totalTokens from sessions.describe when it
    // considers the last stored value stale (for example after a restart).
    // The Gateway still supplies the canonical key, window, and model; use
    // that canonical key for a narrowly scoped last-known-token fallback so
    // the UI does not regress to zero until the next fresh model update.
    try {
      const fallback = await getFileFallbackStats(session.key);
      if (fallback.found && fallback.context > 0) {
        context = fallback.context;
        fresh = fallback.fresh || false;
        source = 'gateway+file-fallback';
      }
    } catch (error) {
      console.warn('[session-stats] Could not read last-known token count:', error);
    }
  }

  return {
    found: true,
    context,
    max: session.contextTokens || 200000,
    compactions,
    model,
    fresh,
    source,
  };
}

async function getFileFallbackStats(sessionKey: string): Promise<SessionStats> {
  const sessionsFile = path.join(SESSIONS_PATH, 'sessions.json');
  const raw = await fs.readFile(sessionsFile, 'utf-8');
  const sessions = JSON.parse(raw);
  const gatewaySessionKey = toGatewaySessionKey(sessionKey) || sessionKey;
  const session = sessions[gatewaySessionKey] || sessions[sessionKey] || sessions[`agent:main:${sessionKey}`];
  if (!session) return { ...EMPTY_STATS, source: 'file-fallback' };

  return {
    found: true,
    context: session.totalTokens || 0,
    max: session.contextTokens || 200000,
    compactions: session.compactionCount || 0,
    model: session.model || null,
    fresh: session.totalTokensFresh || false,
    source: 'file-fallback',
  };
}

/**
 * GET /api/session-stats?sessionKey=clawdify:...
 *
 * Reads canonical session stats through OpenClaw's supported Gateway control
 * plane. The old file read remains only as a degraded fallback if the Gateway
 * itself is temporarily unavailable.
 */
export async function GET(request: NextRequest) {
  const sessionKey = request.nextUrl.searchParams.get('sessionKey');
  if (!sessionKey) {
    return NextResponse.json({ error: 'sessionKey required' }, { status: 400 });
  }

  try {
    return NextResponse.json(await getGatewayStats(sessionKey));
  } catch (gatewayError) {
    console.warn('[session-stats] Gateway lookup failed; using file fallback:', gatewayError);
    try {
      return NextResponse.json(await getFileFallbackStats(sessionKey));
    } catch (fallbackError) {
      console.error('[session-stats] Gateway and file fallback failed:', fallbackError);
      return NextResponse.json({
        ...EMPTY_STATS,
        error: 'Failed to read session stats',
      });
    }
  }
}
