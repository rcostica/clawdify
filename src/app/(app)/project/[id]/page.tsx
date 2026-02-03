'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useProjectStore } from '@/stores/project-store';
import { useChatStore, type ChatMessage } from '@/stores/chat-store';
import { useGatewayStore } from '@/stores/gateway-store';
import { useChat } from '@/lib/gateway/hooks';
import { loadPersistedMessages, persistMessage } from '@/lib/messages';
import { MessageList } from '@/components/chat/message-list';
import { MessageInput } from '@/components/chat/message-input';
import { Badge } from '@/components/ui/badge';
import { WifiOff, Settings } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function ProjectPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const project = useProjectStore((s) =>
    s.projects.find((p) => p.id === projectId),
  );
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const isConnected = useGatewayStore((s) => s.status === 'connected');
  const status = useGatewayStore((s) => s.status);
  const setMessages = useChatStore((s) => s.setMessages);

  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [initialized, setInitialized] = useState(false);

  const sessionKey = project?.sessionKey ?? '';
  const {
    messages,
    streaming,
    loading,
    sendMessage,
    abortGeneration,
    loadHistory,
  } = useChat(projectId, sessionKey);

  // Set active project
  useEffect(() => {
    setActiveProject(projectId);
  }, [projectId, setActiveProject]);

  // Load persisted messages from Supabase on mount
  useEffect(() => {
    let mounted = true;
    if (projectId && !initialized) {
      loadPersistedMessages(projectId)
        .then((msgs) => {
          if (mounted && msgs.length > 0) {
            setMessages(projectId, msgs);
          }
          setInitialized(true);
        })
        .catch((err) => {
          console.error('Failed to load messages:', err);
          setInitialized(true);
        });
    }
    return () => {
      mounted = false;
    };
  }, [projectId, initialized, setMessages]);

  const handleSend = useCallback(
    async (content: string) => {
      try {
        await sendMessage(content);
        // Persist user message
        persistMessage(projectId, {
          id: crypto.randomUUID(),
          role: 'user',
          content,
          createdAt: new Date().toISOString(),
        }).catch(console.error);
      } catch (err) {
        toast.error('Failed to send message', {
          description:
            err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    [sendMessage, projectId],
  );

  const handleAbort = useCallback(async () => {
    try {
      await abortGeneration();
    } catch (err) {
      toast.error('Failed to abort', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [abortGeneration]);

  // Persist assistant messages when they finalize
  const lastMessageCount = messages.length;
  useEffect(() => {
    if (lastMessageCount > 0) {
      const lastMsg = messages[lastMessageCount - 1];
      if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.isStreaming) {
        persistMessage(projectId, lastMsg).catch(console.error);
      }
    }
  }, [lastMessageCount, messages, projectId]);

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p>Project not found</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Chat header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <span className="text-lg">{project.icon}</span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold truncate">{project.name}</h2>
          {project.description && (
            <p className="text-xs text-muted-foreground truncate">
              {project.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isConnected && (
            <Link href="/settings">
              <Badge
                variant="outline"
                className="gap-1 border-yellow-500/50 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-950/20 cursor-pointer"
              >
                <WifiOff className="h-3 w-3" />
                Disconnected
              </Badge>
            </Link>
          )}
          {isConnected && (
            <Badge
              variant="outline"
              className="gap-1 border-green-500/50 text-green-600"
            >
              Connected
            </Badge>
          )}
        </div>
      </div>

      {/* Reconnecting banner */}
      {(status === 'connecting' || status === 'handshaking') && (
        <div className="bg-yellow-50 px-4 py-1.5 text-center text-xs text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-300">
          Reconnecting to Gateway...
        </div>
      )}

      {/* Messages */}
      <MessageList
        messages={messages}
        streaming={streaming}
        loading={loading}
        projectColor={project.color}
        onReply={setReplyTo}
      />

      {/* Input */}
      <MessageInput
        onSend={handleSend}
        onAbort={handleAbort}
        isConnected={isConnected}
        isLoading={loading}
        isStreaming={!!streaming}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />
    </div>
  );
}
