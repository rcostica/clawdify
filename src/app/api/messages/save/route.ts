import { NextRequest, NextResponse } from 'next/server';
import { db, messages, threads } from '@/lib/db';
import { and, desc, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { redactSecrets } from '@/lib/redact';
import { eventBus } from '@/lib/event-bus';

function asTimeMs(value: Date | number | string): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value < 1e12 ? value * 1000 : value;
  return new Date(value).getTime();
}

/**
 * POST /api/messages/save
 * Persist a message directly to DB (used for interrupted/partial responses
 * that were streamed to the client but never saved server-side).
 */
export async function POST(request: NextRequest) {
  try {
    const { id: msgId, projectId, role, content } = await request.json();

    if (!projectId || !content || !role) {
      return NextResponse.json({ error: 'projectId, role, and content are required' }, { status: 400 });
    }

    // Find the thread for this project
    const thread = db.select().from(threads)
      .where(eq(threads.projectId, projectId))
      .all()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    if (!thread) {
      return NextResponse.json({ error: 'No thread found for project' }, { status: 404 });
    }

    const finalId = msgId || uuidv4();
    const redactedContent = redactSecrets(content);

    // Safety net: frontend fallback saves should not create a second assistant
    // row if the backend background task saved the same content moments later.
    const cutoff = Date.now() - 5 * 60 * 1000;
    const recentDuplicate = db.select().from(messages)
      .where(and(
        eq(messages.threadId, thread.id),
        eq(messages.role, role),
        eq(messages.content, redactedContent),
      ))
      .orderBy(desc(messages.createdAt))
      .limit(10)
      .all()
      .find((m) => asTimeMs(m.createdAt) >= cutoff);

    if (recentDuplicate) {
      return NextResponse.json({ id: recentDuplicate.id, saved: false, duplicate: true });
    }

    const createdAt = new Date();
    db.insert(messages).values({
      id: finalId,
      threadId: thread.id,
      role,
      content: redactedContent,
      createdAt,
    }).run();

    eventBus.emit({
      type: 'message',
      projectId,
      message: {
        id: finalId,
        role,
        content: redactedContent,
        createdAt: createdAt.toISOString(),
      },
    });

    return NextResponse.json({ id: finalId, saved: true });
  } catch (error) {
    console.error('Error saving message:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Save failed' },
      { status: 500 },
    );
  }
}
