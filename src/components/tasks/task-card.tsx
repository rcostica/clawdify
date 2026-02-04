'use client';

import type { Task } from '@/stores/task-store';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  Ban,
} from 'lucide-react';

interface TaskCardProps {
  task: Task;
  selected: boolean;
  onSelect: (id: string) => void;
  onCancel?: (id: string) => void;
}

const statusIcons: Record<Task['status'], typeof Circle> = {
  queued: Circle,
  active: Loader2,
  done: CheckCircle2,
  failed: XCircle,
  cancelled: Ban,
};

const statusColors: Record<Task['status'], string> = {
  queued: 'text-muted-foreground',
  active: 'text-green-500',
  done: 'text-green-500',
  failed: 'text-red-500',
  cancelled: 'text-muted-foreground/50',
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function TaskCard({ task, selected, onSelect, onCancel }: TaskCardProps) {
  const Icon = statusIcons[task.status];
  const colorClass = statusColors[task.status];

  return (
    <button
      onClick={() => onSelect(task.id)}
      className={cn(
        'group w-full text-left rounded-lg border px-3 py-2.5 transition-all',
        'hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        selected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-transparent',
        task.status === 'active' && 'border-green-500/30 bg-green-50/50 dark:bg-green-950/20',
      )}
    >
      <div className="flex items-start gap-2.5">
        <Icon
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0',
            colorClass,
            task.status === 'active' && 'animate-spin',
          )}
        />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'text-sm font-medium truncate',
              (task.status === 'cancelled') && 'line-through text-muted-foreground',
            )}
          >
            {task.title}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {timeAgo(task.createdAt)}
            {task.status === 'done' && task.completedAt && (
              <> · completed {timeAgo(task.completedAt)}</>
            )}
            {task.status === 'failed' && task.errorMessage && (
              <span className="text-red-500"> · {task.errorMessage.slice(0, 40)}</span>
            )}
          </p>
        </div>
        {task.status === 'active' && onCancel && (
          <button
            onClick={(e) => { e.stopPropagation(); onCancel(task.id); }}
            className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium text-red-500 opacity-0 transition-opacity hover:bg-red-500/10 group-hover:opacity-100"
            aria-label={`Cancel task: ${task.title}`}
          >
            Cancel
          </button>
        )}
      </div>
    </button>
  );
}
