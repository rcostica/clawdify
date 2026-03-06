import { NextRequest, NextResponse } from 'next/server';
import { db, threads, messages } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/session-reset
 * Body: { projectId: string }
 * 
 * Rotates the thread for a project — creates a new thread with a new UUID.
 * This causes a new OpenClaw session key (clawdify:<projectId>:<newThreadId>),
 * so OpenClaw starts a fresh session automatically.
 * 
 * Old messages stay in the old thread (preserved in DB for scrollback).
 * A divider message is inserted to mark the boundary.
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json();
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    // Find existing thread
    const existing = db.select().from(threads).where(eq(threads.projectId, projectId)).get();
    if (!existing) {
      return NextResponse.json({ error: 'No existing thread for this project' }, { status: 404 });
    }

    // Insert a divider message in the old thread
    const now = new Date();
    db.insert(messages).values({
      id: uuidv4(),
      threadId: existing.id,
      role: 'system',
      content: '— Session reset —',
      createdAt: now,
    }).run();

    // Create new thread (new UUID = new OpenClaw session key)
    const newThreadId = uuidv4();
    const newSessionKey = `clawdify:${projectId}:${newThreadId}`;

    // Update the existing thread record to point to the new ID
    // This way the project still maps to one thread, just a new one
    db.update(threads)
      .set({
        id: newThreadId,
        sessionKey: newSessionKey,
        updatedAt: now,
      })
      .where(eq(threads.id, existing.id))
      .run();

    console.log(`[session-reset] Project ${projectId}: rotated thread ${existing.id} → ${newThreadId}`);

    return NextResponse.json({
      ok: true,
      oldThreadId: existing.id,
      newThreadId,
      newSessionKey,
    });
  } catch (error) {
    console.error('[session-reset] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Reset failed' },
      { status: 500 },
    );
  }
}
