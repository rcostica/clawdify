import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const WORKSPACE_PATH = process.env.OPENCLAW_WORKSPACE_PATH || '';

interface MemoryFile {
  name: string;
  path: string;
  size: number;
  modifiedAt: string;
}

function isWithinWorkspace(filePath: string): boolean {
  const resolved = path.resolve(WORKSPACE_PATH, filePath);
  return resolved.startsWith(path.resolve(WORKSPACE_PATH));
}

function sanitizePath(requestedPath: string): string {
  // Strip leading slashes and normalize
  const cleaned = requestedPath.replace(/^\/+/, '');
  return path.normalize(cleaned).replace(/^(\.\.[/\\])+/, '');
}

// GET /api/memory — list files or read a specific file
export async function GET(request: NextRequest) {
  if (!WORKSPACE_PATH) {
    return NextResponse.json({ error: 'Workspace path not configured' }, { status: 500 });
  }

  const searchParams = request.nextUrl.searchParams;
  const filePath = searchParams.get('path');

  // If path is provided, return file content
  if (filePath) {
    const sanitized = sanitizePath(filePath);
    const fullPath = path.join(WORKSPACE_PATH, sanitized);

    if (!isWithinWorkspace(sanitized)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    try {
      const stat = await fs.stat(fullPath);
      if (!stat.isFile()) {
        return NextResponse.json({ error: 'Not a file' }, { status: 400 });
      }
      const content = await fs.readFile(fullPath, 'utf-8');
      return NextResponse.json({
        path: sanitized,
        name: path.basename(fullPath),
        content,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      });
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
  }

  // No path — list all memory files
  try {
    const files: MemoryFile[] = [];

    // 1. Check MEMORY.md at workspace root
    try {
      const memoryMdPath = path.join(WORKSPACE_PATH, 'MEMORY.md');
      const stat = await fs.stat(memoryMdPath);
      if (stat.isFile()) {
        files.push({
          name: 'MEMORY.md',
          path: 'MEMORY.md',
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
        });
      }
    } catch {
      // MEMORY.md doesn't exist, that's fine
    }

    // 2. Read memory/ directory
    const memoryDir = path.join(WORKSPACE_PATH, 'memory');
    try {
      const entries = await fs.readdir(memoryDir, { withFileTypes: true });
      const memoryFiles: MemoryFile[] = [];

      for (const entry of entries) {
        if (!entry.isFile()) continue;
        try {
          const fileStat = await fs.stat(path.join(memoryDir, entry.name));
          memoryFiles.push({
            name: entry.name,
            path: `memory/${entry.name}`,
            size: fileStat.size,
            modifiedAt: fileStat.mtime.toISOString(),
          });
        } catch {
          // Skip files we can't stat
        }
      }

      // Sort: daily files (YYYY-MM-DD*.md) newest first, then project-*, then others
      const dailyPattern = /^\d{4}-\d{2}-\d{2}/;
      const projectPattern = /^project-/;

      const daily = memoryFiles.filter(f => dailyPattern.test(f.name)).sort((a, b) => b.name.localeCompare(a.name));
      const project = memoryFiles.filter(f => projectPattern.test(f.name)).sort((a, b) => a.name.localeCompare(b.name));
      const other = memoryFiles.filter(f => !dailyPattern.test(f.name) && !projectPattern.test(f.name)).sort((a, b) => a.name.localeCompare(b.name));

      files.push(...daily, ...project, ...other);
    } catch {
      // memory/ directory doesn't exist
    }

    return NextResponse.json({ files });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to list memory files' }, { status: 500 });
  }
}

// PUT /api/memory — save file content
export async function PUT(request: NextRequest) {
  if (!WORKSPACE_PATH) {
    return NextResponse.json({ error: 'Workspace path not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { path: filePath, content } = body;

    if (!filePath || typeof content !== 'string') {
      return NextResponse.json({ error: 'Missing path or content' }, { status: 400 });
    }

    const sanitized = sanitizePath(filePath);
    const fullPath = path.join(WORKSPACE_PATH, sanitized);

    if (!isWithinWorkspace(sanitized)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Only allow editing files within MEMORY.md or memory/ directory
    if (sanitized !== 'MEMORY.md' && !sanitized.startsWith('memory/')) {
      return NextResponse.json({ error: 'Can only edit memory files' }, { status: 403 });
    }

    // Ensure parent directory exists
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(fullPath, content, 'utf-8');

    const stat = await fs.stat(fullPath);
    return NextResponse.json({
      success: true,
      path: sanitized,
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to save file' }, { status: 500 });
  }
}
