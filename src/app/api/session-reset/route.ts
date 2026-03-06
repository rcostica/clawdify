import { NextRequest, NextResponse } from 'next/server';
import { db, threads, messages } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/session-reset
 * Body: { projectId: string }
 * 
 * Creates a new thread for the project (new UUID = new OpenClaw session).
 * The old thread and its messages stay untouched in the DB.
 * Chat route picks the newest thread via ORDER BY created_at DESC.
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json();
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    // Find existing thread
    const existing = db.select().from(threads)
      .where(eq(threads.projectId, projectId))
      .orderBy(desc(threads.createdAt))
      .limit(1)
      .get();

    if (!existing) {
      return NextResponse.json({ error: 'No existing thread for this project' }, { status: 404 });
    }

    // Insert a divider in the old thread (visual marker)
    const now = new Date();
    db.insert(messages).values({
      id: uuidv4(),
      threadId: existing.id,
      role: 'system',
      content: '— Session reset —',
      createdAt: now,
    }).run();

    // Create new thread — chat route picks newest by createdAt
    const newThreadId = uuidv4();
    const newSessionKey = `clawdify:${projectId}:${newThreadId}`;

    db.insert(threads).values({
      id: newThreadId,
      projectId,
      title: 'Main Thread',
      sessionKey: newSessionKey,
      createdAt: now,
      updatedAt: now,
    }).run();

    console.log(`[session-reset] Project ${projectId}: ${existing.id} → ${newThreadId}`);

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
