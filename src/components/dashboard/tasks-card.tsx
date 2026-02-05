'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ListTodo,
  Plus,
  ArrowRight,
  Circle,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTaskStore, type Task } from '@/stores/task-store';
import { useProjectStore } from '@/stores/project-store';

const statusConfig: Record<Task['status'], { icon: typeof Circle; color: string; pulse?: boolean }> = {
  active: { icon: Loader2, color: 'text-green-500', pulse: true },
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

interface TasksCardProps {
  onNewTask?: () => void;
}

export function TasksCard({ onNewTask }: TasksCardProps) {
  const tasksByProject = useTaskStore((s) => s.tasksByProject);
  const projects = useProjectStore((s) => s.projects);

  // Aggregate and sort tasks: active first, then by date
  const recentTasks = useMemo(() => {
    const all: (Task & { projectName: string })[] = [];
    for (const project of projects) {
      const tasks = tasksByProject[project.id] ?? [];
      for (const task of tasks) {
        all.push({ ...task, projectName: project.name });
      }
    }
    
    // Sort: active first, then by date descending
    all.sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (b.status === 'active' && a.status !== 'active') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    return all.slice(0, 5);
  }, [tasksByProject, projects]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListTodo className="h-4 w-4" />
            Tasks
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onNewTask}>
            <Plus className="h-3 w-3" />
            New
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {recentTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No tasks yet
          </p>
        ) : (
          <>
            {recentTasks.map((task) => {
              const config = statusConfig[task.status];
              const Icon = config.icon;
              return (
                <Link
                  key={task.id}
                  href={`/project/${task.projectId}`}
                  className="flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-accent/50"
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
                  <span className="text-xs text-muted-foreground shrink-0">
                    {timeAgo(task.createdAt)}
                  </span>
                </Link>
              );
            })}
            <Link
              href="/dashboard"
              className="flex items-center justify-center gap-1 pt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View All Tasks
              <ArrowRight className="h-3 w-3" />
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
