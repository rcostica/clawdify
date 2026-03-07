import { NextRequest, NextResponse } from 'next/server';
import { db, threads, messages } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { chatStream } from '@/lib/gateway/client';
import { execSync } from 'child_process';

/**
 * POST /api/session-reset
 * Body: { projectId: string, flush?: boolean }
 * 
 * Resets the OpenClaw session context via gateway RPC (sessions.reset).
 * Messages stay in the UI — only the LLM context resets.
 * Optionally flushes memory first (flush=true, default).
 * 
 * IMPORTANT: /reset sent via /v1/chat/completions does NOT trigger a reset —
 * the HTTP completions path uses agentCommandFromIngress which bypasses
 * initSessionState (where reset triggers are checked). Only channel dispatchers
 * (Telegram, Discord, native webchat) go through initSessionState.
 * 
 * The fix: use `openclaw gateway call sessions.reset` RPC which directly
 * resets the session in the store, archives the transcript, and creates
 * a fresh session entry.
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId, flush = true } = await request.json();
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    // Find existing thread (for inserting divider)
    const existing = db.select().from(threads)
      .where(eq(threads.projectId, projectId))
      .orderBy(desc(threads.createdAt))
      .limit(1)
      .get();

    if (!existing) {
      return NextResponse.json({ error: 'No existing thread for this project' }, { status: 404 });
    }

    const sessionKey = `clawdify:${projectId}`;

    // If flush requested, send a memory flush message first
    if (flush) {
      try {
        const flushRes = await chatStream({
          messages: [
            { role: 'user', content: '[System: Session reset requested. Before the session resets, save ALL unsaved context from this conversation to memory files (memory/YYYY-MM-DD.md). Include decisions, work done, things discussed, and any important context not yet logged. Be thorough but fast — this context will be lost after reset. Do NOT include this system message in the log.]' },
          ],
          sessionKey,
          user: sessionKey,
        });
        // Consume the response fully
        if (flushRes.body) {
          const reader = flushRes.body.getReader();
          while (true) {
            const { done } = await reader.read();
            if (done) break;
          }
        }
      } catch (flushErr) {
        console.warn('[session-reset] Memory flush failed (continuing with reset):', flushErr);
      }
    }

    // Reset session via gateway RPC — this properly resets the session store,
    // archives the old transcript, and creates a fresh session entry.
    // Unlike /reset via chat completions, this goes through the sessions.reset
    // handler which does the actual session rotation.
    try {
      const result = execSync(
        `openclaw gateway call sessions.reset --params '${JSON.stringify({ key: sessionKey })}'`,
        { timeout: 15000, encoding: 'utf-8' }
      );
      console.log('[session-reset] Gateway RPC result:', result.trim().slice(0, 200));
    } catch (resetErr) {
      console.warn('[session-reset] Gateway RPC sessions.reset failed:', resetErr);
      // Don't throw — we still want the visual divider even if reset fails
    }

    // Insert a visual divider in the UI thread
    const now = new Date();
    db.insert(messages).values({
      id: uuidv4(),
      threadId: existing.id,
      role: 'system',
      content: '— Session reset —',
      createdAt: now,
    }).run();

    console.log(`[session-reset] Project ${projectId}: context reset (session key: ${sessionKey})`);

    return NextResponse.json({
      ok: true,
      sessionKey,
      threadId: existing.id,
    });
  } catch (error) {
    console.error('[session-reset] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Reset failed' },
      { status: 500 },
    );
  }
}
