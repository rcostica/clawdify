import { NextRequest, NextResponse } from 'next/server';
import { db, projects, threads, messages } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { logAudit } from '@/lib/audit';
import { redactSecrets } from '@/lib/redact';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import readline from 'readline';
import {
  ImportedSessionMessage,
  projectImportableMessage,
  readGatewaySessionMessages,
} from '@/lib/gateway/sessions';

const SESSIONS_PATH = process.env.OPENCLAW_SESSIONS_PATH || path.join(process.env.HOME || '/tmp', '.openclaw/agents/main/sessions');
const WORKSPACE_PATH = process.env.OPENCLAW_WORKSPACE_PATH || '';

async function readLegacySessionMessages(sessionId: string): Promise<ImportedSessionMessage[]> {
  if (!/^[a-zA-Z0-9._-]+$/.test(sessionId)) {
    throw new Error('Invalid legacy session id');
  }

  const filePath = path.join(SESSIONS_PATH, `${sessionId}.jsonl`);
  const messages: ImportedSessionMessage[] = [];
  const lines = readline.createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  for await (const line of lines) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      if (parsed.type !== 'message') continue;

      const message = projectImportableMessage({
        ...parsed.message,
        timestamp: parsed.message?.timestamp ?? parsed.timestamp,
      });
      if (message) messages.push(message);
    } catch {}
  }

  return messages;
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, sessionKey, projectName, source = 'legacy' } = await request.json();

    if (!sessionId || !projectName) {
      return NextResponse.json({ error: 'sessionId and projectName required' }, { status: 400 });
    }
    if (source !== 'gateway' && source !== 'legacy') {
      return NextResponse.json({ error: 'Invalid session source' }, { status: 400 });
    }
    if (source === 'gateway' && (!sessionKey || typeof sessionKey !== 'string')) {
      return NextResponse.json({ error: 'sessionKey required for Gateway import' }, { status: 400 });
    }

    const parsedMessages = source === 'gateway'
      ? await readGatewaySessionMessages(sessionKey)
      : await readLegacySessionMessages(sessionId);

    if (parsedMessages.length === 0) {
      return NextResponse.json({ error: 'No messages found in session' }, { status: 400 });
    }

    // Create project
    const projectId = uuidv4();
    const now = new Date();
    const folderName = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const workspacePath = `projects/${folderName}`;

    if (WORKSPACE_PATH) {
      const fullPath = path.join(WORKSPACE_PATH, workspacePath);
      await fs.mkdir(fullPath, { recursive: true });
    }

    db.insert(projects).values({
      id: projectId,
      name: projectName,
      description: `Imported from OpenClaw session ${sessionId.substring(0, 8)}`,
      icon: '📥',
      status: 'active',
      workspacePath,
      createdAt: now,
      updatedAt: now,
    }).run();

    // Create thread
    const threadId = uuidv4();
    db.insert(threads).values({
      id: threadId,
      projectId,
      title: 'Imported Conversation',
      sessionKey: `imported:${sessionId}`,
      createdAt: now,
      updatedAt: now,
    }).run();

    // Insert messages
    for (let i = 0; i < parsedMessages.length; i++) {
      const msg = parsedMessages[i];
      db.insert(messages).values({
        id: uuidv4(),
        threadId,
        role: msg.role,
        content: redactSecrets(msg.content),
        createdAt: new Date(msg.timestamp ?? now.getTime() + i * 1000),
      }).run();
    }

    logAudit('session_imported', JSON.stringify({
      sessionId,
      sessionKey: source === 'gateway' ? sessionKey : undefined,
      source,
      projectId,
      messageCount: parsedMessages.length,
    }));

    return NextResponse.json({
      success: true,
      projectId,
      messageCount: parsedMessages.length,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
