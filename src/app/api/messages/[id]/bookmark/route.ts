import { NextRequest, NextResponse } from 'next/server';
import { db, messages } from '@/lib/db';
import { eq } from 'drizzle-orm';

// PATCH /api/messages/[id]/bookmark — toggle bookmark
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: messageId } = await params;

  const message = db.select().from(messages).where(eq(messages.id, messageId)).get();
  if (!message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  }

  const newValue = message.bookmarked ? 0 : 1;
  db.update(messages).set({ bookmarked: newValue }).where(eq(messages.id, messageId)).run();

  return NextResponse.json({ bookmarked: newValue === 1 });
}
