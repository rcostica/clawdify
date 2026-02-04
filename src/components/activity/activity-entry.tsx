'use client';

import { useState } from 'react';
import type { ActivityEntry as ActivityEntryType } from '@/stores/activity-store';
import { cn } from '@/lib/utils';
import {
  Brain,
  Eye,
  Pencil,
  Terminal,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Wrench,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface ActivityEntryProps {
  entry: ActivityEntryType;
}

const typeConfig = {
  thinking: { icon: Brain, color: 'text-muted-foreground', bg: '', label: 'Thinking' },
  tool_call: { icon: Wrench, color: 'text-purple-500', bg: '', label: 'Tool call' },
  file_read: { icon: Eye, color: 'text-cyan-500', bg: '', label: 'File read' },
  file_write: { icon: Pencil, color: 'text-orange-500', bg: '', label: 'File write' },
  command: { icon: Terminal, color: 'text-yellow-500', bg: '', label: 'Command' },
  message: { icon: MessageSquare, color: 'text-blue-500', bg: '', label: 'Message' },
  complete: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-950/20', label: 'Complete' },
  error: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/20', label: 'Error' },
};

function formatTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '--:--:--';
  }
}

export function ActivityEntryComponent({ entry }: ActivityEntryProps) {
  const [expanded, setExpanded] = useState(false);
  const config = typeConfig[entry.type];
  const Icon = config.icon;
  const hasDetail = !!entry.detail;

  return (
    <div
      className={cn(
        'group flex items-start gap-2 px-3 py-1.5 text-sm transition-colors',
        'hover:bg-accent/30',
        config.bg,
      )}
    >
      {/* Timestamp */}
      <span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums leading-5">
        {formatTime(entry.timestamp)}
      </span>

      {/* Icon */}
      <span role="img" aria-label={config.label}>
        <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', config.color)} />
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          {hasDetail && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              {expanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          )}
          <span
            className={cn(
              'truncate leading-5',
              entry.type === 'thinking' && 'italic text-muted-foreground',
              entry.type === 'complete' && 'font-medium text-green-700 dark:text-green-400',
              entry.type === 'error' && 'font-medium text-red-700 dark:text-red-400',
            )}
          >
            {entry.title}
          </span>
        </div>

        {/* Expandable detail */}
        {expanded && entry.detail && (
          <pre className="mt-1 overflow-x-auto rounded bg-muted/50 px-2 py-1.5 text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap break-all">
            {entry.detail}
          </pre>
        )}
      </div>
    </div>
  );
}
