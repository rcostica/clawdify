// Re-export key types used across the app
export type { ChatMessage, ChatEventPayload } from '@/stores/chat-store';
export type { Project } from '@/stores/project-store';
export type {
  GatewayConnectionConfig,
  HelloOk,
  ChatSendParams,
  ChatSendResult,
  ChatHistoryParams,
  AgentEventPayload,
} from '@/lib/gateway/types';
export type { ConnectionStatus } from '@/stores/gateway-store';
