import { NextRequest, NextResponse } from 'next/server';
import { db, settings } from '@/lib/db';
import { eq } from 'drizzle-orm';

export const DEFAULT_GLOBAL_PROMPT = `Never share API keys or secrets in chat. All credentials are stored in the shared vault (.env). Reference them by name, never paste actual values.`;

// GET /api/settings?key=xxx
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  if (!key) {
    const all = db.select().from(settings).all();
    return NextResponse.json({ settings: all });
  }
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  const value = row?.value ?? (key === 'global_system_prompt' ? DEFAULT_GLOBAL_PROMPT : null);
  return NextResponse.json({ key, value });
}

// PUT /api/settings
export async function PUT(request: NextRequest) {
  const { key, value } = await request.json();
  if (!key || typeof value !== 'string') {
    return NextResponse.json({ error: 'key and value required' }, { status: 400 });
  }
  const now = new Date();
  db.insert(settings)
    .values({ key, value, updatedAt: now })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: now } })
    .run();
  return NextResponse.json({ ok: true });
}
