import { NextRequest, NextResponse } from 'next/server';
import { db, messageReactions } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// POST /api/messages/[id]/reactions — toggle a reaction
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: messageId } = await params;
  const { emoji } = await request.json();

  if (!emoji || typeof emoji !== 'string') {
    return NextResponse.json({ error: 'emoji is required' }, { status: 400 });
  }

  // Check if reaction already exists
  const existing = db
    .select()
    .from(messageReactions)
    .where(and(eq(messageReactions.messageId, messageId), eq(messageReactions.emoji, emoji)))
    .get();

  if (existing) {
    // Remove it (toggle off)
    db.delete(messageReactions).where(eq(messageReactions.id, existing.id)).run();
    return NextResponse.json({ action: 'removed', emoji });
  } else {
    // Add it (toggle on)
    const id = uuidv4();
    db.insert(messageReactions).values({
      id,
      messageId,
      emoji,
      createdAt: new Date(),
    }).run();
    return NextResponse.json({ action: 'added', emoji, id });
  }
}

// GET /api/messages/[id]/reactions — get all reactions for a message
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: messageId } = await params;

  const reactions = db
    .select()
    .from(messageReactions)
    .where(eq(messageReactions.messageId, messageId))
    .all();

  return NextResponse.json({ reactions });
}
