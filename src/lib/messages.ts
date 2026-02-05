/**
 * Message persistence (stub)
 *
 * In self-hosted mode, messages are kept in Zustand store only.
 * Future versions could add IndexedDB or local file persistence.
 */

import type { ChatMessage } from '@/stores/chat-store';

export async function persistMessage(
  _projectId: string,
  _message: ChatMessage,
): Promise<void> {
  // No-op in self-hosted mode - messages stay in memory/Zustand
}

export async function loadPersistedMessages(
  _projectId: string,
): Promise<ChatMessage[]> {
  // No persistence in self-hosted mode
  return [];
}
