/**
 * Gateway Import — Fetches sessions + history from a connected Gateway
 * and imports them into Clawdify projects + messages in Supabase.
 */

import { getGatewayClient } from './hooks';
import { createClient } from '@/lib/supabase/client';
import { detectArtifacts } from '@/lib/artifacts/detector';

// ===== Types =====

export interface GatewaySession {
  key: string;
  label?: string;
  lastActivity?: string;
  messageCount?: number;
  agentId?: string;
  model?: string;
  lastMessage?: string;
  selected?: boolean;
}

export interface ImportProgress {
  total: number;
  completed: number;
  currentSession: string;
  phase: 'listing' | 'importing' | 'done' | 'error';
  error?: string;
}

// ===== Session Listing =====

export async function fetchGatewaySessions(): Promise<GatewaySession[]> {
  const client = getGatewayClient();
  if (!client.isConnected) {
    throw new Error('Not connected to Gateway');
  }

  const result = await client.request<unknown>('sessions.list', {
    limit: 200,
    includeDerivedTitles: true,
    includeLastMessage: true,
  });

  if (!result || typeof result !== 'object') {
    return [];
  }

  const sessions: unknown[] = Array.isArray(result)
    ? result
    : Array.isArray((result as Record<string, unknown>).sessions)
      ? ((result as Record<string, unknown>).sessions as unknown[])
      : [];

  return sessions
    .filter((s): s is Record<string, unknown> => s !== null && typeof s === 'object')
    .map((s) => ({
      key: String(s.key ?? s.sessionKey ?? ''),
      label: s.label ? String(s.label) : s.derivedTitle ? String(s.derivedTitle) : undefined,
      lastActivity: s.lastActivity ? String(s.lastActivity) : s.updatedAt ? String(s.updatedAt) : undefined,
      messageCount: typeof s.messageCount === 'number' ? s.messageCount : undefined,
      agentId: s.agentId ? String(s.agentId) : undefined,
      model: s.model ? String(s.model) : undefined,
      lastMessage: s.lastMessage ? String(s.lastMessage) : undefined,
    }))
    .filter((s) => s.key.length > 0);
}

// ===== Chat History Fetching =====

interface HistoryMessage {
  role: string;
  content: string;
  createdAt?: string;
  toolCalls?: unknown[];
  runId?: string;
  metadata?: Record<string, unknown>;
}

async function fetchSessionHistory(sessionKey: string): Promise<HistoryMessage[]> {
  const client = getGatewayClient();
  if (!client.isConnected) {
    throw new Error('Not connected to Gateway');
  }

  const result = await client.request<unknown>('chat.history', {
    sessionKey,
    limit: 1000,
  });

  if (!result || typeof result !== 'object') {
    return [];
  }

  const raw: unknown[] = Array.isArray(result)
    ? result
    : Array.isArray((result as Record<string, unknown>).messages)
      ? ((result as Record<string, unknown>).messages as unknown[])
      : Array.isArray((result as Record<string, unknown>).transcript)
        ? ((result as Record<string, unknown>).transcript as unknown[])
        : [];

  return raw
    .filter((m): m is Record<string, unknown> => m !== null && typeof m === 'object')
    .map((m) => {
      let content = '';
      if (typeof m.content === 'string') {
        content = m.content;
      } else if (typeof m.text === 'string') {
        content = m.text;
      } else if (m.content && typeof m.content === 'object') {
        const blocks = Array.isArray(m.content) ? m.content : [m.content];
        content = blocks
          .map((b: unknown) => {
            if (typeof b === 'string') return b;
            if (b && typeof b === 'object' && 'text' in (b as Record<string, unknown>)) {
              return String((b as Record<string, unknown>).text);
            }
            return '';
          })
          .join('');
      }

      return {
        role: String(m.role ?? 'assistant'),
        content,
        createdAt: m.createdAt ? String(m.createdAt) : m.ts ? String(m.ts) : undefined,
        toolCalls: Array.isArray(m.tool_calls ?? m.toolCalls) ? (m.tool_calls ?? m.toolCalls) as unknown[] : undefined,
        runId: m.runId ? String(m.runId) : undefined,
        metadata: (m.metadata && typeof m.metadata === 'object') ? m.metadata as Record<string, unknown> : undefined,
      };
    })
    .filter((m) => m.content.length > 0 || (m.toolCalls && m.toolCalls.length > 0));
}

// ===== Import Logic =====

export async function importSessions(
  sessions: GatewaySession[],
  onProgress: (progress: ImportProgress) => void,
): Promise<{ imported: number; errors: string[] }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const errors: string[] = [];
  let completed = 0;

  for (const session of sessions) {
    onProgress({
      total: sessions.length,
      completed,
      currentSession: session.label ?? session.key,
      phase: 'importing',
    });

    try {
      const projectId = crypto.randomUUID();
      const sessionKey = session.key;
      const projectName = session.label || sessionKey.split(':').pop() || 'Imported Session';

      const { error: projError } = await supabase.from('projects').insert({
        id: projectId,
        user_id: user.id,
        name: projectName.slice(0, 100),
        description: `Imported from Gateway session: ${sessionKey}`,
        icon: '📥',
        color: '#6366f1',
        session_key: sessionKey,
      });

      if (projError) {
        if (projError.code === '23505') {
          errors.push(`Session "${projectName}" already imported (duplicate session key)`);
          completed++;
          continue;
        }
        throw projError;
      }

      const history = await fetchSessionHistory(sessionKey);

      if (history.length > 0) {
        const messageRows = history.map((msg) => ({
          project_id: projectId,
          role: ['user', 'assistant', 'system', 'tool'].includes(msg.role) ? msg.role : 'assistant',
          content: msg.content,
          tool_calls: msg.toolCalls ?? [],
          run_id: msg.runId ?? null,
          metadata: msg.metadata ?? {},
        }));

        const BATCH_SIZE = 100;
        for (let i = 0; i < messageRows.length; i += BATCH_SIZE) {
          const batch = messageRows.slice(i, i + BATCH_SIZE);
          const { error: msgError } = await supabase.from('messages').insert(batch);
          if (msgError) {
            console.error(`Failed to insert messages batch for ${sessionKey}:`, msgError);
            errors.push(`Some messages failed to import for "${projectName}"`);
            break;
          }
        }

        const assistantMessages = history.filter((m) => m.role === 'assistant');
        for (const msg of assistantMessages) {
          const detected = detectArtifacts(msg.content);
          if (detected.length > 0) {
            const artifactRows = detected.map((a) => ({
              project_id: projectId,
              name: a.name,
              type: a.type,
              language: a.language ?? null,
              content: a.content,
            }));
            try {
              await supabase.from('artifacts').insert(artifactRows);
            } catch {
              // Non-critical — artifacts can be re-detected
            }
          }
        }
      }

      completed++;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`Failed to import "${session.label ?? session.key}": ${errMsg}`);
      completed++;
    }
  }

  onProgress({
    total: sessions.length,
    completed,
    currentSession: '',
    phase: 'done',
  });

  return { imported: completed - errors.length, errors };
}
