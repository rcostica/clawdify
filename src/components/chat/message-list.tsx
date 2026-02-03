'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { ChatMessage } from '@/stores/chat-store';
import { MessageBubble } from './message-bubble';
import { StreamingText } from './streaming-text';
import { ThinkingIndicator } from './thinking-indicator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquarePlus } from 'lucide-react';

interface MessageListProps {
  messages: ChatMessage[];
  streaming?: { runId: string; content: string; seq: number };
  loading: boolean;
  projectColor?: string;
  onReply?: (message: ChatMessage) => void;
}

export function MessageList({
  messages,
  streaming,
  loading,
  projectColor,
  onReply,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  // Smart auto-scroll: only scroll to bottom if user is near the bottom
  const checkNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 120;
    isNearBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  useEffect(() => {
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, streaming?.content]);

  // Empty state
  if (messages.length === 0 && !streaming && !loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-muted-foreground">
        <MessageSquarePlus className="h-12 w-12 opacity-30" />
        <div className="text-center">
          <h3 className="font-medium">Start a conversation</h3>
          <p className="mt-1 text-sm">
            Send a message to begin chatting with your AI agent.
          </p>
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {[
            'Help me with a coding task',
            'Write a script to...',
            'Explain how to...',
          ].map((suggestion) => (
            <button
              key={suggestion}
              className="rounded-full border bg-background px-3 py-1.5 text-xs transition-colors hover:bg-accent"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto"
      onScroll={checkNearBottom}
    >
      <div className="mx-auto max-w-3xl py-4">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            projectColor={projectColor}
            onReply={onReply}
          />
        ))}

        {/* Thinking indicator — shows when loading (waiting for first delta) */}
        {loading && !streaming && <ThinkingIndicator />}

        {/* Streaming text — shows live AI response */}
        {streaming && <StreamingText content={streaming.content} />}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
