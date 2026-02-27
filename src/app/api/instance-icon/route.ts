import { NextRequest, NextResponse } from 'next/server';
import { db, settings } from '@/lib/db';
import { eq } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

const WORKSPACE_PATH = process.env.OPENCLAW_WORKSPACE_PATH || '';

export const dynamic = 'force-dynamic';

// GET /api/instance-icon — serve the custom instance icon resized to requested size, or default
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const size = parseInt(searchParams.get('size') || '192', 10);
  const validSize = [192, 512].includes(size) ? size : 192;

  try {
    const row = db.select().from(settings).where(eq(settings.key, 'instance_icon')).get();
    if (row?.value && WORKSPACE_PATH) {
      const fullPath = path.join(WORKSPACE_PATH, row.value);
      // Security check
      if (fullPath.startsWith(WORKSPACE_PATH)) {
        try {
          await fs.access(fullPath);
          // Resize to exact square dimensions using ImageMagick
          // Output as PNG for consistent format
          const resized = execSync(
            `convert "${fullPath}" -resize ${validSize}x${validSize}^ -gravity center -extent ${validSize}x${validSize} PNG:-`,
            { maxBuffer: 5 * 1024 * 1024 }
          );
          return new Response(resized, {
            headers: {
              'Content-Type': 'image/png',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
            },
          });
        } catch {
          // File not found or convert failed, fall through to default
        }
      }
    }
  } catch { /* fall through */ }

  // Serve default icon
  const defaultPath = path.join(process.cwd(), 'public', `icon-${validSize}.png`);
  try {
    const buffer = await fs.readFile(defaultPath);
    return new Response(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
