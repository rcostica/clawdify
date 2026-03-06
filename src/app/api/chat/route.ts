import { NextRequest, NextResponse } from 'next/server';
import { chatStream, type ChatMessage } from '@/lib/gateway/client';
import { db, messages, threads, projects, settings, vault, messageReactions } from '@/lib/db';
import { eq, desc, like, and, lt, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { redactSecrets } from '@/lib/redact';
import { eventBus } from '@/lib/event-bus';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const WORKSPACE_PATH = process.env.OPENCLAW_WORKSPACE_PATH || '';
// Session fully managed by OpenClaw (context, compaction, memory).
// Clawdify is a thin pipe: send current message only, no history.

// Whisper transcription via whisper-wrapper.sh (whisper.cpp + ffmpeg)
const WHISPER_WRAPPER = '/usr/local/bin/whisper-wrapper.sh';
const WHISPER_MODEL = '/opt/whisper.cpp/models/ggml-base.bin';

/**
 * Transcribe an audio file using whisper.cpp (local, CPU).
 * Returns the transcription text, or empty string on failure.
 */
async function transcribeAudio(audioPath: string): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync(WHISPER_WRAPPER, [
      '-m', WHISPER_MODEL,
      '-l', 'en',
      '-f', audioPath,
    ], {
      timeout: 60_000,
    });
    if (stderr) console.warn('[transcribe] stderr:', stderr);
    // whisper-cli output has timestamps like [00:00:00.000 --> 00:00:07.000]  text
    // Extract just the text, stripping timestamp prefixes
    const text = stdout
      .split('\n')
      .map(line => line.replace(/^\[[\d:.]+\s*-->\s*[\d:.]+\]\s*/, '').trim())
      .filter(Boolean)
      .join(' ')
      .trim();
    return text;
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
// Minimal context — project scoping only, OpenClaw handles the rest
// ---------------------------------------------------------------------------

function getGlobalContext(): string {
  const row = db.select().from(settings).where(eq(settings.key, 'global_system_prompt')).get();
  return row?.value ?? DEFAULT_GLOBAL_PROMPT;
}

/**
 * Build meta-context for the General project: summary of all projects + vault + API instructions.
 */
function isGeneralProject(projectId: string): boolean {
  const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
  if (!project) return false;
  return project.name.toLowerCase() === 'general';
}

/**
 * Build minimal project context (~200-500 tokens).
 * Just tells the AI which project it's in and where to look.
 * OpenClaw handles everything else (memory, context, compaction).
 */
function buildProjectContext(projectId: string): string {
  try {
    const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
    if (!project) return '';

    if (isGeneralProject(projectId)) {
      // General project: list all projects so the AI knows what exists
      const allProjects = db.select().from(projects).all();
      const projectList = allProjects
        .map(p => `- ${p.icon || '📁'} ${p.name} [${p.status}] — workspace: ${p.workspacePath}`)
        .join('\n');

      return [
        `[Command Center — General Project | id: ${projectId}]`,
        `Workspace: ${project.workspacePath}/`,
        '',
        `All projects (${allProjects.length}):`,
        projectList,
        '',
        'Clawdify API: http://localhost:3000/api/ (projects, tasks, vault, files)',
        'Read workspace files on demand. OpenClaw manages session context.',
      ].join('\n');
    }

    return [
      `[Project: ${project.name} | workspace: ${project.workspacePath}/ | id: ${projectId}]`,
      project.description ? `Description: ${project.description}` : '',
      'Read CONTEXT.md in the workspace for project state, decisions, and active work.',
      'Clawdify API: http://localhost:3000/api/ (projects, tasks, vault, files)',
    ].filter(Boolean).join('\n');
  } catch (error) {
    console.error('Error building project context:', error);
    return '';
  }
}

// NOTE: The following large functions have been removed in the thin-pipe cleanup.
// They are preserved in git history (commit 8c6bb76) if ever needed:
// - buildGeneralContext(), buildFileManifest(), loadInheritedContext()
// - checkStaleness(), parseContextSections(), readFirstLine(), collectFiles()
// - buildTaskApiDocs(), loadSessionSummaries()
// OpenClaw now handles session memory, context, and compaction natively.



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
  // Pick the most recently created thread for this project (supports session reset)
  const existing = db.select().from(threads)
    .where(eq(threads.projectId, projectId))
    .orderBy(desc(threads.createdAt))
    .limit(1)
    .get();
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
// GET /api/chat?projectId=xxx
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 });
  }

  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '50', 10), 200);
  const beforeParam = request.nextUrl.searchParams.get('before'); // ISO timestamp cursor

  const sessionKey = `clawdify:${projectId}`;

  // Load ALL threads for this project — including archived threads from old session rotations
  const currentThreads = db.select().from(threads)
    .where(eq(threads.projectId, projectId))
    .all();
  const archivedThreads = db.select().from(threads)
    .where(like(threads.projectId, `archived-${projectId}%`))
    .all();
  const allThreads = [...currentThreads, ...archivedThreads]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  if (!allThreads.length) {
    return NextResponse.json({ messages: [], sessionKey, hasMore: false });
  }

  const threadIds = allThreads.map(t => t.id);

  // Load messages from all threads, sorted newest-first for pagination
  let allMsgs = db.select().from(messages).all()
    .filter(m => threadIds.includes(m.threadId));
  allMsgs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Apply cursor filter (messages strictly before the cursor timestamp)
  if (beforeParam) {
    const cursorTime = new Date(beforeParam).getTime();
    allMsgs = allMsgs.filter(m => new Date(m.createdAt).getTime() < cursorTime);
  }

  // Check if there are more beyond the limit
  const hasMore = allMsgs.length > limit;

  // Take `limit` messages (newest first) then reverse for chronological order
  const paginated = allMsgs.slice(0, limit).reverse();

  // Load reactions for these messages
  const messageIds = paginated.map(m => m.id);
  const allReactions = messageIds.length > 0
    ? db.select().from(messageReactions).all().filter(r => messageIds.includes(r.messageId))
    : [];

  const reactionsByMessage = new Map<string, Array<{ emoji: string; id: string }>>();
  for (const r of allReactions) {
    if (!reactionsByMessage.has(r.messageId)) {
      reactionsByMessage.set(r.messageId, []);
    }
    reactionsByMessage.get(r.messageId)!.push({ emoji: r.emoji, id: r.id });
  }

  return NextResponse.json({
    threadId: allThreads[allThreads.length - 1].id,
    sessionKey,
    hasMore,
    messages: paginated.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      bookmarked: m.bookmarked === 1,
      reactions: reactionsByMessage.get(m.id) || [],
      attachedFiles: m.attachedFiles ? JSON.parse(m.attachedFiles) : undefined,
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
    // Serialize attachment info for DB storage
    const attachedFilesJson = Array.isArray(attachedFiles) && attachedFiles.length > 0
      ? JSON.stringify(attachedFiles.map((fp: string) => ({ path: fp, name: fp.split('/').pop() || fp })))
      : null;

    if (threadId) {
      db.insert(messages).values({
        id: userMsgId,
        threadId,
        role: 'user',
        content: redactSecrets(message),
        attachedFiles: attachedFilesJson,
        createdAt: userCreatedAt,
      }).run();

      // Notify other devices
      if (projectId) {
        eventBus.emit({
          type: 'message',
          projectId,
          tabId,
          message: {
            id: userMsgId,
            role: 'user',
            content: redactSecrets(message),
            attachedFiles: attachedFilesJson ? JSON.parse(attachedFilesJson) : undefined,
            createdAt: userCreatedAt.toISOString(),
          },
        });
      }
    }

    // Build minimal system context — just global prompt + project scoping
    // OpenClaw handles full session memory, context, and compaction natively.
    const globalContext = getGlobalContext();
    const projectContext = projectId ? buildProjectContext(projectId) : '';

    const systemParts = [globalContext];
    if (projectContext) systemParts.push(projectContext);
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
      console.log('[chat] attachedFiles received:', JSON.stringify(attachedFiles));
      const { textBlocks, images } = await readAttachedFiles(attachedFiles);
      console.log('[chat] readAttachedFiles result: textBlocks=%d, images=%d', textBlocks.length, images.length);
      if (textBlocks.length > 0) console.log('[chat] textBlocks:', textBlocks.map(b => b.slice(0, 100)));
      if (images.length > 0) console.log('[chat] images:', images.map(i => ({ relPath: i.relPath, urlLen: i.url.length })));
      imageAttachments = images;
      if (textBlocks.length > 0) {
        userTextContent = `${userTextContent}\n\n[Attached Files]\n${textBlocks.join('\n\n')}`;
      }
    } else {
      console.log('[chat] No attachedFiles in payload. Raw attachedFiles value:', attachedFiles);
    }

    // Build messages array: system + history + current message
    const chatMessages: ChatMessage[] = [
      { role: 'system', content: systemContent },
    ];

    // No history sent — OpenClaw manages the full session transcript.
    // Just send the current user message.

    // Add current user message
    // Note: The OpenClaw gateway's /v1/chat/completions endpoint extracts only text
    // from content arrays (image_url blocks are silently dropped). So we include
    // image file paths in the text so the AI can use its `image` tool to view them.
    if (imageAttachments.length > 0) {
      const imageRefs = imageAttachments.map(img => img.relPath).join(', ');
      userTextContent = `${userTextContent}\n\n[Attached Images: ${imageRefs}]\nThe user attached ${imageAttachments.length} image(s) to this message. The images are saved in the workspace. Use the image analysis tool to view them if needed. Workspace path: ${WORKSPACE_PATH}`;
    }
    chatMessages.push({ role: 'user', content: userTextContent });

    // Stable session key per project — no thread ID.
    // OpenClaw's daily reset and compaction apply naturally.
    const effectiveSessionKey = projectId
      ? `clawdify:${projectId}`
      : 'agent:main:main';

    // Call Gateway — the agent loop handles tools natively
    console.log('[chat] Sending to gateway: %d messages, last msg content type=%s',
      chatMessages.length,
      Array.isArray(chatMessages[chatMessages.length - 1]?.content) 
        ? `multimodal[${(chatMessages[chatMessages.length - 1].content as Array<{type:string}>).map(p => p.type).join(',')}]`
        : 'text'
    );
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
