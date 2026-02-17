/**
 * POST /api/projects/[id]/bootstrap
 *
 * Deep Bootstrap: reads all .md files + high-signal files in the project,
 * calls the gateway to generate a comprehensive CONTEXT.md.
 *
 * - Backs up existing CONTEXT.md to .CONTEXT.md.bak
 * - Writes the new CONTEXT.md
 * - Returns the generated content
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, projects } from '@/lib/db';
import { chat } from '@/lib/gateway/client';
import { eq } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';

const WORKSPACE_PATH = process.env.OPENCLAW_WORKSPACE_PATH || '';

// Max content to send in a single bootstrap prompt (~60KB to stay within limits)
const MAX_CONTENT_BYTES = 60 * 1024;

// High-signal file names to prioritize
const HIGH_SIGNAL_FILES = [
  'README.md', 'readme.md', 'Readme.md',
  'CHANGELOG.md', 'changelog.md',
  'TODO.md', 'todo.md',
  'ARCHITECTURE.md', 'architecture.md',
  'package.json',
];

/**
 * Recursively collect .md files from a directory.
 */
async function collectMdFiles(dir: string, base: string = ''): Promise<Array<{ relPath: string; fullPath: string; size: number }>> {
  const results: Array<{ relPath: string; fullPath: string; size: number }> = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.name === 'node_modules') continue;

      const fullPath = path.join(dir, entry.name);
      const relPath = base ? `${base}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        const sub = await collectMdFiles(fullPath, relPath);
        results.push(...sub);
      } else if (entry.name.toLowerCase().endsWith('.md') && entry.name !== 'CONTEXT.md') {
        try {
          const stat = await fs.stat(fullPath);
          results.push({ relPath, fullPath, size: stat.size });
        } catch { /* skip */ }
      }
    }
  } catch { /* skip unreadable */ }

  return results;
}

/**
 * Read a file safely, returning null on error.
 */
async function safeRead(filePath: string, maxSize: number = 50 * 1024): Promise<string | null> {
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

  try {
    // 1. Collect all .md files
    const mdFiles = await collectMdFiles(projectDir);

    // 2. Read high-signal files first
    const highSignalContent: string[] = [];
    let totalBytes = 0;

    for (const name of HIGH_SIGNAL_FILES) {
      const fullPath = path.join(projectDir, name);
      const content = await safeRead(fullPath);
      if (content) {
        const block = `### ${name}\n\`\`\`\n${content}\n\`\`\`\n`;
        const blockBytes = Buffer.byteLength(block, 'utf-8');
        if (totalBytes + blockBytes > MAX_CONTENT_BYTES) break;
        highSignalContent.push(block);
        totalBytes += blockBytes;
      }
    }

    // 3. Read remaining .md files (sorted by size, smallest first to fit more)
    const remainingMd = mdFiles
      .filter(f => !HIGH_SIGNAL_FILES.some(h => f.relPath.toLowerCase() === h.toLowerCase()))
      .sort((a, b) => a.size - b.size);

    const mdContent: string[] = [];
    for (const file of remainingMd) {
      const content = await safeRead(file.fullPath, 20 * 1024);
      if (content) {
        const block = `### ${file.relPath}\n\`\`\`\n${content}\n\`\`\`\n`;
        const blockBytes = Buffer.byteLength(block, 'utf-8');
        if (totalBytes + blockBytes > MAX_CONTENT_BYTES) {
          // Include at least the heading for remaining files
          mdContent.push(`### ${file.relPath} (skipped — content too large to include)`);
          continue;
        }
        mdContent.push(block);
        totalBytes += blockBytes;
      }
    }

    // 4. Build the prompt
    const filesSummary = [
      `## High-Signal Files`,
      ...highSignalContent,
      '',
      `## Documentation Files (${mdFiles.length} .md files)`,
      ...mdContent,
    ].join('\n');

    const prompt = [
      `Generate a comprehensive CONTEXT.md for the project "${project.name}".`,
      '',
      'Follow this exact structure:',
      '```',
      `# CONTEXT.md — ${project.name}`,
      '<!-- AI working memory. Auto-maintained. Human-editable. -->',
      `<!-- Last updated: ${new Date().toISOString()} -->`,
      '<!-- Status: active -->',
      '',
      '## Current State',
      '{2-3 sentences describing what the project IS right now}',
      '',
      '## Active Work',
      '- [ ] {current tasks if identifiable from the files}',
      '',
      '## Key Decisions',
      '- {date}: {decision} — {rationale}',
      '',
      '## Architecture',
      '{Key patterns, conventions, file layout}',
      '',
      '## Blockers & Open Questions',
      '- {any identified blockers}',
      '',
      '## Session History',
      `- ${new Date().toISOString().slice(0, 10)}: Deep bootstrap — CONTEXT.md generated from project files`,
      '',
      '## Reference Documents',
      '- {list of important .md files with descriptions}',
      '```',
      '',
      'Rules:',
      '- Only include facts you are confident about from the provided files.',
      '- Mark uncertainties with [?].',
      '- Keep the total under 8KB.',
      '- Do NOT invent information not present in the files.',
      '- For Active Work, only list items explicitly mentioned as in-progress or TODO.',
      '',
      '---',
      '',
      'Here are the project files:',
      '',
      filesSummary,
    ].join('\n');

    // 5. Call the gateway
    const sessionKey = `clawdify:bootstrap:${projectId}`;
    const result = await chat({
      messages: [
        {
          role: 'system',
          content: 'You are a project documentation generator. Output ONLY the CONTEXT.md content in markdown format, nothing else. Be conservative and factual.',
        },
        { role: 'user', content: prompt },
      ],
      sessionKey,
      user: sessionKey,
    });

    let generatedContent = result?.choices?.[0]?.message?.content;
    if (!generatedContent || generatedContent.length < 50) {
      return NextResponse.json(
        { error: 'Failed to generate CONTEXT.md — gateway returned insufficient content' },
        { status: 502 },
      );
    }

    // Clean up LLM output: strip markdown code fences and preamble
    // Sometimes the model wraps output in ```markdown ... ``` or adds intro text
    generatedContent = generatedContent
      .replace(/^[\s\S]*?(?=# CONTEXT\.md)/m, '') // strip everything before "# CONTEXT.md"
      .replace(/^```(?:markdown)?\s*\n?/gm, '')    // strip opening code fences
      .replace(/\n?```\s*$/gm, '')                  // strip closing code fences
      .trim();

    // 6. Backup existing CONTEXT.md
    const contextPath = path.join(projectDir, 'CONTEXT.md');
    try {
      const existing = await fs.readFile(contextPath, 'utf-8');
      await fs.writeFile(
        path.join(projectDir, '.CONTEXT.md.bak'),
        existing,
        'utf-8',
      );
    } catch { /* no existing file to backup */ }

    // 7. Write the new CONTEXT.md
    await fs.writeFile(contextPath, generatedContent, 'utf-8');

    return NextResponse.json({
      success: true,
      content: generatedContent,
      stats: {
        mdFilesFound: mdFiles.length,
        highSignalFilesRead: highSignalContent.length,
        totalContentBytes: totalBytes,
      },
    });
  } catch (error) {
    console.error('[bootstrap] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Bootstrap failed' },
      { status: 500 },
    );
  }
}
