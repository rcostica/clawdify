import { NextRequest, NextResponse } from 'next/server';
import { db, vault } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

const WORKSPACE_PATH = process.env.OPENCLAW_WORKSPACE_PATH || '';

async function syncEnvVault() {
  if (!WORKSPACE_PATH) return;
  const entries = db.select().from(vault).all();
  const lines = entries.map(e => `${e.key}=${e.value}`);
  await fs.writeFile(path.join(WORKSPACE_PATH, '.env.vault'), lines.join('\n') + '\n');
}

// GET /api/vault — list all (returns keys only by default, ?includeValues=true for values)
export async function GET(request: NextRequest) {
  const includeValues = request.nextUrl.searchParams.get('includeValues') === 'true';
  const entries = db.select().from(vault).all();
  return NextResponse.json({
    entries: entries.map(e => ({
      id: e.id,
      key: e.key,
      ...(includeValues ? { value: e.value } : {}),
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    })),
  });
}

// POST /api/vault — create entry
export async function POST(request: NextRequest) {
  const { key, value } = await request.json();
  if (!key || !value) {
    return NextResponse.json({ error: 'key and value required' }, { status: 400 });
  }
  const now = new Date();
  const id = uuidv4();
  try {
    db.insert(vault).values({ id, key, value, createdAt: now, updatedAt: now }).run();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Key already exists' }, { status: 409 });
    }
    throw err;
  }
  await syncEnvVault();
  return NextResponse.json({ id });
}

// PUT /api/vault — update entry
export async function PUT(request: NextRequest) {
  const { id, key, value } = await request.json();
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };
  if (key) updates.key = key;
  if (value) updates.value = value;
  db.update(vault).set(updates).where(eq(vault.id, id)).run();
  await syncEnvVault();
  return NextResponse.json({ ok: true });
}

// DELETE /api/vault?id=xxx
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }
  db.delete(vault).where(eq(vault.id, id)).run();
  await syncEnvVault();
  return NextResponse.json({ ok: true });
}
