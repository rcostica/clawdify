'use client';

import { useMemo, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize from 'rehype-sanitize';
import { sanitizeSchema } from '@/lib/markdown-config';
import type { ChatMessage } from '@/stores/chat-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Copy,
  Check,
  Reply,
  CornerUpRight,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface MessageBubbleProps {
  message: ChatMessage;
  projectColor?: string;
  onReply?: (message: ChatMessage) => void;
}

export function MessageBubble({
  message,
  projectColor,
  onReply,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message.content]);

  const timestamp = useMemo(() => {
    if (!message.createdAt) return '';
    const date = new Date(message.createdAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  }, [message.createdAt]);

  if (isSystem) {
    return (
      <div className="flex justify-center px-4 py-2">
        <div className="rounded-lg bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group flex items-start gap-3 px-4 py-2 transition-colors hover:bg-muted/30',
        isUser && 'flex-row-reverse',
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-primary/10',
        )}
        style={isUser && projectColor ? { backgroundColor: projectColor } : undefined}
      >
        {isUser ? '👤' : '🤖'}
      </div>

      {/* Content */}
      <div className={cn('min-w-0 max-w-[80%] flex-1', isUser && 'text-right')}>
        <div
          className={cn(
            'inline-block rounded-2xl px-4 py-2.5 text-sm',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-muted rounded-tl-sm',
          )}
          style={
            isUser && projectColor
              ? { backgroundColor: projectColor, color: '#fff' }
              : undefined
          }
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none break-words text-left">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[
                  [rehypeSanitize, sanitizeSchema],
                  rehypeHighlight,
                ]}
                components={{
                  // 🔒 SECURITY: External links with noopener
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {children}
                    </a>
                  ),
                  // Code block with copy button
                  pre: ({ children }) => (
                    <div className="relative group/code">
                      <pre className="overflow-x-auto rounded-lg !bg-background/50 p-3 text-xs">
                        {children}
                      </pre>
                    </div>
                  ),
                  code: ({ className, children, ...props }) => {
                    const isInline = !className;
                    if (isInline) {
                      return (
                        <code
                          className="rounded bg-background/50 px-1.5 py-0.5 text-xs"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    }
                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Timestamp + Actions */}
        <div
          className={cn(
            'mt-1 flex items-center gap-1 text-xs text-muted-foreground',
            isUser ? 'justify-end' : 'justify-start',
            !hovered && 'opacity-0',
            'transition-opacity',
          )}
        >
          <span>{timestamp}</span>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy</TooltipContent>
            </Tooltip>
            {onReply && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onReply(message)}
                  >
                    <Reply className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reply</TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
