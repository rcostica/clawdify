/**
 * Activity Mapper — translates raw Gateway events into ActivityEntry objects.
 *
 * This module bridges the existing chat/agent event system with the new
 * task-centric activity feed. It does NOT modify the Gateway protocol.
 */

import type { ChatEventPayload, AgentEventPayload } from './types';
import type { ActivityEntry, ActivityType } from '@/stores/activity-store';

/**
 * Maps a ChatEventPayload to an ActivityEntry.
 * Returns null if the event shouldn't produce an activity entry.
 */
export function mapChatEventToActivity(
  event: ChatEventPayload,
  taskId: string,
): ActivityEntry | null {
  const timestamp = new Date().toISOString();

  switch (event.state) {
    case 'delta': {
      // Don't create individual entries for every delta — too noisy.
      // The chat store handles accumulation. We only emit a "thinking" entry
      // on the first delta of a run.
      return null;
    }

    case 'final': {
      return {
        id: `activity-${event.runId}-final`,
        taskId,
        timestamp,
        type: 'complete',
        title: 'Task completed',
        detail: event.stopReason ? `Stop reason: ${event.stopReason}` : undefined,
      };
    }

    case 'aborted': {
      return {
        id: `activity-${event.runId}-aborted`,
        taskId,
        timestamp,
        type: 'error',
        title: 'Generation aborted',
      };
    }

    case 'error': {
      return {
        id: `activity-${event.runId}-error`,
        taskId,
        timestamp,
        type: 'error',
        title: 'Error occurred',
        detail: event.errorMessage ?? 'Unknown error',
      };
    }

    default:
      return null;
  }
}

/**
 * Maps an AgentEventPayload to an ActivityEntry.
 * Agent events carry tool call information (file reads, writes, commands, etc.)
 */
export function mapAgentEventToActivity(
  event: AgentEventPayload,
  taskId: string,
): ActivityEntry | null {
  const timestamp = new Date(event.ts).toISOString();
  const data = event.data;

  // Determine the stream/type of agent event
  const stream = event.stream;

  if (stream === 'tool_call' || data.tool || data.name) {
    return mapToolCallToActivity(event, taskId, timestamp);
  }

  if (stream === 'thinking' || data.thinking) {
    return {
      id: `activity-${event.runId}-${event.seq}`,
      taskId,
      timestamp,
      type: 'thinking',
      title: 'Thinking...',
      detail: typeof data.thinking === 'string' ? data.thinking : undefined,
    };
  }

  if (stream === 'message' || data.content) {
    return {
      id: `activity-${event.runId}-${event.seq}`,
      taskId,
      timestamp,
      type: 'message',
      title: 'Agent response',
      detail: typeof data.content === 'string'
        ? data.content.slice(0, 200)
        : undefined,
    };
  }

  // Generic fallback for unknown streams
  return null;
}

/**
 * Maps tool call agent events to specific activity types.
 */
function mapToolCallToActivity(
  event: AgentEventPayload,
  taskId: string,
  timestamp: string,
): ActivityEntry | null {
  const data = event.data;
  const toolName = (data.tool ?? data.name ?? '') as string;
  const toolInput = data.input as Record<string, unknown> | undefined;

  // File read operations
  if (toolName === 'Read' || toolName === 'read' || toolName === 'read_file') {
    const path = (toolInput?.path ?? toolInput?.file_path ?? '') as string;
    return {
      id: `activity-${event.runId}-${event.seq}`,
      taskId,
      timestamp,
      type: 'file_read',
      title: `Reading file: ${truncatePath(path)}`,
      detail: path,
    };
  }

  // File write operations
  if (
    toolName === 'Write' ||
    toolName === 'write' ||
    toolName === 'write_file' ||
    toolName === 'Edit' ||
    toolName === 'edit'
  ) {
    const path = (toolInput?.path ?? toolInput?.file_path ?? '') as string;
    const isEdit = toolName === 'Edit' || toolName === 'edit';
    return {
      id: `activity-${event.runId}-${event.seq}`,
      taskId,
      timestamp,
      type: 'file_write',
      title: `${isEdit ? 'Editing' : 'Creating'} file: ${truncatePath(path)}`,
      detail: path,
    };
  }

  // Shell commands
  if (toolName === 'exec' || toolName === 'bash' || toolName === 'shell') {
    const command = (toolInput?.command ?? '') as string;
    return {
      id: `activity-${event.runId}-${event.seq}`,
      taskId,
      timestamp,
      type: 'command',
      title: `Running: ${truncateCommand(command)}`,
      detail: command,
    };
  }

  // Browser operations
  if (toolName === 'browser') {
    const action = (toolInput?.action ?? 'action') as string;
    return {
      id: `activity-${event.runId}-${event.seq}`,
      taskId,
      timestamp,
      type: 'tool_call',
      title: `Browser: ${action}`,
    };
  }

  // Web search
  if (toolName === 'web_search') {
    const query = (toolInput?.query ?? '') as string;
    return {
      id: `activity-${event.runId}-${event.seq}`,
      taskId,
      timestamp,
      type: 'tool_call',
      title: `Searching: ${query.slice(0, 60)}`,
      detail: query,
    };
  }

  // Generic tool call
  return {
    id: `activity-${event.runId}-${event.seq}`,
    taskId,
    timestamp,
    type: 'tool_call',
    title: `Using tool: ${toolName}`,
  };
}

// ── Helpers ──

function truncatePath(path: string): string {
  if (!path) return 'unknown';
  if (path.length <= 40) return path;
  const parts = path.split('/');
  if (parts.length <= 2) return path.slice(-40);
  return `.../${parts.slice(-2).join('/')}`;
}

function truncateCommand(cmd: string): string {
  if (!cmd) return 'command';
  const firstLine = cmd.split('\n')[0] ?? cmd;
  return firstLine.length > 60 ? firstLine.slice(0, 57) + '...' : firstLine;
}
