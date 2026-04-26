import { NextRequest, NextResponse } from 'next/server';
import { chatStream, type ChatMessage, type ChatStreamResult } from '@/lib/gateway/client';
import { db, messages, threads, projects, settings, vault, messageReactions } from '@/lib/db';
import { eq, desc, like, and, lt, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { redactSecrets } from '@/lib/redact';
import { eventBus } from '@/lib/event-bus';
import { registerActiveGatewayRun } from '@/lib/gateway/active-runs';
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

const DEFAULT_GLOBAL_PROMPT = `Never share API keys or secrets in chat. All credentials are stored in the shared vault (.env). Reference them by name, never paste actual values.\n\nClawdify attachment rule: when sending a generated or workspace file back to the user in this Clawdify webchat, do not use MEDIA: directives because OpenClaw strips them before Clawdify can save/render them. Put each attachment path on its own line as CLAWDIFY_FILE:<path-or-url> instead. Use workspace-relative paths when possible, e.g. CLAWDIFY_FILE:_uploads/example.png.`;

const DUPLICATE_USER_WINDOW_MS = 2 * 60 * 1000;

function asTimeMs(value: Date | number | string): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value < 1e12 ? value * 1000 : value;
  return new Date(value).getTime();
}

function sseDoneResponse(reason: string, status = 202): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`: ${reason}\n\n`));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(stream, {
    status,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

function findRecentDuplicateUserMessage(opts: {
  threadId: string;
  clientMessageId: string | null;
  message: string;
  attachedFilesJson: string | null;
  replyToId: string | null;
}) {
  const { threadId, clientMessageId, message, attachedFilesJson, replyToId } = opts;

  if (clientMessageId) {
    const existingByClientId = db.select().from(messages)
      .where(and(
        eq(messages.threadId, threadId),
        eq(messages.role, 'user'),
        eq(messages.clientMessageId, clientMessageId),
      ))
      .get();
    if (existingByClientId) return existingByClientId;
  }

  // Secondary safety net for browser/proxy retries that don't preserve a client key.
  // Avoid blocking short intentional repeats like "so?".
  if (message.trim().length < 10) return null;

  const cutoff = Date.now() - DUPLICATE_USER_WINDOW_MS;
  const recent = db.select().from(messages)
    .where(and(
      eq(messages.threadId, threadId),
      eq(messages.role, 'user'),
      eq(messages.content, redactSecrets(message)),
    ))
    .orderBy(desc(messages.createdAt))
    .limit(10)
    .all();

  return recent.find((m) =>
    asTimeMs(m.createdAt) >= cutoff &&
    (m.attachedFiles || null) === attachedFilesJson &&
    (m.replyToId || null) === replyToId
  ) || null;
}

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
      replyTo: m.replyToId ? { id: m.replyToId, content: m.replyToContent, role: m.replyToRole } : undefined,
      createdAt: m.createdAt,
    })),
  });
}

// ---------------------------------------------------------------------------
// POST /api/chat
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const { message, projectId, sessionKey, attachedFiles, tabId, replyTo, clientMessageId } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const requestId = uuidv4().slice(0, 8);
    console.log('[chat] POST received | reqId:', requestId, '| tabId:', tabId, '| projectId:', projectId, '| msg:', message.slice(0, 60), '| time:', new Date().toISOString());

    const threadId = projectId ? getOrCreateThread(projectId) : null;
    const normalizedClientMessageId = typeof clientMessageId === 'string' && clientMessageId.trim()
      ? clientMessageId.trim().slice(0, 160)
      : null;

    // Save user message
    const userMsgId = uuidv4();
    const userCreatedAt = new Date();
    // Serialize attachment info for DB storage
    const attachedFilesJson = Array.isArray(attachedFiles) && attachedFiles.length > 0
      ? JSON.stringify(attachedFiles.map((fp: string) => ({ path: fp, name: fp.split('/').pop() || fp })))
      : null;

    // Resolve reply-to metadata
    let replyToId: string | null = null;
    let replyToContent: string | null = null;  // Short snippet for UI display
    let replyToRole: string | null = null;
    let replyToFullContent: string | null = null;  // Full content for LLM context
    if (replyTo && typeof replyTo === 'object' && replyTo.id) {
      replyToId = replyTo.id;
      // Look up the full original message from DB
      const origMsg = db.select({ role: messages.role, content: messages.content }).from(messages).where(eq(messages.id, replyTo.id)).get();
      replyToRole = origMsg?.role || (replyTo.role || null);
      replyToFullContent = origMsg?.content || replyTo.content || null;
      replyToContent = (replyToFullContent || '').slice(0, 200);  // Short snippet for DB/UI
    }

    if (threadId) {
      const duplicate = findRecentDuplicateUserMessage({
        threadId,
        clientMessageId: normalizedClientMessageId,
        message,
        attachedFilesJson,
        replyToId,
      });
      if (duplicate) {
        console.warn('[chat] Duplicate user message blocked | reqId:', requestId, '| existingMsgId:', duplicate.id, '| clientMessageId:', normalizedClientMessageId);
        return sseDoneResponse('duplicate user message ignored');
      }

      console.log('[chat] Saving user msg | reqId:', requestId, '| msgId:', userMsgId, '| threadId:', threadId);
      db.insert(messages).values({
        id: userMsgId,
        threadId,
        role: 'user',
        content: redactSecrets(message),
        clientMessageId: normalizedClientMessageId,
        attachedFiles: attachedFilesJson,
        replyToId,
        replyToContent: replyToContent ? redactSecrets(replyToContent) : null,
        replyToRole,
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
            replyTo: replyToId ? { id: replyToId, content: replyToContent, role: replyToRole } : undefined,
            createdAt: userCreatedAt.toISOString(),
          },
        });
      }
    }

    // Build minimal system context — just global prompt + project scoping
    // OpenClaw handles full session memory, context, and compaction natively.
    const globalContext = getGlobalContext();
    const projectContext = projectId ? buildProjectContext(projectId) : '';
    const clawdifyAttachmentRule = 'Clawdify attachment rule: when sending a generated or workspace file back to the user in this Clawdify webchat, do not use MEDIA: directives because OpenClaw strips them before Clawdify can save/render them. Put each attachment path on its own line as CLAWDIFY_FILE:<path-or-url> instead. Use workspace-relative paths when possible, e.g. CLAWDIFY_FILE:_uploads/example.png.';

    const systemParts = [globalContext, clawdifyAttachmentRule];
    if (projectContext) systemParts.push(projectContext);
    const systemContent = systemParts.join('\n\n');

    // Build user message (with reply context and attached files if any)
    let userTextContent = message;

    // Prepend reply/reference context if replying to a specific message
    // Use the full original message from DB for LLM context (not the truncated UI snippet)
    if (replyToFullContent) {
      userTextContent = `[Replying to: "${replyToFullContent}"]\n\n${userTextContent}`;
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
    console.log('[chat] SSE stream starting | reqId:', requestId, '| sessionKey:', effectiveSessionKey);
    const gatewayAbort = new AbortController();
    const unregisterGatewayRun = registerActiveGatewayRun(effectiveSessionKey, requestId, gatewayAbort);
    let gatewayResponse: Response;
    let usedFallback = false;
    let fallbackModel: string | undefined;
    try {
      const streamResult = await chatStream({
        messages: chatMessages,
        sessionKey: effectiveSessionKey,
        user: effectiveSessionKey,
        signal: gatewayAbort.signal,
      });
      gatewayResponse = streamResult.response;
      usedFallback = streamResult.usedFallback;
      fallbackModel = streamResult.fallbackModel;
    } catch (error) {
      unregisterGatewayRun();
      throw error;
    }

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

    // SSE keepalive: send a comment every 15s during silent periods (tool use, thinking)
    // to prevent browsers/proxies from killing the connection
    const keepaliveInterval = setInterval(() => {
      if (!clientCancelled) {
        try { streamRef.current?.enqueue(encoder.encode(': keepalive\n\n')); } catch {}
      }
    }, 15000);

    // Helper: read an SSE stream from the gateway, forwarding chunks to the client.
    // Returns the accumulated text content.
    async function consumeGatewayStream(
      body: ReadableStream<Uint8Array>,
      opts: { prependNotice?: string } = {}
    ): Promise<string> {
      let content = '';
      const reader = body.getReader();
      let buffer = '';

      if (opts.prependNotice) {
        content += opts.prependNotice;
        if (!clientCancelled) {
          try {
            const noticeChunk = JSON.stringify({
              choices: [{ delta: { content: opts.prependNotice } }]
            });
            streamRef.current?.enqueue(encoder.encode(`data: ${noticeChunk}\n\n`));
          } catch {}
        }
      }

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
              // Don't forward [DONE] yet — we may need to retry with fallback
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

      return content;
    }

    const backgroundTask = (async () => {
      // --- First attempt (primary model via gateway) ---
      let content = await consumeGatewayStream(gatewayResponse.body!, {
        prependNotice: usedFallback
          ? `⚠️ **Primary model overloaded** — using ${fallbackModel || 'fallback model'} instead.\n\n`
          : undefined,
      });

      console.log('[chat] SSE primary stream ended | reqId:', requestId, '| contentLen:', content.length, '| clientCancelled:', clientCancelled);

      // Do not retry by re-sending the same user message here. This endpoint is
      // stateful: every gateway call appends another user turn to the OpenClaw
      // session. Empty streams should fail visibly and let the user manually retry
      // with a new clientMessageId.
      if (content.trim().length === 0) {
        console.warn('[chat] Empty gateway response — not retrying to avoid duplicate user turn | reqId:', requestId);
      }

      // Send final [DONE] to client
      if (!clientCancelled) try { streamRef.current?.enqueue(encoder.encode('data: [DONE]\n\n')); } catch {}

      clearInterval(keepaliveInterval);

      // Skip NO_REPLY directives — these are system signals, not real messages
      const trimmedContent = content.trim();
      const isNoReply = trimmedContent === 'NO_REPLY' || trimmedContent === 'NO' || trimmedContent === 'NO_RE' || trimmedContent === 'NO_REP' || trimmedContent === 'NO_REPL';

      console.log('[chat] SSE stream ended | reqId:', requestId, '| contentLen:', content.length, '| isNoReply:', isNoReply, '| clientCancelled:', clientCancelled);

      // Always save assistant response to DB (unless it's a NO_REPLY directive)
      if (threadId && content && !isNoReply) {
        const assistantMsgId = uuidv4();
        const assistantCreatedAt = new Date();
        console.log('[chat] Saving assistant msg | reqId:', requestId, '| msgId:', assistantMsgId, '| preview:', content.slice(0, 80));
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
    backgroundTask.finally(() => {
      unregisterGatewayRun();
      _pendingTasks.delete(backgroundTask);
    });

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
