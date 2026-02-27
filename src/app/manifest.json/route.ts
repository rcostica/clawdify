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
      { src: '/api/instance-icon?size=192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/api/instance-icon?size=512', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
    orientation: 'any',
    categories: ['productivity', 'utilities'],
    scope: '/',
    id: '/',
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
