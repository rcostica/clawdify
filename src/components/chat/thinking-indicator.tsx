'use client';

import { cn } from '@/lib/utils';

export function ThinkingIndicator({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2 px-4 py-3', className)}>
      <div className="flex items-center gap-1.5 rounded-2xl bg-muted px-4 py-3">
        <span className="text-sm text-muted-foreground">Thinking</span>
        <div className="flex gap-1">
          <span
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  );
}
