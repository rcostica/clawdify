import { NextRequest, NextResponse } from 'next/server';
import { chatStream } from '@/lib/gateway/client';
import { db, messages, threads, projects } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

const WORKSPACE_PATH = process.env.OPENCLAW_WORKSPACE_PATH || '';

/**
 * Build project context to prepend to user messages.
 */
async function buildProjectContext(projectId: string): Promise<string> {
  try {
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

    return lines.join('\n');
  } catch (error) {
    console.error('Error building project context:', error);
    return '';
  }
}

/**
 * Read attached files and format them as context blocks.
 */
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

      const content = await fs.readFile(absPath, 'utf-8');
      totalSize += stat.size;
      blocks.push(`<file path="${relPath}">\n${content}\n</file>`);
    } catch {
      blocks.push(`<file path="${relPath}">[FILE NOT FOUND]</file>`);
    }
  }

  return blocks.join('\n\n');
}

/**
 * Get or create the default thread for a project.
 */
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

// GET /api/chat?projectId=xxx — load chat history
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

// POST /api/chat — send message + stream response
export async function POST(request: NextRequest) {
  try {
    const { message, projectId, sessionKey, attachedFiles } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Get or create thread for this project
    const threadId = projectId ? getOrCreateThread(projectId) : null;

    // Save user message to DB
    const userMsgId = uuidv4();
    if (threadId) {
      db.insert(messages).values({
        id: userMsgId,
        threadId,
        role: 'user',
        content: message,
        createdAt: new Date(),
      }).run();
    }

    // Build project context
    let fullMessage = message;
    if (projectId) {
      const context = await buildProjectContext(projectId);
      if (context) {
        fullMessage = `${context}\n\n[User Message]\n${message}`;
      }
    }

    // Attach referenced files
    if (Array.isArray(attachedFiles) && attachedFiles.length > 0) {
      const fileContext = await readAttachedFiles(attachedFiles);
      if (fileContext) {
        fullMessage = `${fullMessage}\n\n[Attached Files]\n${fileContext}`;
      }
    }

    // Determine session key
    const effectiveSessionKey = sessionKey || (
      projectId
        ? `clawdify:project:${projectId}`
        : 'agent:main:main'
    );

    // Call Gateway with streaming
    const gatewayResponse = await chatStream({
      messages: [{ role: 'user', content: fullMessage }],
      sessionKey: effectiveSessionKey,
    });

    if (!gatewayResponse.body) {
      return NextResponse.json({ error: 'No response body from Gateway' }, { status: 502 });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let fullContent = '';

    const stream = new ReadableStream({
      async start(controller) {
        const reader = gatewayResponse.body!.getReader();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });

            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                  continue;
                }
                try {
                  const parsed = JSON.parse(data);
                  const delta = parsed.choices?.[0]?.delta?.content;
                  if (delta) {
                    fullContent += delta;
                  }
                } catch {
                  // skip
                }
              }
            }

            controller.enqueue(value);
          }
        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        } finally {
          // Save assistant message to DB
          if (threadId && fullContent) {
            try {
              db.insert(messages).values({
                id: uuidv4(),
                threadId,
                role: 'assistant',
                content: fullContent,
                createdAt: new Date(),
              }).run();
            } catch (dbError) {
              console.error('Error saving message:', dbError);
            }
          }
          controller.close();
        }
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
      { status: 500 }
    );
  }
}
