import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const SESSIONS_PATH = process.env.OPENCLAW_SESSIONS_PATH || 
  path.join(process.env.HOME || '/home/ubuntu', '.openclaw/agents/main/sessions');

/**
 * GET /api/session-stats?sessionKey=clawdify:...
 * 
 * Reads session stats from OpenClaw's sessions.json (read-only).
 * Returns context tokens, max window, compaction count.
 */
export async function GET(request: NextRequest) {
  const sessionKey = request.nextUrl.searchParams.get('sessionKey');
  if (!sessionKey) {
    return NextResponse.json({ error: 'sessionKey required' }, { status: 400 });
  }

  try {
    const sessionsFile = path.join(SESSIONS_PATH, 'sessions.json');
    const raw = await fs.readFile(sessionsFile, 'utf-8');
    const sessions = JSON.parse(raw);
    
    const session = sessions[sessionKey];
    if (!session) {
      return NextResponse.json({
        found: false,
        context: 0,
        max: 200000,
        compactions: 0,
        model: null,
      });
    }

    return NextResponse.json({
      found: true,
      context: session.totalTokens || 0,
      max: session.contextTokens || 200000,
      compactions: session.compactionCount || 0,
      model: session.model || null,
      fresh: session.totalTokensFresh || false,
    });
  } catch (error) {
    console.error('[session-stats] Error reading sessions.json:', error);
    return NextResponse.json({
      found: false,
      context: 0,
      max: 200000,
      compactions: 0,
      model: null,
      error: 'Failed to read session stats',
    });
  }
}
