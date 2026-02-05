'use client';

import { useEffect, useRef, useCallback } from 'react';
import { GatewayClient } from './client';
import { useGatewayStore } from '@/stores/gateway-store';
import { useChatStore } from '@/stores/chat-store';
import { useActivityStore } from '@/stores/activity-store';
import { mapAgentEventToActivity } from './activity-mapper';
import type {
  ChatEventPayload,
  AgentEventPayload,
  HelloOk,
  GatewayConnectionConfig,
} from './types';
import type { ChatMessage } from '@/stores/chat-store';

// Stable empty references to avoid infinite re-render loops in Zustand selectors
const EMPTY_MESSAGES: ChatMessage[] = [];
const EMPTY_LOADING = false;

/** Singleton client instance (shared across the app) */
let clientInstance: GatewayClient | null = null;

export function getGatewayClient(): GatewayClient {
  if (!clientInstance) {
    clientInstance = new GatewayClient();
  }
  return clientInstance;
}

/**
 * Hook to manage Gateway connection lifecycle.
 * Mount this ONCE at the app layout level.
 */
export function useGatewayConnection() {
  const setStatus = useGatewayStore((s) => s.setStatus);
  const setHello = useGatewayStore((s) => s.setHello);
  const setError = useGatewayStore((s) => s.setError);
  const config = useGatewayStore((s) => s.config);
  const handleChatEvent = useChatStore((s) => s.handleChatEvent);
  const addActivityEntry = useActivityStore((s) => s.addEntry);
  const setActivityStreaming = useActivityStore((s) => s.setStreaming);

  const clientRef = useRef(getGatewayClient());

  useEffect(() => {
    const client = clientRef.current;

    client.setEvents({
      onStatusChange: (status) => setStatus(status),
      onHello: (hello) => setHello(hello),
      onChatEvent: (payload: ChatEventPayload) => handleChatEvent(payload),
      onAgentEvent: (payload: AgentEventPayload) => {
        // Map agent events (tool calls, etc.) to activity entries
        // Use runId as taskId for now — refinement TBD
        const taskId = payload.runId;
        setActivityStreaming(taskId, true);
        
        const entry = mapAgentEventToActivity(payload, taskId);
        if (entry) {
          addActivityEntry(taskId, entry);
        }
      },
      onError: (err) => {
        console.error('[gateway]', err.message);
        setError(err.message);
      },
      onClose: (code, reason) => {
        if (code !== 1000) {
          console.warn(`[gateway] closed: ${code} ${reason}`);
        }
      },
    });

    if (config) {
      client.connect(config);
    }

    return () => {
      // Don't disconnect on unmount — keep connection alive
    };
  }, [config, setStatus, setHello, setError, handleChatEvent, addActivityEntry, setActivityStreaming]);

  const connect = useCallback((cfg: GatewayConnectionConfig) => {
    useGatewayStore.getState().setConfig(cfg);
    clientRef.current.connect(cfg);
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current.disconnect();
    useGatewayStore.getState().setStatus('disconnected');
  }, []);

  const testConnection = useCallback(
    async (cfg: GatewayConnectionConfig): Promise<HelloOk> => {
      const testClient = new GatewayClient();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          testClient.disconnect();
          reject(new Error('Connection test timeout'));
        }, 10_000);

        testClient.setEvents({
          onHello: (hello) => {
            clearTimeout(timer);
            testClient.disconnect();
            resolve(hello);
          },
          onError: (err) => {
            clearTimeout(timer);
            testClient.disconnect();
            reject(err);
          },
        });

        testClient.connect(cfg);
      });
    },
    [],
  );

  return { connect, disconnect, testConnection };
}

/**
 * Hook for chat operations in a specific project.
 */
export function useChat(projectId: string, sessionKey: string) {
  const client = getGatewayClient();
  const addMessage = useChatStore((s) => s.addMessage);
  const setLoading = useChatStore((s) => s.setLoading);
  const messages = useChatStore(
    (s) => s.messagesByProject[projectId] ?? EMPTY_MESSAGES,
  );
  const streaming = useChatStore(
    (s) => s.streamingByProject[projectId],
  );
  const loading = useChatStore(
    (s) => s.loadingByProject[projectId] ?? EMPTY_LOADING,
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!client.isConnected) {
        throw new Error('Not connected to Gateway');
      }

      // Add user message to local store
      addMessage(projectId, {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      });

      setLoading(projectId, true);

      // Send to Gateway — idempotencyKey is REQUIRED
      const idempotencyKey = crypto.randomUUID();
      const result = await client.request('chat.send', {
        sessionKey,
        message: content,
        idempotencyKey,
      });

      return result;
    },
    [client, projectId, sessionKey, addMessage, setLoading],
  );

  const abortGeneration = useCallback(async () => {
    await client.request('chat.abort', { sessionKey });
  }, [client, sessionKey]);

  const loadHistory = useCallback(async () => {
    const result = await client.request<unknown>('chat.history', {
      sessionKey,
      limit: 100,
    });
    return result;
  }, [client, sessionKey]);

  return {
    messages,
    streaming,
    loading,
    sendMessage,
    abortGeneration,
    loadHistory,
  };
}
