import { NextResponse } from 'next/server';
import { db, settings } from '@/lib/db';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Read custom instance name from settings
  let instanceName = 'Clawdify';
  try {
    const row = db.select().from(settings).where(eq(settings.key, 'instance_name')).get();
    if (row?.value) instanceName = row.value;
  } catch { /* default */ }

  const manifest = {
    name: instanceName,
    short_name: instanceName,
    description: 'Mission Control for OpenClaw',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    orientation: 'any',
    categories: ['productivity', 'utilities'],
    scope: '/',
    id: '/',
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'no-cache',
    },
  });
}
