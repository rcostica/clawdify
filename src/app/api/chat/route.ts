import { NextRequest, NextResponse } from 'next/server';
import { chatStream } from '@/lib/gateway/client';
import { db, messages, threads, projects, settings, vault } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { redactSecrets } from '@/lib/redact';
import fs from 'fs/promises';
import path from 'path';

const WORKSPACE_PATH = process.env.OPENCLAW_WORKSPACE_PATH || '';
const HISTORY_LIMIT = 50;

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
      try {
        const files = await fs.readdir(projectDir);
        if (files.length > 0) {
          lines.push(`Project files: ${files.join(', ')}`);
        }

        const readmePath = path.join(projectDir, 'README.md');
        try {
          const readme = await fs.readFile(readmePath, 'utf-8');
          if (readme.length < 2000) {
            lines.push('', '--- Project README ---', readme);
          }
        } catch {
          // No README
        }
      } catch {
        // Directory doesn't exist yet
      }
    }

    lines.push(buildTaskApiDocs(projectId));

    return lines.join('\n');
  } catch (error) {
    console.error('Error building project context:', error);
    return '';
  }
}

async function readAttachedFiles(filePaths: string[]): Promise<string> {
  if (!filePaths.length || !WORKSPACE_PATH) return '';

  const blocks: string[] = [];
  const MAX_FILE_SIZE = 100 * 1024;
  const MAX_TOTAL_SIZE = 500 * 1024;
  let totalSize = 0;

  for (const relPath of filePaths.slice(0, 10)) {
    try {
      const absPath = path.resolve(WORKSPACE_PATH, relPath);
      if (!absPath.startsWith(path.resolve(WORKSPACE_PATH))) {
        blocks.push(`<file path="${relPath}">[ACCESS DENIED: outside workspace]</file>`);
        continue;
      }

      const stat = await fs.stat(absPath);
      if (stat.size > MAX_FILE_SIZE) {
        blocks.push(`<file path="${relPath}">[FILE TOO LARGE: ${(stat.size / 1024).toFixed(1)}KB, max 100KB]</file>`);
        continue;
      }

      if (totalSize + stat.size > MAX_TOTAL_SIZE) {
        blocks.push(`<file path="${relPath}">[SKIPPED: total attachment size limit reached]</file>`);
        continue;
      }

      const ext = path.extname(relPath).slice(1).toLowerCase();
      const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'];
      if (imageExts.includes(ext)) {
        const buffer = await fs.readFile(absPath);
        const base64 = buffer.toString('base64');
        totalSize += stat.size;
        blocks.push(`<file path="${relPath}" type="image/${ext === 'jpg' ? 'jpeg' : ext}">[Image: ${(stat.size / 1024).toFixed(1)}KB, base64-encoded]\ndata:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${base64}\n</file>`);
      } else {
        const content = await fs.readFile(absPath, 'utf-8');
        totalSize += stat.size;
        blocks.push(`<file path="${relPath}">\n${content}\n</file>`);
      }
    } catch {
      blocks.push(`<file path="${relPath}">[FILE NOT FOUND]</file>`);
    }
  }

  return blocks.join('\n\n');
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

  return NextResponse.json({
    messages: history.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    })),
  });
}

// ---------------------------------------------------------------------------
// POST /api/chat
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const { message, projectId, sessionKey, attachedFiles } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const threadId = projectId ? getOrCreateThread(projectId) : null;

    // Save user message
    const userMsgId = uuidv4();
    if (threadId) {
      db.insert(messages).values({
        id: userMsgId,
        threadId,
        role: 'user',
        content: redactSecrets(message),
        createdAt: new Date(),
      }).run();
    }

    // Build system context
    const globalContext = getGlobalContext();
    const projectContext = projectId ? await buildProjectContext(projectId) : '';
    const systemContent = projectContext
      ? `${globalContext}\n\n${projectContext}`
      : globalContext;

    // Build user message (with attached files if any)
    let userContent = message;
    if (Array.isArray(attachedFiles) && attachedFiles.length > 0) {
      const fileContext = await readAttachedFiles(attachedFiles);
      if (fileContext) {
        userContent = `${message}\n\n[Attached Files]\n${fileContext}`;
      }
    }

    // Build messages array: system + history + current message
    const chatMessages: Array<{ role: string; content: string }> = [
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

    // Add current user message (with attachments, unredacted)
    chatMessages.push({ role: 'user', content: userContent });

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

    // Read gateway stream independently so DB save happens even if client disconnects
    let clientCancelled = false;
    let streamController: ReadableStreamDefaultController | null = null;
    
    const gatewayPromise = (async () => {
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
              if (!clientCancelled) try { streamController?.enqueue(encoder.encode('data: [DONE]\n\n')); } catch {}
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
            if (!clientCancelled) try { streamController?.enqueue(encoder.encode(line + '\n\n')); } catch {}
          }
        }
      } catch (error) {
        console.error('Gateway stream error:', error);
      }

      // Always save assistant response to DB, even if client disconnected
      if (threadId && content) {
        try {
          db.insert(messages).values({
            id: uuidv4(),
            threadId,
            role: 'assistant',
            content: redactSecrets(content),
            createdAt: new Date(),
          }).run();
        } catch (dbError) {
          console.error('Error saving message:', dbError);
        }
      }

      if (!clientCancelled) try { streamController?.close(); } catch {}
    })();

    const stream = new ReadableStream({
      start(controller) {
        streamController = controller;
      },
      cancel() {
        clientCancelled = true;
        // gatewayPromise continues running — DB save will still happen
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
