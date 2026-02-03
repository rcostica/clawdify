'use client';

import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize from 'rehype-sanitize';
import { sanitizeSchema } from '@/lib/markdown-config';
import { cn } from '@/lib/utils';

interface StreamingTextProps {
  content: string;
  className?: string;
}

export function StreamingText({ content, className }: StreamingTextProps) {
  const memoizedContent = useMemo(() => content, [content]);

  return (
    <div className={cn('flex items-start gap-3 px-4 py-3', className)}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm">
        🤖
      </div>
      <div className="min-w-0 flex-1">
        <div className="prose prose-sm dark:prose-invert max-w-none break-words">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[
              [rehypeSanitize, sanitizeSchema],
              rehypeHighlight,
            ]}
            components={{
              // 🔒 SECURITY: External links open in new tab with noopener
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
            }}
          >
            {memoizedContent}
          </ReactMarkdown>
          {/* Blinking cursor */}
          <span className="inline-block h-4 w-0.5 animate-pulse bg-foreground/70 align-middle" />
        </div>
      </div>
    </div>
  );
}
