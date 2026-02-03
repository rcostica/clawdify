/**
 * Import Sessions from Gateway
 *
 * Fetches existing sessions from the Gateway, creates Clawdify projects,
 * imports chat history, and detects artifacts.
 */

import { getGatewayClient } from '@/lib/gateway/hooks';
import { createClient } from '@/lib/supabase/client';
import { detectArtifacts } from '@/lib/artifacts/detector';
import type { ChatMessage } from '@/stores/chat-store';

// ── Types for Gateway session list ──

export interface GatewaySession {
  key: string;
  label?: string | null;
  agentId?: string;
  derivedTitle?: string | null;
  lastMessage?: string | null;
  updatedAt?: string;
  createdAt?: string;
  model?: string | null;
  spawnedBy?: string | null;
  /** We add this client-side after counting */
  messageCount?: number;
}

export interface ImportProgress {
  phase: 'listing' | 'importing' | 'done' | 'error';
  total: number;
  completed: number;
  currentSession?: string;
  error?: string;
}

// ── Fetch sessions from Gateway ──

export async function fetchGatewaySessions(): Promise<GatewaySession[]> {
  const client = getGatewayClient();
  if (!client.isConnected) {
    throw new Error('Not connected to Gateway');
  }

  const result = await client.request<GatewaySession[]>('sessions.list', {
    limit: 200,
    includeDerivedTitles: true,
    includeLastMessage: true,
    includeUnknown: false,
    includeGlobal: false,
  });

  if (!Array.isArray(result)) {
    // The result might be wrapped in an object
    const arr = (result as Record<string, unknown>)?.sessions;
    if (Array.isArray(arr)) return arr as GatewaySession[];
    // Defensive: return empty array if unexpected shape
    return [];
  }

  return result;
}

// ── Import a single session ──

interface HistoryMessage {
  role?: string;
  content?: string | unknown[];
  tool_calls?: unknown[];
  created_at?: string;
  [key: string]: unknown;
}

interface HistoryResult {
  messages?: HistoryMessage[];
  transcript?: HistoryMessage[];
  entries?: HistoryMessage[];
  [key: string]: unknown;
}

function extractContent(msg: HistoryMessage): string {
  if (typeof msg.content === 'string') return msg.content;
  if (Array.isArray(msg.content)) {
    // Claude-style content blocks: [{type:"text", text:"..."}, ...]
    return msg.content
      .map((block) => {
        if (typeof block === 'string') return block;
        if (typeof block === 'object' && block !== null) {
          const b = block as Record<string, unknown>;
          if (typeof b.text === 'string') return b.text;
          if (typeof b.content === 'string') return b.content;
        }
        return '';
      })
      .join('\n');
  }
  return '';
}

function mapRole(role: string | undefined): ChatMessage['role'] {
  if (role === 'user') return 'user';
  if (role === 'assistant') return 'assistant';
  if (role === 'system') return 'system';
  if (role === 'tool') return 'tool';
  return 'assistant'; // default
}

async function importSessionHistory(
  sessionKey: string,
  projectId: string,
): Promise<number> {
  const client = getGatewayClient();
  const supabase = createClient();

  // Fetch history — use max limit
  let history: HistoryResult;
  try {
    history = await client.request<HistoryResult>('chat.history', {
      sessionKey,
      limit: 1000,
    });
  } catch (err) {
    console.warn(`[import] Failed to fetch history for ${sessionKey}:`, err);
    return 0;
  }

  // Parse messages from various response shapes
  const rawMessages: HistoryMessage[] =
    history?.messages ?? history?.transcript ?? history?.entries ?? [];

  if (rawMessages.length === 0) return 0;

  // Convert to rows for Supabase batch insert
  const rows: Array<{
    project_id: string;
    role: string;
    content: string;
    tool_calls: unknown[];
    run_id: string | null;
    metadata: Record<string, unknown>;
  }> = [];

  for (const msg of rawMessages) {
    const content = extractContent(msg);
    if (!content && msg.role !== 'tool') continue; // Skip empty non-tool messages

    // 🔒 SECURITY: Bound content size to prevent storage abuse
    const boundedContent = content.slice(0, 500_000); // 500KB max per message

    rows.push({
      project_id: projectId,
      role: mapRole(msg.role),
      content: boundedContent,
      tool_calls: Array.isArray(msg.tool_calls) ? msg.tool_calls : [],
      run_id: typeof msg.run_id === 'string' ? msg.run_id : null,
      metadata: {},
    });
  }

  if (rows.length === 0) return 0;

  // Batch insert (Supabase supports up to ~1000 rows per insert)
  const BATCH_SIZE = 100;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('messages').insert(batch);
    if (error) {
      console.error(`[import] Batch insert error at offset ${i}:`, error);
      // Continue with remaining batches
    }
  }

  // Detect and store artifacts from assistant messages
  const assistantMessages = rows.filter((r) => r.role === 'assistant');
  for (const msg of assistantMessages) {
    const artifacts = detectArtifacts(msg.content);
    if (artifacts.length > 0) {
      const artifactRows = artifacts.map((a) => ({
        project_id: projectId,
        name: a.name,
        type: a.type,
        language: a.language ?? null,
        content: a.content.slice(0, 200_000), // Bound artifact content
      }));
      const { error } = await supabase.from('artifacts').insert(artifactRows);
      if (error) {
        console.warn('[import] Artifact insert error:', error);
      }
    }
  }

  return rows.length;
}

// ── Full import flow ──

export async function importSessions(
  sessions: GatewaySession[],
  onProgress: (progress: ImportProgress) => void,
): Promise<{ imported: number; totalMessages: number }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  onProgress({
    phase: 'importing',
    total: sessions.length,
    completed: 0,
  });

  let totalMessages = 0;

  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i]!;
    const displayName =
      session.label ||
      session.derivedTitle ||
      session.key.split(':').pop() ||
      `Session ${i + 1}`;

    onProgress({
      phase: 'importing',
      total: sessions.length,
      completed: i,
      currentSession: displayName,
    });

    try {
      // Create project for this session
      const projectId = crypto.randomUUID();

      // Determine icon based on session type
      const icon = session.key.includes('discord')
        ? '💬'
        : session.key.includes('slack')
          ? '💼'
          : session.key.includes('telegram')
            ? '📱'
            : '🤖';

      // 🔒 SECURITY: Sanitize session label
      const safeName = displayName.trim().slice(0, 100);

      const { error: projectError } = await supabase
        .from('projects')
        .insert({
          id: projectId,
          user_id: user.id,
          name: safeName,
          description: `Imported from Gateway session: ${session.key}`,
          icon,
          color: '#6366f1',
          session_key: session.key,
        });

      if (projectError) {
        // Session key might already exist (duplicate import)
        if (projectError.code === '23505') {
          console.warn(
            `[import] Session ${session.key} already imported, skipping`,
          );
          continue;
        }
        console.error(`[import] Failed to create project:`, projectError);
        continue;
      }

      // Import messages
      const messageCount = await importSessionHistory(
        session.key,
        projectId,
      );
      totalMessages += messageCount;
    } catch (err) {
      console.error(`[import] Error importing session ${session.key}:`, err);
    }
  }

  onProgress({
    phase: 'done',
    total: sessions.length,
    completed: sessions.length,
  });

  return { imported: sessions.length, totalMessages };
}
