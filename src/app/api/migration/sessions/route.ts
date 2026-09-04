import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import readline from 'readline';
import { listGatewaySessions } from '@/lib/gateway/sessions';

const SESSIONS_PATH = process.env.OPENCLAW_SESSIONS_PATH || path.join(process.env.HOME || '/tmp', '.openclaw/agents/main/sessions');

interface SessionInfo {
  id: string;
  source: 'gateway' | 'legacy';
  sessionKey?: string;
  filename?: string;
  messageCount?: number;
  firstMessage?: string;
  size?: number;
  modifiedAt: string;
}

async function listLegacySessions(): Promise<SessionInfo[]> {
  const entries = await fs.readdir(SESSIONS_PATH);
  const jsonlFiles = entries.filter(f => f.endsWith('.jsonl') && !f.includes('.deleted'));
  const sessions: SessionInfo[] = [];

  for (const filename of jsonlFiles) {
    const filePath = path.join(SESSIONS_PATH, filename);
    try {
      const stat = await fs.stat(filePath);
      let messageCount = 0;
      let firstUserMessage: string | undefined;

      // Some old transcripts are large. Stream them so opening legacy mode
      // does not materialize the entire archive in the Clawdify process.
      const lines = readline.createInterface({
        input: createReadStream(filePath, { encoding: 'utf-8' }),
        crlfDelay: Infinity,
      });
      for await (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'message' && parsed.message?.role) {
            messageCount++;
            if (!firstUserMessage && parsed.message.role === 'user') {
              const contentArr = parsed.message.content;
              if (Array.isArray(contentArr)) {
                const textBlock = contentArr.find((b: unknown) => {
                  return Boolean(b && typeof b === 'object' && (b as { type?: string }).type === 'text');
                }) as { text?: string } | undefined;
                if (textBlock) firstUserMessage = textBlock.text?.substring(0, 200);
              } else if (typeof contentArr === 'string') {
                firstUserMessage = contentArr.substring(0, 200);
              }
            }
          }
        } catch {}
      }

      if (messageCount > 0) {
        sessions.push({
          id: filename.replace('.jsonl', ''),
          source: 'legacy',
          filename,
          messageCount,
          firstMessage: firstUserMessage,
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
        });
      }
    } catch {}
  }

  return sessions;
}

async function listActiveStoreSessions(): Promise<{ sessions: SessionInfo[]; truncated: boolean }> {
  const result = await listGatewaySessions({
    includeArchived: true,
    includeDerivedTitles: true,
    includeLastMessage: true,
  });

  return {
    truncated: result.truncated,
    sessions: result.sessions
      .filter((session) => session.sessionId)
      .map((session) => ({
        id: session.sessionId!,
        source: 'gateway' as const,
        sessionKey: session.key,
        firstMessage: session.derivedTitle || session.displayName || session.label || session.lastMessagePreview,
        modifiedAt: new Date(session.updatedAt || 0).toISOString(),
      })),
  };
}

export async function GET(request: Request) {
  const requestedSource = new URL(request.url).searchParams.get('source');
  const source = requestedSource === 'legacy' ? 'legacy' : 'gateway';

  try {
    if (source === 'legacy') {
      const sessions = await listLegacySessions();
      sessions.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
      return NextResponse.json({ sessions, source, truncated: false });
    }

    const result = await listActiveStoreSessions();
    const sessions = result.sessions;
    sessions.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
    return NextResponse.json({ sessions, source, truncated: result.truncated });
  } catch (error) {
    console.error('Migration sessions error:', error);
    return NextResponse.json({
      error: source === 'gateway'
        ? 'Failed to read sessions from the OpenClaw Gateway'
        : 'Failed to read legacy session files',
    }, { status: 500 });
  }
}
