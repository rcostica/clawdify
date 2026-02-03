'use client';

import { useEffect, useRef, useCallback } from 'react';
import { GatewayClient } from './client';
import { useGatewayStore } from '@/stores/gateway-store';
import { useChatStore } from '@/stores/chat-store';
import type {
  ChatEventPayload,
  HelloOk,
  GatewayConnectionConfig,
} from './types';

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

  const clientRef = useRef(getGatewayClient());

  useEffect(() => {
    const client = clientRef.current;

    client.setEvents({
      onStatusChange: (status) => setStatus(status),
      onHello: (hello) => setHello(hello),
      onChatEvent: (payload: ChatEventPayload) => handleChatEvent(payload),
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
  }, [config, setStatus, setHello, setError, handleChatEvent]);

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
    (s) => s.messagesByProject[projectId] ?? [],
  );
  const streaming = useChatStore(
    (s) => s.streamingByProject[projectId],
  );
  const loading = useChatStore(
    (s) => s.loadingByProject[projectId] ?? false,
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
