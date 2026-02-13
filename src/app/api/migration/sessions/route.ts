import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const SESSIONS_PATH = process.env.OPENCLAW_SESSIONS_PATH || path.join(process.env.HOME || '/tmp', '.openclaw/agents/main/sessions');

interface SessionInfo {
  id: string;
  filename: string;
  messageCount: number;
  firstMessage?: string;
  size: number;
  modifiedAt: string;
}

export async function GET() {
  try {
    const entries = await fs.readdir(SESSIONS_PATH);
    const jsonlFiles = entries.filter(f => f.endsWith('.jsonl') && !f.includes('.deleted'));

    const sessions: SessionInfo[] = [];

    for (const filename of jsonlFiles) {
      const filePath = path.join(SESSIONS_PATH, filename);
      try {
        const stat = await fs.stat(filePath);
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n').filter(l => l.trim());

        let messageCount = 0;
        let firstUserMessage: string | undefined;

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === 'message' && parsed.message?.role) {
              messageCount++;
              if (!firstUserMessage && parsed.message.role === 'user') {
                const contentArr = parsed.message.content;
                if (Array.isArray(contentArr)) {
                  const textBlock = contentArr.find((b: any) => b.type === 'text');
                  if (textBlock) {
                    firstUserMessage = textBlock.text?.substring(0, 200);
                  }
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
            filename,
            messageCount,
            firstMessage: firstUserMessage,
            size: stat.size,
            modifiedAt: stat.mtime.toISOString(),
          });
        }
      } catch {}
    }

    // Sort by modified date, newest first
    sessions.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Migration sessions error:', error);
    return NextResponse.json({ error: 'Failed to read sessions' }, { status: 500 });
  }
}
