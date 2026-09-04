import { gatewayRpc } from '@/lib/gateway/client';

const SESSION_PAGE_SIZE = 500;
const MAX_SESSION_ROWS = 20_000;
const HISTORY_PAGE_SIZE = 1_000;
const MAX_HISTORY_MESSAGES = 20_000;

export interface GatewaySessionRow {
  key: string;
  sessionId?: string;
  updatedAt?: number | null;
  label?: string;
  displayName?: string;
  derivedTitle?: string;
  lastMessagePreview?: string;
  modelProvider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  totalTokensFresh?: boolean;
  compactionCheckpointCount?: number;
  compactionCount?: number;
}

interface GatewaySessionsListResult {
  sessions?: GatewaySessionRow[];
  hasMore?: boolean;
  totalCount?: number;
}

export interface ImportedSessionMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

interface GatewayHistoryResult {
  kind?: 'delta' | 'reset';
  messages?: unknown[];
  hasMore?: boolean;
  nextOffset?: number;
  totalMessages?: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function messageText(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';

  return content
    .map((part) => {
      const record = asRecord(part);
      return record?.type === 'text' && typeof record.text === 'string'
        ? record.text
        : '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}

function messageTimestamp(message: Record<string, unknown>): number | undefined {
  const raw = message.timestamp ?? message.createdAt;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw < 10_000_000_000 ? raw * 1000 : raw;
  }
  if (typeof raw === 'string') {
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function projectImportableMessage(value: unknown): ImportedSessionMessage | null {
  const message = asRecord(value);
  if (!message || (message.role !== 'user' && message.role !== 'assistant')) return null;

  const content = messageText(message.content);
  if (!content) return null;

  return {
    role: message.role,
    content,
    timestamp: messageTimestamp(message),
  };
}

/**
 * Read the complete Gateway session index in bounded pages. This is backed by
 * the active OpenClaw store (legacy files before migration, SQLite after it).
 */
async function listGatewaySessionPages(
  options: {
    includeDerivedTitles?: boolean;
    includeLastMessage?: boolean;
  },
  archived?: boolean | 'all',
): Promise<{ sessions: GatewaySessionRow[]; truncated: boolean }> {
  const sessions: GatewaySessionRow[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore && sessions.length < MAX_SESSION_ROWS) {
    const result = await gatewayRpc<GatewaySessionsListResult>('sessions.list', {
      agentId: 'main',
      limit: Math.min(SESSION_PAGE_SIZE, MAX_SESSION_ROWS - sessions.length),
      offset,
      ...(options.includeDerivedTitles ? { includeDerivedTitles: true } : {}),
      ...(options.includeLastMessage ? { includeLastMessage: true } : {}),
      ...(archived !== undefined ? { archived } : {}),
    }, 30_000);

    const page = Array.isArray(result.sessions) ? result.sessions : [];
    sessions.push(...page);
    hasMore = result.hasMore === true;

    if (!hasMore) break;
    if (page.length === 0) {
      throw new Error('Gateway session pagination did not advance');
    }
    offset += page.length;
  }

  return { sessions, truncated: hasMore };
}

export async function listGatewaySessions(options: {
  includeDerivedTitles?: boolean;
  includeLastMessage?: boolean;
  includeArchived?: boolean;
} = {}): Promise<{ sessions: GatewaySessionRow[]; truncated: boolean }> {
  if (!options.includeArchived) return listGatewaySessionPages(options);

  try {
    return await listGatewaySessionPages(options, 'all');
  } catch (error) {
    // OpenClaw 2026.7 accepts only boolean archived filters. Newer releases
    // accept "all", so retry the two old scopes and merge them during the
    // compatibility window.
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('/archived') || !message.includes('boolean')) throw error;
  }

  const active = await listGatewaySessionPages(options, false);
  const archived = await listGatewaySessionPages(options, true);
  const byKey = new Map<string, GatewaySessionRow>();
  for (const session of [...active.sessions, ...archived.sessions]) {
    byKey.set(session.key, session);
  }

  return {
    sessions: [...byKey.values()],
    truncated: active.truncated || archived.truncated,
  };
}

/** Read a complete transcript through the supported, SQLite-aware Gateway API. */
export async function readGatewaySessionMessages(
  sessionKey: string,
): Promise<ImportedSessionMessage[]> {
  const messages: ImportedSessionMessage[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore && offset < MAX_HISTORY_MESSAGES) {
    const result = await gatewayRpc<GatewayHistoryResult>('chat.history', {
      sessionKey,
      limit: Math.min(HISTORY_PAGE_SIZE, MAX_HISTORY_MESSAGES - offset),
      offset,
      maxChars: 500_000,
    }, 30_000);

    if (result.kind === 'reset') {
      throw new Error('Gateway transcript changed while it was being read');
    }

    const page = Array.isArray(result.messages) ? result.messages : [];
    for (const value of page) {
      const message = projectImportableMessage(value);
      if (message) messages.push(message);
    }

    hasMore = result.hasMore === true;
    if (!hasMore) break;

    const nextOffset = result.nextOffset;
    if (typeof nextOffset !== 'number' || nextOffset <= offset) {
      throw new Error('Gateway transcript pagination did not advance');
    }
    offset = nextOffset;
  }

  if (hasMore) {
    throw new Error(`Session exceeds the ${MAX_HISTORY_MESSAGES.toLocaleString()} message import limit`);
  }

  return messages;
}
