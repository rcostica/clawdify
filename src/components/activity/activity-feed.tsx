'use client';

import { useEffect, useRef } from 'react';
import type { ActivityEntry } from '@/stores/activity-store';
import { ActivityEntryComponent } from './activity-entry';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, Loader2 } from 'lucide-react';

interface ActivityFeedProps {
  entries: ActivityEntry[];
  isStreaming: boolean;
  taskTitle?: string;
}

export function ActivityFeed({ entries, isStreaming, taskTitle }: ActivityFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries arrive or streaming
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries.length, isStreaming]);

  if (entries.length === 0 && !isStreaming) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-4 py-8 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
          <Activity className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">No activity yet</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {taskTitle
              ? 'Activity will appear here when the agent starts working'
              : 'Select a task to see its activity'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" ref={scrollContainerRef}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Activity
        </span>
        {isStreaming && (
          <Loader2 className="h-3 w-3 animate-spin text-green-500" />
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {entries.length} events
        </span>
      </div>

      {/* Entries */}
      <ScrollArea className="flex-1">
        <div className="divide-y divide-border/50">
          {entries.map((entry) => (
            <ActivityEntryComponent key={entry.id} entry={entry} />
          ))}
        </div>

        {/* Streaming indicator */}
        {isStreaming && (
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="text-xs italic">Agent is working...</span>
          </div>
        )}

        <div ref={bottomRef} />
      </ScrollArea>
    </div>
  );
}
