import { NextRequest, NextResponse } from 'next/server';
import { db, messages, threads, projects } from '@/lib/db';
import { like } from 'drizzle-orm';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const WORKSPACE_PATH = process.env.OPENCLAW_WORKSPACE_PATH || '';

interface FileResult {
  type: 'file';
  name: string;
  path: string;
  snippet: string;
  line?: number;
}

interface MessageResult {
  type: 'message';
  id: string;
  threadId: string;
  projectId?: string;
  projectName?: string;
  role: string;
  snippet: string;
  createdAt: Date;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('query')?.trim();
  if (!query || query.length < 2) {
    return NextResponse.json({ files: [], messages: [] });
  }

  const fileResults: FileResult[] = [];
  const messageResults: MessageResult[] = [];

  // Search files
  if (WORKSPACE_PATH && fs.existsSync(WORKSPACE_PATH)) {
    try {
      // Search by filename
      const findCmd = `find ${JSON.stringify(WORKSPACE_PATH)} -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -name '*.db' -not -name '*.sqlite' -iname '*${query.replace(/[^a-zA-Z0-9._-]/g, '')}*' 2>/dev/null | head -20`;
      const findOutput = execSync(findCmd, { encoding: 'utf-8', timeout: 3000 }).trim();
      if (findOutput) {
        for (const absPath of findOutput.split('\n')) {
          const relPath = path.relative(WORKSPACE_PATH, absPath);
          fileResults.push({
            type: 'file',
            name: path.basename(absPath),
            path: relPath,
            snippet: `File: ${relPath}`,
          });
        }
      }

      // Search by content (grep)
      const safeQuery = query.replace(/['"\\]/g, '\\$&');
      const grepCmd = `grep -ril --include='*.{md,txt,ts,tsx,js,jsx,json,yaml,yml,toml,py,sh,css,html}' -m 1 ${JSON.stringify(safeQuery)} ${JSON.stringify(WORKSPACE_PATH)} 2>/dev/null | head -20`;
      try {
        const grepOutput = execSync(grepCmd, { encoding: 'utf-8', timeout: 5000 }).trim();
        if (grepOutput) {
          for (const absPath of grepOutput.split('\n')) {
            const relPath = path.relative(WORKSPACE_PATH, absPath);
            // Avoid duplicates from filename search
            if (fileResults.some(f => f.path === relPath)) continue;

            // Get matching line for snippet
            let snippet = `Content match in ${relPath}`;
            try {
              const lineCmd = `grep -in -m 1 ${JSON.stringify(safeQuery)} ${JSON.stringify(absPath)} 2>/dev/null`;
              const lineOut = execSync(lineCmd, { encoding: 'utf-8', timeout: 2000 }).trim();
              if (lineOut) {
                const colonIdx = lineOut.indexOf(':');
                if (colonIdx > 0) {
                  const lineNum = parseInt(lineOut.substring(0, colonIdx));
                  const lineText = lineOut.substring(colonIdx + 1).trim().substring(0, 200);
                  snippet = lineText;
                  fileResults.push({
                    type: 'file',
                    name: path.basename(absPath),
                    path: relPath,
                    snippet,
                    line: lineNum,
                  });
                  continue;
                }
              }
            } catch {}

            fileResults.push({
              type: 'file',
              name: path.basename(absPath),
              path: relPath,
              snippet,
            });
          }
        }
      } catch {}
    } catch (err) {
      console.error('File search error:', err);
    }
  }

  // Search messages
  try {
    const matchingMessages = db
      .select()
      .from(messages)
      .where(like(messages.content, `%${query}%`))
      .limit(20)
      .all();

    // Get thread->project mapping
    const threadIds = [...new Set(matchingMessages.map(m => m.threadId))];
    const threadMap = new Map<string, { projectId: string; projectName: string }>();

    for (const tid of threadIds) {
      const thread = db.select().from(threads).where(like(threads.id, tid)).get();
      if (thread) {
        const project = db.select().from(projects).where(like(projects.id, thread.projectId)).get();
        threadMap.set(tid, {
          projectId: thread.projectId,
          projectName: project?.name || 'Unknown',
        });
      }
    }

    for (const msg of matchingMessages) {
      const threadInfo = threadMap.get(msg.threadId);
      // Extract snippet around the match
      const lowerContent = msg.content.toLowerCase();
      const matchIdx = lowerContent.indexOf(query.toLowerCase());
      const start = Math.max(0, matchIdx - 50);
      const end = Math.min(msg.content.length, matchIdx + query.length + 100);
      const snippet = (start > 0 ? '...' : '') + msg.content.substring(start, end) + (end < msg.content.length ? '...' : '');

      messageResults.push({
        type: 'message',
        id: msg.id,
        threadId: msg.threadId,
        projectId: threadInfo?.projectId,
        projectName: threadInfo?.projectName,
        role: msg.role,
        snippet,
        createdAt: msg.createdAt,
      });
    }
  } catch (err) {
    console.error('Message search error:', err);
  }

  return NextResponse.json({
    files: fileResults.slice(0, 20),
    messages: messageResults.slice(0, 20),
  });
}
