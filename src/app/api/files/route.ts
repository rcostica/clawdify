import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { incrementFileAccess } from '@/lib/file-intelligence';

const WORKSPACE_PATH = process.env.OPENCLAW_WORKSPACE_PATH || '';
const OPENCLAW_MEDIA_PATH = process.env.OPENCLAW_MEDIA_PATH || path.join(process.env.HOME || '/home/ubuntu', '.openclaw', 'media');

interface FileEntry {
  name: string;
  path: string;       // relative to workspace
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
  extension?: string;
}

const MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv; charset=utf-8',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
  webm: 'audio/webm', m4a: 'audio/mp4', mp4: 'video/mp4',
  zip: 'application/zip', tar: 'application/x-tar', gz: 'application/gzip',
  json: 'application/json; charset=utf-8', xml: 'application/xml; charset=utf-8',
  html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8',
  ts: 'text/typescript; charset=utf-8', md: 'text/markdown; charset=utf-8', txt: 'text/plain; charset=utf-8',
  py: 'text/x-python; charset=utf-8', sh: 'text/x-shellscript; charset=utf-8',
};

function isInside(child: string, parent: string): boolean {
  const childResolved = path.resolve(child);
  const parentResolved = path.resolve(parent);
  return childResolved === parentResolved || childResolved.startsWith(parentResolved + path.sep);
}

function resolveAllowedPath(relativePath: string): { fullPath: string; normalizedPath: string } | null {
  const rawPath = relativePath.startsWith('file://') ? relativePath.slice('file://'.length) : relativePath;
  const workspaceRoot = path.resolve(WORKSPACE_PATH);
  const mediaRoot = path.resolve(OPENCLAW_MEDIA_PATH);

  if (path.isAbsolute(rawPath)) {
    const fullPath = path.resolve(rawPath);
    if (isInside(fullPath, workspaceRoot)) {
      return { fullPath, normalizedPath: path.relative(workspaceRoot, fullPath) };
    }
    if (isInside(fullPath, mediaRoot)) {
      return { fullPath, normalizedPath: fullPath };
    }
    return null;
  }

  // Prevent directory traversal for normal workspace-relative paths.
  const normalizedPath = path.normalize(rawPath).replace(/^([.][.][/\\])+/, '');
  const fullPath = path.resolve(WORKSPACE_PATH, normalizedPath);
  if (!isInside(fullPath, workspaceRoot)) return null;
  return { fullPath, normalizedPath };
}

// GET /api/files?path=relative/path
export async function GET(request: NextRequest) {
  if (!WORKSPACE_PATH) {
    return NextResponse.json({ error: 'Workspace path not configured' }, { status: 500 });
  }

  const searchParams = request.nextUrl.searchParams;
  const relativePath = searchParams.get('path') || '';
  const showHidden = searchParams.get('showHidden') === 'true';
  const download = searchParams.get('download') === 'true';
  
  const resolved = resolveAllowedPath(relativePath);
  if (!resolved) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }
  const { fullPath, normalizedPath } = resolved;

  try {
    const stat = await fs.stat(fullPath);

    // Download mode: serve any file as a downloadable attachment
    if (download && !stat.isDirectory()) {
      const buffer = await fs.readFile(fullPath);
      const fileName = path.basename(fullPath);
      const ext = path.extname(fullPath).slice(1).toLowerCase();
      
      const contentType = MIME_MAP[ext] || 'application/octet-stream';
      
      return new Response(buffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
          'Content-Length': buffer.length.toString(),
        },
      });
    }

    if (stat.isDirectory()) {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const files: FileEntry[] = await Promise.all(
        entries
          .filter(e => showHidden || !e.name.startsWith('.')) // hide dotfiles unless showHidden
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

      // Track file access for the memory system (fire-and-forget)
      // Determine which project directory this file belongs to by checking
      // if the path is inside a project workspace (first path segment)
      const pathSegments = normalizedPath.split('/').filter(Boolean);
      if (!path.isAbsolute(normalizedPath) && pathSegments.length >= 1) {
        const projectWorkspace = pathSegments[0];
        const projectDir = path.join(WORKSPACE_PATH, projectWorkspace);
        const fileRelPath = pathSegments.slice(1).join('/');
        if (fileRelPath) {
          incrementFileAccess(projectDir, fileRelPath).catch(() => {});
        }
      }

      const ext = path.extname(fullPath).slice(1).toLowerCase();
      const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
      const isBinary = ['zip', 'tar', 'gz', 'exe', 'bin', 'db', 'sqlite', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext);

      if (isImage) {
        const buffer = await fs.readFile(fullPath);
        return new Response(buffer, {
          headers: { 'Content-Type': MIME_MAP[ext] || 'application/octet-stream' },
        });
      }

      const isAudio = ['webm', 'ogg', 'mp3', 'wav', 'm4a'].includes(ext);
      if (isAudio) {
        const buffer = await fs.readFile(fullPath);
        return new Response(buffer, {
          headers: { 'Content-Type': MIME_MAP[ext] || 'application/octet-stream' },
        });
      }

      if (ext === 'pdf') {
        const buffer = await fs.readFile(fullPath);
        return new Response(buffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(path.basename(fullPath))}`,
          },
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
      case 'create-file':
      case 'write-file': {
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        // Backup CONTEXT.md before overwriting
        if (path.basename(fullPath) === 'CONTEXT.md') {
          try {
            const existing = await fs.readFile(fullPath, 'utf-8');
            await fs.writeFile(
              path.join(path.dirname(fullPath), '.CONTEXT.md.bak'),
              existing,
              'utf-8',
            );
          } catch { /* no existing file to backup */ }
        }
        await fs.writeFile(fullPath, content ?? '', 'utf-8');
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
