import { NextRequest, NextResponse } from 'next/server';
import { chatStream, type ChatMessage } from '@/lib/gateway/client';
import { db, messages, threads, projects, settings, vault, messageReactions } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { redactSecrets } from '@/lib/redact';
import { triggerSummarizationIfNeeded, loadSessionSummaries } from '@/lib/session-summary';
import { eventBus } from '@/lib/event-bus';
import { getTopAccessedFiles, readFirstLines, getOrGenerateFileTags } from '@/lib/file-intelligence';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const WORKSPACE_PATH = process.env.OPENCLAW_WORKSPACE_PATH || '';
const HISTORY_LIMIT = 50;

// Path to the whisper transcription environment
const WHISPER_PYTHON = path.join(process.env.HOME || '/home/razvan', '.local/share/whisper-env/bin/python');
const TRANSCRIBE_SCRIPT = path.join(process.cwd(), 'scripts/transcribe.py');

/**
 * Transcribe an audio file using faster-whisper (local, CPU).
 * Returns the transcription text, or empty string on failure.
 */
async function transcribeAudio(audioPath: string): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync(WHISPER_PYTHON, [TRANSCRIBE_SCRIPT, audioPath], {
      timeout: 60_000, // 60s max for transcription
      env: { ...process.env, WHISPER_MODEL: 'small' },
    });
    if (stderr) console.warn('[transcribe] stderr:', stderr);
    return stdout.trim();
  } catch (error) {
    console.error('[transcribe] Failed:', error);
    return '';
  }
}

// Module-level set to prevent GC of background gateway-read tasks
// when client disconnects before the response is fully streamed
const _pendingTasks = new Set<Promise<void>>();

const DEFAULT_GLOBAL_PROMPT = `Never share API keys or secrets in chat. All credentials are stored in the shared vault (.env). Reference them by name, never paste actual values.`;

// ---------------------------------------------------------------------------
// Shared task management instructions (injected into all project contexts)
// ---------------------------------------------------------------------------

function buildTaskApiDocs(projectId: string): string {
  return [
    '',
    '## Auto Task Management',
    'IMPORTANT: When you plan work or start executing tasks, you MUST create corresponding kanban tasks automatically.',
    '- Before starting a multi-step task, create tasks for each step in the kanban (status: "in-progress" for current, "backlog" for upcoming).',
    '- When you finish a task, update its status to "done".',
    '- When you start a new step, update its status to "in-progress".',
    '- Keep task titles short and descriptive.',
    '',
    '### Task API',
    `- **List:** GET http://localhost:3000/api/tasks?projectId=${projectId}`,
    '- **Create:** POST http://localhost:3000/api/tasks',
    `  Body: { "projectId": "${projectId}", "title": "...", "description": "...", "status": "backlog|in-progress|review|done", "priority": "low|medium|high" }`,
    '- **Update:** PATCH http://localhost:3000/api/tasks/:id',
    '  Body: { "status": "in-progress|done|...", "title": "..." }',
    '- **Delete:** DELETE http://localhost:3000/api/tasks/:id',
    '',
    'Use your tools (e.g., web_fetch or exec with curl) to call these endpoints.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// General project detection
// ---------------------------------------------------------------------------

function isGeneralProject(projectId: string): boolean {
  const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project) return false;
  return project.name.toLowerCase() === 'general';
}

// ---------------------------------------------------------------------------
// Context builders
// ---------------------------------------------------------------------------

function getGlobalContext(): string {
  const row = db.select().from(settings).where(eq(settings.key, 'global_system_prompt')).get();
  const prompt = row?.value ?? DEFAULT_GLOBAL_PROMPT;

  const vaultEntries = db.select({ key: vault.key }).from(vault).all();
  const lines: string[] = ['[Global System Prompt]', prompt];

  if (vaultEntries.length > 0) {
    const keyNames = vaultEntries.map(e => e.key).join(', ');
    lines.push('', `Available credentials in vault: ${keyNames}`);
  }

  return lines.join('\n');
}

/**
 * Build meta-context for the General project: summary of all projects + vault + API instructions.
 */
function buildGeneralContext(projectId?: string): string {
  const allProjects = db.select().from(projects).all();
  const lines: string[] = [
    '[Command Center — General Project]',
    'You are in the General project, which serves as a command center for managing all Clawdify projects.',
    '',
    `## All Projects (${allProjects.length})`,
  ];

  for (const p of allProjects) {
    const thread = db.select().from(threads).where(eq(threads.projectId, p.id)).get();
    let lastActivity = 'no messages';
    if (thread) {
      const lastMsg = db
        .select({ createdAt: messages.createdAt })
        .from(messages)
        .where(eq(messages.threadId, thread.id))
        .orderBy(desc(messages.createdAt))
        .limit(1)
        .get();
      if (lastMsg?.createdAt) {
        lastActivity = `last message: ${lastMsg.createdAt instanceof Date ? lastMsg.createdAt.toISOString() : lastMsg.createdAt}`;
      }
    }
    lines.push(`- ${p.icon || '📁'} **${p.name}** [${p.status}] — ${p.description || 'no description'} | workspace: ${p.workspacePath} | ${lastActivity}`);
  }

  const vaultEntries = db.select({ key: vault.key }).from(vault).all();
  if (vaultEntries.length > 0) {
    lines.push('', `## Vault Keys: ${vaultEntries.map(e => e.key).join(', ')}`);
  } else {
    lines.push('', '## Vault: empty');
  }

  lines.push('', `## Clawdify Management API`,
    'To manage projects and vault, use these local REST endpoints:',
    '',
    '### Projects',
    '- **List:** GET http://localhost:3000/api/projects',
    '- **Create:** POST http://localhost:3000/api/projects',
    '  Body: { "name": "My Project", "description": "...", "icon": "🚀", "color": "#hex" }',
    '- **Update:** PUT http://localhost:3000/api/projects/:id',
    '  Body: { "name": "...", "description": "...", "icon": "...", "color": "...", "status": "active|archived" }',
    '- **Delete:** DELETE http://localhost:3000/api/projects/:id',
    '',
    '### Vault (Credentials)',
    '- **List keys:** GET http://localhost:3000/api/vault',
    '- **Set:** POST http://localhost:3000/api/vault',
    '  Body: { "key": "MY_API_KEY", "value": "secret123" }',
    '- **Delete:** DELETE http://localhost:3000/api/vault/:key',
    '',
    'Use your tools (e.g., web_fetch or exec with curl) to call these endpoints.',
  );

  if (projectId) lines.push(buildTaskApiDocs(projectId));

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Helper: Parse specific sections from a CONTEXT.md file
// ---------------------------------------------------------------------------

function parseContextSections(content: string, sections: string[]): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let capturing = false;

  for (const line of lines) {
    if (line.startsWith('## ')) {
      const heading = line.replace(/^##\s+/, '').trim();
      capturing = sections.some(s => heading.toLowerCase().startsWith(s.toLowerCase()));
    }
    if (capturing) {
      result.push(line);
    }
  }

  return result.join('\n').trim();
}

// ---------------------------------------------------------------------------
// Helper: Read first non-empty line of a file (for .md headings)
// ---------------------------------------------------------------------------

async function readFirstLine(fullPath: string): Promise<string> {
  try {
    const stat = await fs.stat(fullPath);
    if (stat.size === 0 || stat.size > 512 * 1024) return '';
    const content = await fs.readFile(fullPath, 'utf-8');
    const line = content.split('\n').find(l => l.trim().length > 0) || '';
    return line.replace(/^#+\s*/, '').trim();
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Helper: Collect file info recursively
// ---------------------------------------------------------------------------

interface ProjectFileInfo {
  name: string;
  relPath: string;
  dir: string;
  size: number;
  mtime: Date;
  isDir: boolean;
}

async function collectFiles(dir: string, maxFiles: number = 1000): Promise<ProjectFileInfo[]> {
  const results: ProjectFileInfo[] = [];

  async function walk(currentDir: string, currentBase: string): Promise<void> {
    if (results.length >= maxFiles) return;
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= maxFiles) return;
        if (entry.name.startsWith('.')) continue;
        if (entry.name === 'node_modules') continue;

        const fullPath = path.join(currentDir, entry.name);
        const relPath = currentBase ? `${currentBase}/${entry.name}` : entry.name;

        try {
          const stat = await fs.stat(fullPath);
          if (entry.isDirectory()) {
            results.push({ name: entry.name, relPath, dir: currentBase, size: 0, mtime: stat.mtime, isDir: true });
            await walk(fullPath, relPath);
          } else {
            results.push({
              name: entry.name,
              relPath,
              dir: currentBase,
              size: stat.size,
              mtime: stat.mtime,
              isDir: false,
            });
          }
        } catch { /* skip inaccessible */ }
      }
    } catch { /* skip unreadable dirs */ }
  }

  await walk(dir, '');
  return results;
}

// ---------------------------------------------------------------------------
// Helper: Build adaptive file manifest based on project size
// ---------------------------------------------------------------------------

async function buildFileManifest(projectDir: string): Promise<string> {
  const allFiles = await collectFiles(projectDir);
  const fileOnly = allFiles.filter(f => !f.isDir);
  const totalSize = fileOnly.reduce((sum, f) => sum + f.size, 0);
  const count = fileOnly.length;

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };
  const formatDate = (d: Date): string => d.toISOString().slice(0, 10);

  // Load hot files (most-accessed) for promotion
  const hotFiles = await getTopAccessedFiles(projectDir, 5);
  const hotFilePaths = new Set(hotFiles.filter(h => h.count >= 3).map(h => h.path));

  // Build a manifest entry for a single file, including tags and hot file promotion
  async function buildEntry(f: ProjectFileInfo): Promise<string> {
    let entry = `- ${f.relPath} (${formatSize(f.size)}, ${formatDate(f.mtime)})`;

    // Add heading for .md files
    if (f.name.toLowerCase().endsWith('.md')) {
      const heading = await readFirstLine(path.join(projectDir, f.relPath));
      if (heading) entry += ` — ${heading}`;

      // Auto-generate and include tags
      const tags = await getOrGenerateFileTags(projectDir, f.relPath);
      if (tags.length > 0) {
        entry += ` [${tags.join(', ')}]`;
      }
    }

    // Hot file promotion: include first 2-3 lines for frequently-accessed files
    if (hotFilePaths.has(f.relPath)) {
      const preview = await readFirstLines(path.join(projectDir, f.relPath), 3);
      if (preview) {
        const previewLines = preview.split('\n').map(l => `    ${l}`).join('\n');
        entry += ` 🔥\n${previewLines}`;
      }
    }

    return entry;
  }

  const lines: string[] = [`## Project Files (${count} files, ${formatSize(totalSize)})`];

  // Show hot files section if we have any
  if (hotFiles.length > 0 && hotFiles[0].count >= 3) {
    lines.push('### Frequently Accessed');
    for (const hot of hotFiles.filter(h => h.count >= 3)) {
      const fileInfo = fileOnly.find(f => f.relPath === hot.path);
      if (fileInfo) {
        lines.push(await buildEntry(fileInfo));
      }
    }
    lines.push('');
  }

  if (count < 30) {
    // Small project: full listing with size, date, and .md headings
    const sorted = fileOnly.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    for (const f of sorted) {
      // Skip files already shown in hot section
      if (hotFilePaths.has(f.relPath)) continue;
      lines.push(await buildEntry(f));
    }
  } else if (count < 100) {
    // Medium project: recent files individually, then group by directory
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentFiles = fileOnly
      .filter(f => f.mtime > sevenDaysAgo && !hotFilePaths.has(f.relPath))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    if (recentFiles.length > 0) {
      lines.push('### Recently Modified');
      for (const f of recentFiles.slice(0, 15)) {
        lines.push(await buildEntry(f));
      }
    }

    lines.push('### By Directory');
    const dirs = new Map<string, ProjectFileInfo[]>();
    for (const f of fileOnly) {
      const d = f.dir || '(root)';
      if (!dirs.has(d)) dirs.set(d, []);
      dirs.get(d)!.push(f);
    }
    for (const [d, files] of dirs) {
      const dirSize = files.reduce((s, f) => s + f.size, 0);
      lines.push(`- ${d}/ (${files.length} files, ${formatSize(dirSize)})`);
    }
  } else {
    // Large project: overview + recent + search instruction
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentFiles = fileOnly
      .filter(f => f.mtime > sevenDaysAgo && !hotFilePaths.has(f.relPath))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    if (recentFiles.length > 0) {
      lines.push('### Recently Modified (last 7 days)');
      for (const f of recentFiles.slice(0, 10)) {
        lines.push(await buildEntry(f));
      }
    }

    lines.push('### Directory Overview');
    const dirCounts = new Map<string, number>();
    for (const f of fileOnly) {
      const d = f.dir || '(root)';
      dirCounts.set(d, (dirCounts.get(d) || 0) + 1);
    }
    for (const [d, cnt] of Array.from(dirCounts.entries()).sort((a, b) => b[1] - a[1])) {
      lines.push(`- ${d}/ — ${cnt} files`);
    }

    lines.push('', '🔍 Use `qmd search "query"` to find specific files in this project.');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Helper: Load inherited context from parent/siblings
// ---------------------------------------------------------------------------

async function loadInheritedContext(projectId: string): Promise<string> {
  const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project || !project.parentId) return '';

  const parent = db.select().from(projects).where(eq(projects.id, project.parentId)).get();
  if (!parent) return '';

  const lines: string[] = [];

  // Load parent CONTEXT.md (selective sections only)
  if (WORKSPACE_PATH && parent.workspacePath) {
    const parentContextPath = path.join(WORKSPACE_PATH, parent.workspacePath, 'CONTEXT.md');
    try {
      const parentContent = await fs.readFile(parentContextPath, 'utf-8');
      const selectedSections = parseContextSections(parentContent, [
        'Current State', 'Active Work', 'Key Decisions', 'Architecture',
      ]);
      if (selectedSections) {
        lines.push(`## Parent Project: ${parent.name}`);
        lines.push(selectedSections);
      }
    } catch { /* no parent CONTEXT.md */ }
  }

  // Load sibling projects (same parentId, not self)
  const parentId = project.parentId;
  const siblings = db.select().from(projects).all()
    .filter(p => p.parentId === parentId && p.id !== projectId);

  if (siblings.length > 0) {
    lines.push('', '## Sibling Projects');
    for (const sib of siblings.slice(0, 5)) {
      let sibState = '';
      if (WORKSPACE_PATH && sib.workspacePath) {
        try {
          const sibContent = await fs.readFile(
            path.join(WORKSPACE_PATH, sib.workspacePath, 'CONTEXT.md'),
            'utf-8',
          );
          sibState = parseContextSections(sibContent, ['Current State'])
            .replace(/^## Current State\s*\n?/, '')
            .trim();
        } catch { /* no sibling CONTEXT.md */ }
      }
      lines.push(`- **${sib.name}**: ${sibState || sib.description || 'no context available'}`);
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Helper: Check CONTEXT.md staleness
// ---------------------------------------------------------------------------

async function checkStaleness(contextContent: string, projectDir: string): Promise<string | null> {
  const match = contextContent.match(/<!--\s*Last updated:\s*(.+?)\s*-->/);
  if (!match) return null;

  const lastUpdated = new Date(match[1]);
  if (isNaN(lastUpdated.getTime())) return null;

  const daysSinceUpdate = Math.floor((Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
  if (daysSinceUpdate <= 7) return null;

  // Check if project has files modified more recently than CONTEXT.md
  try {
    const entries = await fs.readdir(projectDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'CONTEXT.md') continue;
      try {
        const stat = await fs.stat(path.join(projectDir, entry.name));
        if (stat.mtime > lastUpdated) {
          return `⚠️ CONTEXT.md was last updated ${daysSinceUpdate} days ago and may be outdated. Review and update Active Work and Current State.`;
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }

  return null;
}

// ---------------------------------------------------------------------------
// Build project context with tiered memory system
// ---------------------------------------------------------------------------

async function buildProjectContext(projectId: string): Promise<string> {
  try {
    if (isGeneralProject(projectId)) {
      return buildGeneralContext(projectId);
    }

    const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
    if (!project) return '';

    const lines: string[] = [
      `[Project Context: ${project.name}]`,
    ];

    if (project.description) {
      lines.push(`Description: ${project.description}`);
    }

    lines.push(`Workspace: ${project.workspacePath}/`);

    if (WORKSPACE_PATH && project.workspacePath) {
      const projectDir = path.join(WORKSPACE_PATH, project.workspacePath);

      // Ensure project directory exists
      try {
        await fs.mkdir(projectDir, { recursive: true });
      } catch { /* already exists */ }

      // --- 1. CONTEXT.md auto-creation (static template) ---
      const contextPath = path.join(projectDir, 'CONTEXT.md');
      let contextContent: string | null = null;
      try {
        contextContent = await fs.readFile(contextPath, 'utf-8');
      } catch {
        // CONTEXT.md doesn't exist — create from static template
        const refDocParts: string[] = [];
        try {
          const dirEntries = await fs.readdir(projectDir);
          const mdFiles = dirEntries.filter(
            f => f.toLowerCase().endsWith('.md') && f !== 'CONTEXT.md',
          );
          for (const mdFile of mdFiles) {
            const heading = await readFirstLine(path.join(projectDir, mdFile));
            refDocParts.push(`- ${mdFile}${heading ? ` — ${heading}` : ''}`);
          }
        } catch { /* empty dir */ }

        const refDocs = refDocParts.length > 0
          ? refDocParts.join('\n')
          : '(no documentation files yet)';

        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);
        const template = [
          `# CONTEXT.md — ${project.name}`,
          '<!-- AI working memory. Auto-maintained. Human-editable. -->',
          `<!-- Last updated: ${now.toISOString()} -->`,
          '<!-- Status: active -->',
          '',
          '## Current State',
          project.description || 'New project. Status will be updated through conversation.',
          '',
          '## Active Work',
          '- (none yet — will be populated through conversation)',
          '',
          '## Key Decisions',
          '- (none yet)',
          '',
          '## Architecture',
          '(Not yet documented)',
          '',
          '## Blockers & Open Questions',
          '- (none)',
          '',
          '## Session History',
          `- ${todayStr}: Project created in Clawdify`,
          '',
          '## Reference Documents',
          refDocs,
          '',
        ].join('\n');

        try {
          await fs.writeFile(contextPath, template, 'utf-8');
          contextContent = template;
        } catch { /* non-critical */ }
      }

      // --- 2. Always load CONTEXT.md ---
      if (contextContent) {
        const contextSizeBytes = Buffer.byteLength(contextContent, 'utf-8');
        lines.push('', '--- CONTEXT.md ---', contextContent);

        // Size warning if > 10KB
        if (contextSizeBytes > 10 * 1024) {
          const sizeKB = (contextSizeBytes / 1024).toFixed(1);
          lines.push(
            '',
            `⚠️ CONTEXT.md is ${sizeKB}KB and exceeds the 8KB target. Compress Session History and older Key Decisions before your next update.`,
          );
        }

        // Staleness detection
        const stalenessWarning = await checkStaleness(contextContent, projectDir);
        if (stalenessWarning) {
          lines.push('', stalenessWarning);
        }
      }

      // --- 3. Load README.md if exists and < 3KB ---
      const readmePath = path.join(projectDir, 'README.md');
      try {
        const readmeStat = await fs.stat(readmePath);
        if (readmeStat.size < 3 * 1024) {
          const readmeContent = await fs.readFile(readmePath, 'utf-8');
          lines.push('', '--- README.md ---', readmeContent);
        } else {
          lines.push(
            '',
            `--- README.md (${(readmeStat.size / 1024).toFixed(1)}KB — too large to include, fetch on demand) ---`,
          );
        }
      } catch { /* no README.md */ }

      // --- 4. Adaptive file manifest ---
      const manifest = await buildFileManifest(projectDir);
      lines.push('', manifest);

      // --- 5. Sub-project inheritance ---
      if (project.parentId) {
        const inherited = await loadInheritedContext(projectId);
        if (inherited) {
          lines.push('', '## Inherited Context (Parent & Siblings)', inherited);
        }
      }
    }

    // --- 6. System prompt instructions ---
    lines.push('', '## Project Memory Instructions');
    lines.push('CONTEXT.md is your working memory for this project. Follow these rules strictly:');
    lines.push('');
    lines.push('1. **Update CONTEXT.md after significant conversations.** After making decisions, completing tasks, encountering blockers, or changing architecture — update the relevant sections immediately.');
    lines.push('2. **How to update CONTEXT.md:** POST to http://localhost:3000/api/files');
    lines.push(`   Body: { "action": "create-file", "filePath": "${project.workspacePath}/CONTEXT.md", "content": "...updated content..." }`);
    lines.push('3. **Keep CONTEXT.md under 8KB.** When it grows large, compress Session History first (daily→weekly→monthly summaries), then trim older Key Decisions (remove rationale, keep decision+date).');
    lines.push(`4. **Fetch files on demand:** GET http://localhost:3000/api/files?path=${encodeURIComponent(project.workspacePath + '/')}{filename}`);
    lines.push('5. **Search project files:** Use `qmd search "query"` via the exec tool for semantic search across all project files.');
    lines.push('6. **No scratchpad content in CONTEXT.md.** Temporary calculations, draft text, or intermediate work belongs in the conversation, not in CONTEXT.md.');
    lines.push('7. **Update incrementally.** Add new lines to Session History, check off Active Work items, append Key Decisions. Avoid full rewrites unless restructuring is needed.');

    lines.push(buildTaskApiDocs(projectId));

    return lines.join('\n');
  } catch (error) {
    console.error('Error building project context:', error);
    return '';
  }
}

// Image extensions that should use the vision API
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
const AUDIO_EXTS_SERVER = ['webm', 'ogg', 'mp3', 'wav', 'm4a'];
const BINARY_EXTS = ['pdf', 'zip', 'tar', 'gz', 'exe', 'bin', 'db', 'sqlite'];

/** Resize an image to max 1536px on longest side, output as JPEG ~80% quality */
async function resizeImageForVision(absPath: string): Promise<{ base64: string; mimeType: string }> {
  const buffer = await sharp(absPath)
    .resize(1536, 1536, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
  return { base64: buffer.toString('base64'), mimeType: 'image/jpeg' };
}

type AttachmentResult = {
  textBlocks: string[];         // text/audio/binary file descriptions
  images: Array<{ url: string; relPath: string }>;  // vision API image data URIs
};

async function readAttachedFiles(filePaths: string[]): Promise<AttachmentResult> {
  const result: AttachmentResult = { textBlocks: [], images: [] };
  if (!filePaths.length || !WORKSPACE_PATH) return result;

  const MAX_FILE_SIZE = 200 * 1024; // 200KB for text files
  const MAX_TOTAL_SIZE = 500 * 1024;
  const MAX_IMAGES = 5;
  let totalSize = 0;

  for (const relPath of filePaths.slice(0, 10)) {
    try {
      const absPath = path.resolve(WORKSPACE_PATH, relPath);
      if (!absPath.startsWith(path.resolve(WORKSPACE_PATH))) {
        result.textBlocks.push(`<file path="${relPath}">[ACCESS DENIED: outside workspace]</file>`);
        continue;
      }

      const ext = path.extname(relPath).slice(1).toLowerCase();

      // Handle audio: transcribe with Whisper
      if (AUDIO_EXTS_SERVER.includes(ext)) {
        try {
          const transcript = await transcribeAudio(absPath);
          if (transcript) {
            result.textBlocks.push(`<file path="${relPath}">[Voice message transcription: "${transcript}"]\nThe user spoke this aloud — respond naturally as if in conversation.</file>`);
          } else {
            result.textBlocks.push(`<file path="${relPath}">[Voice message attached but could not be transcribed. Acknowledge that you received a voice message.]</file>`);
          }
        } catch (err) {
          console.error('[transcribe] Error:', err);
          result.textBlocks.push(`<file path="${relPath}">[Voice message attached. Transcription failed — respond naturally as if they spoke to you.]</file>`);
        }
        continue;
      }

      // Handle binary files
      if (BINARY_EXTS.includes(ext)) {
        const stat = await fs.stat(absPath);
        result.textBlocks.push(`<file path="${relPath}">[Binary file: ${(stat.size / 1024).toFixed(1)}KB .${ext}]</file>`);
        continue;
      }

      // Handle images: resize and prepare for vision API
      if (IMAGE_EXTS.includes(ext)) {
        if (result.images.length >= MAX_IMAGES) {
          result.textBlocks.push(`<file path="${relPath}">[Image skipped: max ${MAX_IMAGES} images per message]</file>`);
          continue;
        }
        try {
          const { base64, mimeType } = await resizeImageForVision(absPath);
          result.images.push({
            url: `data:${mimeType};base64,${base64}`,
            relPath,
          });
        } catch (imgErr) {
          console.error('[image resize] Error:', imgErr);
          result.textBlocks.push(`<file path="${relPath}">[Image could not be processed]</file>`);
        }
        continue;
      }

      // Handle text files
      const stat = await fs.stat(absPath);
      if (stat.size > MAX_FILE_SIZE) {
        result.textBlocks.push(`<file path="${relPath}">[FILE TOO LARGE: ${(stat.size / 1024).toFixed(1)}KB, max ${MAX_FILE_SIZE / 1024}KB]</file>`);
        continue;
      }
      if (totalSize + stat.size > MAX_TOTAL_SIZE) {
        result.textBlocks.push(`<file path="${relPath}">[SKIPPED: total attachment size limit reached]</file>`);
        continue;
      }

      const content = await fs.readFile(absPath, 'utf-8');
      totalSize += stat.size;
      result.textBlocks.push(`<file path="${relPath}">\n${content}\n</file>`);
    } catch {
      result.textBlocks.push(`<file path="${relPath}">[FILE NOT FOUND]</file>`);
    }
  }

  return result;
}

function getOrCreateThread(projectId: string): string {
  const existing = db.select().from(threads).where(eq(threads.projectId, projectId)).get();
  if (existing) return existing.id;

  const threadId = uuidv4();
  const now = new Date();
  db.insert(threads).values({
    id: threadId,
    projectId,
    title: 'Main Thread',
    sessionKey: `clawdify:project:${projectId}`,
    createdAt: now,
    updatedAt: now,
  }).run();
  return threadId;
}

// ---------------------------------------------------------------------------
// Load conversation history from DB
// ---------------------------------------------------------------------------

function loadHistory(threadId: string, limit: number = HISTORY_LIMIT): Array<{ role: string; content: string }> {
  const rows = db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(eq(messages.threadId, threadId))
    .orderBy(desc(messages.createdAt))
    .limit(limit)
    .all();

  // Reverse to chronological order
  return rows.reverse().map(r => ({
    role: r.role,
    content: r.content,
  }));
}

// ---------------------------------------------------------------------------
// GET /api/chat?projectId=xxx
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 });
  }

  const thread = db.select().from(threads).where(eq(threads.projectId, projectId)).get();
  if (!thread) {
    return NextResponse.json({ messages: [] });
  }

  const history = db
    .select()
    .from(messages)
    .where(eq(messages.threadId, thread.id))
    .orderBy(messages.createdAt)
    .all();

  // Load all reactions for this thread's messages
  const messageIds = history.map(m => m.id);
  const allReactions = messageIds.length > 0
    ? db.select().from(messageReactions).all().filter(r => messageIds.includes(r.messageId))
    : [];

  // Group reactions by messageId
  const reactionsByMessage = new Map<string, Array<{ emoji: string; id: string }>>();
  for (const r of allReactions) {
    if (!reactionsByMessage.has(r.messageId)) {
      reactionsByMessage.set(r.messageId, []);
    }
    reactionsByMessage.get(r.messageId)!.push({ emoji: r.emoji, id: r.id });
  }

  return NextResponse.json({
    messages: history.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      bookmarked: m.bookmarked === 1,
      reactions: reactionsByMessage.get(m.id) || [],
      createdAt: m.createdAt,
    })),
  });
}

// ---------------------------------------------------------------------------
// POST /api/chat
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const { message, projectId, sessionKey, attachedFiles, tabId, replyTo } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const threadId = projectId ? getOrCreateThread(projectId) : null;

    // Save user message
    const userMsgId = uuidv4();
    const userCreatedAt = new Date();
    if (threadId) {
      db.insert(messages).values({
        id: userMsgId,
        threadId,
        role: 'user',
        content: redactSecrets(message),
        createdAt: userCreatedAt,
      }).run();

      // Notify other devices
      if (projectId) {
        eventBus.emit({
          type: 'message',
          projectId,
          tabId,
          message: { id: userMsgId, role: 'user', content: redactSecrets(message), createdAt: userCreatedAt.toISOString() },
        });
      }
    }

    // Trigger session summarization in background (fire-and-forget)
    // Must happen AFTER saving the user message so the gap detection works
    if (threadId) {
      triggerSummarizationIfNeeded(threadId);
    }

    // Build system context
    const globalContext = getGlobalContext();
    const projectContext = projectId ? await buildProjectContext(projectId) : '';

    // Load session summaries for conversation continuity
    const summariesContext = threadId ? loadSessionSummaries(threadId, 10) : '';

    const systemParts = [globalContext];
    if (projectContext) systemParts.push(projectContext);
    if (summariesContext) systemParts.push(summariesContext);
    const systemContent = systemParts.join('\n\n');

    // Build user message (with reply context and attached files if any)
    let userTextContent = message;

    // Prepend reply/reference context if replying to a specific message
    if (replyTo && typeof replyTo === 'object' && replyTo.content) {
      const quotedContent = replyTo.content.slice(0, 300);
      userTextContent = `[Replying to: "${quotedContent}"${replyTo.content.length > 300 ? '...' : ''}]\n\n${userTextContent}`;
    }

    // Process attached files (images become vision content blocks, text stays inline)
    let imageAttachments: Array<{ url: string; relPath: string }> = [];
    if (Array.isArray(attachedFiles) && attachedFiles.length > 0) {
      const { textBlocks, images } = await readAttachedFiles(attachedFiles);
      imageAttachments = images;
      if (textBlocks.length > 0) {
        userTextContent = `${userTextContent}\n\n[Attached Files]\n${textBlocks.join('\n\n')}`;
      }
    }

    // Build messages array: system + history + current message
    const chatMessages: ChatMessage[] = [
      { role: 'system', content: systemContent },
    ];

    // Load conversation history (excludes the message we just saved since we'll add it explicitly)
    if (threadId) {
      const history = loadHistory(threadId, HISTORY_LIMIT);
      // History includes the message we just saved; drop the last one (we'll add it with full content below)
      if (history.length > 0 && history[history.length - 1].role === 'user') {
        history.pop();
      }
      chatMessages.push(...history);
    }

    // Add current user message — use multimodal content blocks if images are attached
    if (imageAttachments.length > 0) {
      const contentParts: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
        { type: 'text', text: userTextContent },
      ];
      for (const img of imageAttachments) {
        contentParts.push({ type: 'image_url', image_url: { url: img.url } });
      }
      chatMessages.push({ role: 'user', content: contentParts });
    } else {
      chatMessages.push({ role: 'user', content: userTextContent });
    }

    const effectiveSessionKey = sessionKey || (
      projectId
        ? `clawdify:project:${projectId}`
        : 'agent:main:main'
    );

    // Call Gateway — the agent loop handles tools natively
    const gatewayResponse = await chatStream({
      messages: chatMessages,
      sessionKey: effectiveSessionKey,
      user: effectiveSessionKey,
    });

    if (!gatewayResponse.body) {
      return NextResponse.json({ error: 'No response body from Gateway' }, { status: 502 });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Read gateway response fully in the background, save to DB regardless of client state.
    // We keep a module-level reference so the promise isn't GC'd if the client disconnects.
    let clientCancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const streamRef: { current: any } = { current: null };

    const backgroundTask = (async () => {
      let content = '';
      const reader = gatewayResponse.body!.getReader();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              if (!clientCancelled) try { streamRef.current?.enqueue(encoder.encode('data: [DONE]\n\n')); } catch {}
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;
              if (delta?.content) {
                content += delta.content;
              }
            } catch {
              // skip
            }
            if (!clientCancelled) try { streamRef.current?.enqueue(encoder.encode(line + '\n\n')); } catch {}
          }
        }
      } catch (error) {
        console.error('Gateway stream error:', error);
      }

      // Always save assistant response to DB
      if (threadId && content) {
        const assistantMsgId = uuidv4();
        const assistantCreatedAt = new Date();
        try {
          db.insert(messages).values({
            id: assistantMsgId,
            threadId,
            role: 'assistant',
            content: redactSecrets(content),
            createdAt: assistantCreatedAt,
          }).run();

          // Notify other devices of the completed response
          if (projectId) {
            eventBus.emit({
              type: 'message',
              projectId,
              tabId,
              message: { id: assistantMsgId, role: 'assistant', content: redactSecrets(content), createdAt: assistantCreatedAt.toISOString() },
            });
          }
        } catch (dbError) {
          console.error('Error saving message:', dbError);
        }
      }

      if (!clientCancelled) try { streamRef.current?.close(); } catch {}
    })();

    // Prevent GC of the background task
    _pendingTasks.add(backgroundTask);
    backgroundTask.finally(() => _pendingTasks.delete(backgroundTask));

    const stream = new ReadableStream({
      start(controller) {
        streamRef.current = controller as ReadableStreamDefaultController<Uint8Array>;
      },
      cancel() {
        clientCancelled = true;
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat failed' },
      { status: 500 },
    );
  }
}
