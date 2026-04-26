'use client';

import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

const components: Components = {
  // Links: open in new tab, styled
  a: ({ href, children, ...props }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-500 dark:text-blue-400 underline underline-offset-2 hover:text-blue-600 dark:hover:text-blue-300 break-all"
      {...props}
    >
      {children}
    </a>
  ),
  // Bold
  strong: ({ children, ...props }) => (
    <strong className="font-semibold" {...props}>{children}</strong>
  ),
  // Italic
  em: ({ children, ...props }) => (
    <em {...props}>{children}</em>
  ),
  // Inline code
  code: ({ children, className, ...props }) => {
    // Check if it's a code block (has language class) vs inline
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return (
        <code className={`${className || ''} block bg-black/10 dark:bg-white/10 rounded-md p-3 my-2 text-xs font-mono overflow-x-auto whitespace-pre`} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="bg-black/10 dark:bg-white/10 rounded px-1.5 py-0.5 text-xs font-mono" {...props}>
        {children}
      </code>
    );
  },
  // Code blocks (pre wrapper)
  pre: ({ children, ...props }) => (
    <pre className="my-2 overflow-x-auto" {...props}>{children}</pre>
  ),
  // Paragraphs — no extra margin for tight chat bubbles
  p: ({ children, ...props }) => (
    <p className="mb-1.5 last:mb-0" {...props}>{children}</p>
  ),
  // Lists
  ul: ({ children, ...props }) => (
    <ul className="list-disc list-inside mb-1.5 space-y-0.5" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="list-decimal list-inside mb-1.5 space-y-0.5" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }) => (
    <li className="leading-relaxed" {...props}>{children}</li>
  ),
  // Headings — scaled down for chat context
  h1: ({ children, ...props }) => (
    <h1 className="text-base font-bold mb-1 mt-2 first:mt-0" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-sm font-bold mb-1 mt-2 first:mt-0" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-sm font-semibold mb-1 mt-1.5 first:mt-0" {...props}>{children}</h3>
  ),
  // Blockquote
  blockquote: ({ children, ...props }) => (
    <blockquote className="border-l-2 border-muted-foreground/30 pl-3 my-1.5 italic text-muted-foreground" {...props}>
      {children}
    </blockquote>
  ),
  // Horizontal rule
  hr: ({ ...props }) => (
    <hr className="my-2 border-border/50" {...props} />
  ),
  // Tables (GFM)
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full text-xs border-collapse" {...props}>{children}</table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-black/5 dark:bg-white/5" {...props}>{children}</thead>
  ),
  th: ({ children, ...props }) => (
    <th className="border border-border/50 px-2 py-1 text-left font-semibold" {...props}>{children}</th>
  ),
  td: ({ children, ...props }) => (
    <td className="border border-border/50 px-2 py-1" {...props}>{children}</td>
  ),
  // Images — render inline with max size
  img: ({ src, alt, ...props }) => (
    <img
      src={src}
      alt={alt || ''}
      className="max-w-full max-h-[300px] rounded-md my-1"
      loading="lazy"
      {...props}
    />
  ),
};

interface MarkdownMessageProps {
  content: string;
  className?: string;
}

export const MarkdownMessage = memo(function MarkdownMessage({ content, className }: MarkdownMessageProps) {
  return (
    <div className={`text-sm leading-relaxed markdown-message ${className || ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
});

MarkdownMessage.displayName = 'MarkdownMessage';
