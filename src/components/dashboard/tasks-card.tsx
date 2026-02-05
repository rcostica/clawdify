'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ListTodo,
  Plus,
  Circle,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTaskStore, type Task } from '@/stores/task-store';

const statusConfig: Record<Task['status'], { icon: typeof Circle; color: string }> = {
  active: { icon: Loader2, color: 'text-green-500' },
  queued: { icon: Circle, color: 'text-muted-foreground' },
  done: { icon: CheckCircle2, color: 'text-green-500' },
  failed: { icon: XCircle, color: 'text-red-500' },
  cancelled: { icon: Circle, color: 'text-muted-foreground/50' },
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function TasksCard() {
  const tasks = useTaskStore((s) => s.tasks);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const clearTasks = useTaskStore((s) => s.clearTasks);

  // Sort: active first, then by date descending
  const recentTasks = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (b.status === 'active' && a.status !== 'active') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return sorted.slice(0, 6);
  }, [tasks]);

  const completedCount = tasks.filter((t) => t.status === 'done').length;
  const hasCompleted = completedCount > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListTodo className="h-4 w-4" />
            Tasks
            {tasks.length > 0 && (
              <span className="text-xs text-muted-foreground font-normal">
                ({completedCount}/{tasks.length})
              </span>
            )}
          </CardTitle>
          {hasCompleted && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-muted-foreground"
              onClick={clearTasks}
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {recentTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No tasks yet — agent activity will appear here
          </p>
        ) : (
          recentTasks.map((task) => {
            const config = statusConfig[task.status];
            const Icon = config.icon;
            return (
              <div
                key={task.id}
                className="flex items-center gap-2.5 rounded-md px-2 py-1.5 group"
              >
                <Icon
                  className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    config.color,
                    task.status === 'active' && 'animate-spin'
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{task.title}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 group-hover:hidden">
                  {timeAgo(task.createdAt)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 hidden group-hover:flex"
                  onClick={() => deleteTask(task.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
