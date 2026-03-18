import { NextRequest, NextResponse } from 'next/server';
import { db, messages, threads } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { redactSecrets } from '@/lib/redact';

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

    db.insert(messages).values({
      id: finalId,
      threadId: thread.id,
      role,
      content: redactSecrets(content),
      createdAt: new Date(),
    }).run();

    return NextResponse.json({ id: finalId, saved: true });
  } catch (error) {
    console.error('Error saving message:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Save failed' },
      { status: 500 },
    );
  }
}
