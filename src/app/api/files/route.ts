import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const WORKSPACE_PATH = process.env.OPENCLAW_WORKSPACE_PATH || '';

interface FileEntry {
  name: string;
  path: string;       // relative to workspace
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
  extension?: string;
}

// GET /api/files?path=relative/path
export async function GET(request: NextRequest) {
  if (!WORKSPACE_PATH) {
    return NextResponse.json({ error: 'Workspace path not configured' }, { status: 500 });
  }

  const searchParams = request.nextUrl.searchParams;
  const relativePath = searchParams.get('path') || '';
  
  // Prevent directory traversal
  const normalizedPath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
  const fullPath = path.join(WORKSPACE_PATH, normalizedPath);
  
  if (!fullPath.startsWith(WORKSPACE_PATH)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  try {
    const stat = await fs.stat(fullPath);

    if (stat.isDirectory()) {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const files: FileEntry[] = await Promise.all(
        entries
          .filter(e => !e.name.startsWith('.')) // hide dotfiles
          .sort((a, b) => {
            // Directories first, then alphabetical
            if (a.isDirectory() && !b.isDirectory()) return -1;
            if (!a.isDirectory() && b.isDirectory()) return 1;
            return a.name.localeCompare(b.name);
          })
          .map(async (entry) => {
            const entryPath = path.join(fullPath, entry.name);
            const entryRelPath = path.join(normalizedPath, entry.name);
            try {
              const entryStat = await fs.stat(entryPath);
              return {
                name: entry.name,
                path: entryRelPath,
                type: entry.isDirectory() ? 'directory' as const : 'file' as const,
                size: entry.isFile() ? entryStat.size : undefined,
                modifiedAt: entryStat.mtime.toISOString(),
                extension: entry.isFile() ? path.extname(entry.name).slice(1) : undefined,
              };
            } catch {
              return {
                name: entry.name,
                path: entryRelPath,
                type: entry.isDirectory() ? 'directory' as const : 'file' as const,
              };
            }
          })
      );

      return NextResponse.json({ 
        type: 'directory',
        path: normalizedPath,
        entries: files,
      });
    } else {
      // It's a file — return its content
      const ext = path.extname(fullPath).slice(1).toLowerCase();
      const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
      const isBinary = ['pdf', 'zip', 'tar', 'gz', 'exe', 'bin', 'db', 'sqlite'].includes(ext);

      if (isImage) {
        const buffer = await fs.readFile(fullPath);
        const mimeMap: Record<string, string> = {
          jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
          gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
        };
        return new Response(buffer, {
          headers: { 'Content-Type': mimeMap[ext] || 'application/octet-stream' },
        });
      }

      if (isBinary) {
        return NextResponse.json({
          type: 'file',
          path: normalizedPath,
          binary: true,
          size: stat.size,
          extension: ext,
        });
      }

      // Text file
      const content = await fs.readFile(fullPath, 'utf-8');
      return NextResponse.json({
        type: 'file',
        path: normalizedPath,
        content,
        size: stat.size,
        extension: ext,
        modifiedAt: stat.mtime.toISOString(),
      });
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('File error:', error);
    return NextResponse.json({ error: 'Failed to read' }, { status: 500 });
  }
}

// POST /api/files — upload or create file
export async function POST(request: NextRequest) {
  if (!WORKSPACE_PATH) {
    return NextResponse.json({ error: 'Workspace path not configured' }, { status: 500 });
  }

  const body = await request.json();
  const { action, filePath, content, destination } = body;

  const normalizedPath = path.normalize(filePath || '').replace(/^(\.\.[/\\])+/, '');
  const fullPath = path.join(WORKSPACE_PATH, normalizedPath);

  if (!fullPath.startsWith(WORKSPACE_PATH)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  try {
    switch (action) {
      case 'create-file': {
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, content || '', 'utf-8');
        return NextResponse.json({ success: true, path: normalizedPath });
      }
      case 'create-directory': {
        await fs.mkdir(fullPath, { recursive: true });
        return NextResponse.json({ success: true, path: normalizedPath });
      }
      case 'rename': {
        if (!destination) return NextResponse.json({ error: 'Destination required' }, { status: 400 });
        const destNorm = path.normalize(destination).replace(/^(\.\.[/\\])+/, '');
        const destFull = path.join(WORKSPACE_PATH, destNorm);
        if (!destFull.startsWith(WORKSPACE_PATH)) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
        await fs.rename(fullPath, destFull);
        return NextResponse.json({ success: true, path: destNorm });
      }
      case 'delete': {
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
          await fs.rm(fullPath, { recursive: true });
        } else {
          await fs.unlink(fullPath);
        }
        return NextResponse.json({ success: true });
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('File action error:', error);
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
  }
}
