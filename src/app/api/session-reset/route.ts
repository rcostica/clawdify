import { NextRequest, NextResponse } from 'next/server';
import { db, threads, messages } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { chatStream } from '@/lib/gateway/client';
import * as fs from 'fs';
import * as path from 'path';

const SESSIONS_STORE = path.join(
  process.env.HOME || '/home/ubuntu',
  '.openclaw/agents/main/sessions/sessions.json'
);

/**
 * POST /api/session-reset
 * Body: { projectId: string, flush?: boolean }
 * 
 * Resets the OpenClaw session context by rotating the sessionId in the store.
 * Messages stay in the UI — only the LLM context resets.
 * Optionally flushes memory first (flush=true, default).
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

    // Reset by rotating the sessionId in the OpenClaw session store directly.
    // This is equivalent to what /reset does — new sessionId = fresh context.
    let rotated = false;
    try {
      if (fs.existsSync(SESSIONS_STORE)) {
        const store = JSON.parse(fs.readFileSync(SESSIONS_STORE, 'utf-8'));
        
        // Rotate both possible key formats
        const keys = [sessionKey, `agent:main:${sessionKey}`];
        for (const key of keys) {
          if (store[key]) {
            const oldSessionId = store[key].sessionId;
            store[key].sessionId = uuidv4();
            store[key].updatedAt = Date.now();
            // Reset token counters
            store[key].inputTokens = 0;
            store[key].outputTokens = 0;
            store[key].totalTokens = 0;
            store[key].cacheRead = 0;
            store[key].cacheWrite = 0;
            store[key].compactionCount = 0;
            console.log(`[session-reset] Rotated ${key}: ${oldSessionId} → ${store[key].sessionId}`);
            rotated = true;
          }
        }
        
        if (rotated) {
          fs.writeFileSync(SESSIONS_STORE, JSON.stringify(store, null, 2));
        }
      }
    } catch (storeErr) {
      console.warn('[session-reset] Session store rotation failed:', storeErr);
      // Fall back to sending /reset through chat (may not work for active sessions)
      try {
        const resetRes = await chatStream({
          messages: [{ role: 'user', content: '/reset' }],
          sessionKey,
          user: sessionKey,
        });
        if (resetRes.body) {
          const reader = resetRes.body.getReader();
          while (true) {
            const { done } = await reader.read();
            if (done) break;
          }
        }
      } catch (resetErr) {
        console.warn('[session-reset] /reset fallback also failed:', resetErr);
      }
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

    console.log(`[session-reset] Project ${projectId}: context reset (session key: ${sessionKey}, rotated: ${rotated})`);

    return NextResponse.json({
      ok: true,
      sessionKey,
      threadId: existing.id,
      rotated,
    });
  } catch (error) {
    console.error('[session-reset] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Reset failed' },
      { status: 500 },
    );
  }
}
