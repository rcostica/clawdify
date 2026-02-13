import { NextRequest, NextResponse } from 'next/server';
import { db, projects, threads, messages } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { logAudit } from '@/lib/audit';
import { redactSecrets } from '@/lib/redact';
import fs from 'fs/promises';
import path from 'path';

const SESSIONS_PATH = process.env.OPENCLAW_SESSIONS_PATH || path.join(process.env.HOME || '/tmp', '.openclaw/agents/main/sessions');
const WORKSPACE_PATH = process.env.OPENCLAW_WORKSPACE_PATH || '';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, projectName } = await request.json();

    if (!sessionId || !projectName) {
      return NextResponse.json({ error: 'sessionId and projectName required' }, { status: 400 });
    }

    // Read the JSONL file
    const filePath = path.join(SESSIONS_PATH, `${sessionId}.jsonl`);
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    // Parse messages
    const parsedMessages: { role: 'user' | 'assistant' | 'system'; content: string; }[] = [];

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === 'message' && parsed.message?.role) {
          const role = parsed.message.role as 'user' | 'assistant' | 'system';
          let text = '';
          const contentField = parsed.message.content;
          if (Array.isArray(contentField)) {
            const textBlocks = contentField.filter((b: any) => b.type === 'text');
            text = textBlocks.map((b: any) => b.text).join('\n');
          } else if (typeof contentField === 'string') {
            text = contentField;
          }
          if (text && (role === 'user' || role === 'assistant')) {
            parsedMessages.push({ role, content: text });
          }
        }
      } catch {}
    }

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
        createdAt: new Date(now.getTime() + i * 1000), // offset for ordering
      }).run();
    }

    logAudit('session_imported', JSON.stringify({ sessionId, projectId, messageCount: parsedMessages.length }));

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
