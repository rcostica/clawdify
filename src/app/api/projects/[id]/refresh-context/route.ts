/**
 * POST /api/projects/[id]/refresh-context
 *
 * Context Refresh: reads existing CONTEXT.md + recent session summaries +
 * files modified since CONTEXT.md's last update, then calls the gateway
 * to generate an updated CONTEXT.md that preserves human edits.
 *
 * - Backs up existing CONTEXT.md to .CONTEXT.md.bak
 * - Writes the refreshed CONTEXT.md
 * - Returns the refreshed content
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, projects, threads, sessionSummaries } from '@/lib/db';
import { chat } from '@/lib/gateway/client';
import { eq, desc } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';

const WORKSPACE_PATH = process.env.OPENCLAW_WORKSPACE_PATH || '';

// Max content for the refresh prompt
const MAX_CONTENT_BYTES = 50 * 1024;

/**
 * Parse the "Last updated" timestamp from CONTEXT.md.
 */
function parseLastUpdated(content: string): Date | null {
  const match = content.match(/<!--\s*Last updated:\s*(.+?)\s*-->/);
  if (!match) return null;
  const date = new Date(match[1]);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Recursively find files modified after a given date.
 */
async function findModifiedFiles(
  dir: string,
  since: Date,
  base: string = '',
): Promise<Array<{ relPath: string; fullPath: string; size: number; mtime: Date }>> {
  const results: Array<{ relPath: string; fullPath: string; size: number; mtime: Date }> = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.name === 'node_modules') continue;
      if (entry.name === 'CONTEXT.md') continue;

      const fullPath = path.join(dir, entry.name);
      const relPath = base ? `${base}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        const sub = await findModifiedFiles(fullPath, since, relPath);
        results.push(...sub);
      } else {
        try {
          const stat = await fs.stat(fullPath);
          if (stat.mtime > since) {
            results.push({ relPath, fullPath, size: stat.size, mtime: stat.mtime });
          }
        } catch { /* skip */ }
      }
    }
  } catch { /* skip */ }

  return results;
}

/**
 * Load recent session summaries for the project's thread.
 */
function loadRecentSummaries(projectId: string, limit: number = 10): string[] {
  const thread = db.select().from(threads).where(eq(threads.projectId, projectId)).get();
  if (!thread) return [];

  const summaries = db
    .select()
    .from(sessionSummaries)
    .where(eq(sessionSummaries.threadId, thread.id))
    .orderBy(desc(sessionSummaries.lastMessageAt))
    .limit(limit)
    .all();

  return summaries.reverse().map(s => s.content);
}

/**
 * Safely read a file, returning null on error.
 */
async function safeRead(filePath: string, maxSize: number = 30 * 1024): Promise<string | null> {
  try {
    const stat = await fs.stat(filePath);
    if (stat.size > maxSize) {
      const content = await fs.readFile(filePath, 'utf-8');
      return content.slice(0, maxSize) + '\n... [truncated]';
    }
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Build the adaptive file manifest (lightweight version for context refresh).
 */
async function buildLightManifest(projectDir: string): Promise<string> {
  const lines: string[] = ['## Current File Listing'];
  try {
    const entries = await fs.readdir(projectDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const fullPath = path.join(projectDir, entry.name);
      try {
        const stat = await fs.stat(fullPath);
        if (entry.isDirectory()) {
          const subEntries = await fs.readdir(fullPath);
          lines.push(`- ${entry.name}/ (${subEntries.length} items)`);
        } else {
          const sizeKB = (stat.size / 1024).toFixed(1);
          const date = stat.mtime.toISOString().slice(0, 10);
          lines.push(`- ${entry.name} (${sizeKB}KB, ${date})`);
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return lines.join('\n');
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;

  if (!WORKSPACE_PATH) {
    return NextResponse.json({ error: 'Workspace path not configured' }, { status: 500 });
  }

  const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const projectDir = path.join(WORKSPACE_PATH, project.workspacePath);
  const contextPath = path.join(projectDir, 'CONTEXT.md');

  try {
    // 1. Read existing CONTEXT.md
    let existingContext: string | null = null;
    try {
      existingContext = await fs.readFile(contextPath, 'utf-8');
    } catch {
      return NextResponse.json(
        { error: 'No existing CONTEXT.md found. Use /api/projects/[id]/bootstrap instead.' },
        { status: 400 },
      );
    }

    // 2. Determine what changed since last update
    const lastUpdated = parseLastUpdated(existingContext);
    let modifiedFiles: Array<{ relPath: string; fullPath: string; size: number; mtime: Date }> = [];

    if (lastUpdated) {
      modifiedFiles = await findModifiedFiles(projectDir, lastUpdated);
    }

    // 3. Read modified file contents (up to budget)
    const modifiedContent: string[] = [];
    let totalBytes = 0;

    // Sort by recency, most recent first
    modifiedFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    for (const file of modifiedFiles.slice(0, 20)) {
      // Only read text-like files
      const ext = path.extname(file.relPath).toLowerCase();
      const textExts = ['.md', '.ts', '.tsx', '.js', '.jsx', '.json', '.yaml', '.yml', '.toml', '.txt', '.sql', '.css', '.html'];
      if (!textExts.includes(ext)) {
        modifiedContent.push(`- ${file.relPath} (modified ${file.mtime.toISOString().slice(0, 10)}, binary/skipped)`);
        continue;
      }

      const content = await safeRead(file.fullPath, 10 * 1024);
      if (content) {
        const block = `### ${file.relPath} (modified ${file.mtime.toISOString().slice(0, 10)})\n\`\`\`\n${content}\n\`\`\`\n`;
        const blockBytes = Buffer.byteLength(block, 'utf-8');
        if (totalBytes + blockBytes > MAX_CONTENT_BYTES) {
          modifiedContent.push(`- ${file.relPath} (modified, content too large to include)`);
          continue;
        }
        modifiedContent.push(block);
        totalBytes += blockBytes;
      }
    }

    // 4. Load recent session summaries
    const summaries = loadRecentSummaries(projectId, 10);

    // 5. Build file manifest
    const manifest = await buildLightManifest(projectDir);

    // 6. Build the refresh prompt
    const prompt = [
      `Update the CONTEXT.md for project "${project.name}".`,
      '',
      '## Current CONTEXT.md',
      '```markdown',
      existingContext,
      '```',
      '',
      summaries.length > 0 ? '## Recent Session Summaries' : '',
      ...summaries.map(s => `- ${s}`),
      '',
      manifest,
      '',
      modifiedFiles.length > 0 ? `## Files Modified Since Last Update (${modifiedFiles.length} files)` : '## No Files Modified Since Last Update',
      ...modifiedContent,
      '',
      '## Instructions',
      '',
      'Update this CONTEXT.md based on recent changes. Follow these rules strictly:',
      '',
      '1. **Preserve all existing Key Decisions and human-written content.** Do not remove or rephrase decisions unless they are explicitly superseded.',
      '2. **Update Active Work** based on session summaries and modified files. Mark completed items as done, add new items if evident.',
      '3. **Update Current State** to reflect the latest project status.',
      '4. **Update Session History** with recent session summaries. Apply decay: keep daily entries for last 7 days, weekly summaries for last 30 days, monthly for older.',
      '5. **Preserve the Architecture section** unless modified files indicate structural changes.',
      '6. **Update Reference Documents** if new .md files appeared.',
      `7. **Set Last updated to:** ${new Date().toISOString()}`,
      '8. **Keep total under 8KB.**',
      '9. **Mark any uncertain inferences with [?].**',
      '',
      'Output ONLY the updated CONTEXT.md content in markdown format.',
    ].join('\n');

    // 7. Call the gateway
    const sessionKey = `clawdify:refresh:${projectId}`;
    const result = await chat({
      messages: [
        {
          role: 'system',
          content: 'You are a project documentation updater. Output ONLY the updated CONTEXT.md content in markdown format. Be conservative — preserve existing content, only update what the evidence supports.',
        },
        { role: 'user', content: prompt },
      ],
      sessionKey,
      user: sessionKey,
    });

    let refreshedContent = result?.choices?.[0]?.message?.content;
    if (!refreshedContent || refreshedContent.length < 50) {
      return NextResponse.json(
        { error: 'Failed to refresh CONTEXT.md — gateway returned insufficient content' },
        { status: 502 },
      );
    }

    // Clean up LLM output: strip markdown code fences and preamble
    refreshedContent = refreshedContent
      .replace(/^[\s\S]*?(?=# CONTEXT\.md)/m, '')
      .replace(/^```(?:markdown)?\s*\n?/gm, '')
      .replace(/\n?```\s*$/gm, '')
      .trim();

    // 8. Backup existing CONTEXT.md
    try {
      await fs.writeFile(
        path.join(projectDir, '.CONTEXT.md.bak'),
        existingContext,
        'utf-8',
      );
    } catch { /* non-critical */ }

    // 9. Write the refreshed CONTEXT.md
    await fs.writeFile(contextPath, refreshedContent, 'utf-8');

    return NextResponse.json({
      success: true,
      content: refreshedContent,
      stats: {
        modifiedFileCount: modifiedFiles.length,
        sessionSummaryCount: summaries.length,
        lastUpdated: lastUpdated?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('[refresh-context] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Context refresh failed' },
      { status: 500 },
    );
  }
}
