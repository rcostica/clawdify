import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: unknown[];
  runId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  isStreaming?: boolean;
}

export interface ChatEventPayload {
  runId: string;
  sessionKey: string;
  seq: number;
  state: 'delta' | 'final' | 'aborted' | 'error';
  message?: unknown;
  errorMessage?: string;
  usage?: unknown;
  stopReason?: string;
}

interface ChatState {
  messagesByProject: Record<string, ChatMessage[]>;
  streamingByProject: Record<
    string,
    { runId: string; content: string; seq: number } | undefined
  >;
  loadingByProject: Record<string, boolean>;

  addMessage: (projectId: string, message: ChatMessage) => void;
  setMessages: (projectId: string, messages: ChatMessage[]) => void;
  setLoading: (projectId: string, loading: boolean) => void;
  handleChatEvent: (payload: ChatEventPayload) => void;
  clearMessages: (projectId: string) => void;
}

/**
 * Resolve projectId from sessionKey.
 * Session keys are: agent:main:clawdify:<projectId>
 */
function projectIdFromSessionKey(sessionKey: string): string | null {
  const prefix = 'agent:main:clawdify:';
  if (sessionKey.startsWith(prefix)) {
    return sessionKey.slice(prefix.length);
  }
  return null;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messagesByProject: {},
  streamingByProject: {},
  loadingByProject: {},

  addMessage: (projectId, message) =>
    set((state) => ({
      messagesByProject: {
        ...state.messagesByProject,
        [projectId]: [
          ...(state.messagesByProject[projectId] ?? []),
          message,
        ],
      },
    })),

  setMessages: (projectId, messages) =>
    set((state) => ({
      messagesByProject: {
        ...state.messagesByProject,
        [projectId]: messages,
      },
    })),

  setLoading: (projectId, loading) =>
    set((state) => ({
      loadingByProject: {
        ...state.loadingByProject,
        [projectId]: loading,
      },
    })),

  handleChatEvent: (payload: ChatEventPayload) => {
    const projectId = projectIdFromSessionKey(payload.sessionKey);
    if (!projectId) return;

    const state = get();

    switch (payload.state) {
      case 'delta': {
        const existing = state.streamingByProject[projectId];
        const messageContent =
          typeof payload.message === 'string'
            ? payload.message
            : (payload.message as Record<string, unknown> | null)?.content
              ? String(
                  (payload.message as Record<string, unknown>).content,
                )
              : '';

        if (!existing || existing.runId !== payload.runId) {
          set((s) => ({
            streamingByProject: {
              ...s.streamingByProject,
              [projectId]: {
                runId: payload.runId,
                content: messageContent,
                seq: payload.seq,
              },
            },
            loadingByProject: {
              ...s.loadingByProject,
              [projectId]: false,
            },
          }));
        } else {
          set((s) => ({
            streamingByProject: {
              ...s.streamingByProject,
              [projectId]: {
                runId: payload.runId,
                content: existing.content + messageContent,
                seq: payload.seq,
              },
            },
          }));
        }
        break;
      }

      case 'final': {
        const streaming = state.streamingByProject[projectId];
        const finalContent = streaming?.content ?? '';

        set((s) => {
          const messages = s.messagesByProject[projectId] ?? [];
          return {
            messagesByProject: {
              ...s.messagesByProject,
              [projectId]: [
                ...messages,
                {
                  id: crypto.randomUUID(),
                  role: 'assistant' as const,
                  content: finalContent,
                  runId: payload.runId,
                  createdAt: new Date().toISOString(),
                },
              ],
            },
            streamingByProject: {
              ...s.streamingByProject,
              [projectId]: undefined,
            },
            loadingByProject: {
              ...s.loadingByProject,
              [projectId]: false,
            },
          };
        });
        break;
      }

      case 'aborted': {
        const streaming = state.streamingByProject[projectId];
        if (streaming?.content) {
          set((s) => {
            const messages = s.messagesByProject[projectId] ?? [];
            return {
              messagesByProject: {
                ...s.messagesByProject,
                [projectId]: [
                  ...messages,
                  {
                    id: crypto.randomUUID(),
                    role: 'assistant' as const,
                    content:
                      streaming.content + '\n\n*(generation aborted)*',
                    runId: payload.runId,
                    createdAt: new Date().toISOString(),
                  },
                ],
              },
              streamingByProject: {
                ...s.streamingByProject,
                [projectId]: undefined,
              },
              loadingByProject: {
                ...s.loadingByProject,
                [projectId]: false,
              },
            };
          });
        } else {
          set((s) => ({
            streamingByProject: {
              ...s.streamingByProject,
              [projectId]: undefined,
            },
            loadingByProject: {
              ...s.loadingByProject,
              [projectId]: false,
            },
          }));
        }
        break;
      }

      case 'error': {
        set((s) => ({
          streamingByProject: {
            ...s.streamingByProject,
            [projectId]: undefined,
          },
          loadingByProject: {
            ...s.loadingByProject,
            [projectId]: false,
          },
        }));
        console.error('[chat] Error event:', payload.errorMessage);
        break;
      }
    }
  },

  clearMessages: (projectId) =>
    set((state) => ({
      messagesByProject: {
        ...state.messagesByProject,
        [projectId]: [],
      },
    })),
}));
