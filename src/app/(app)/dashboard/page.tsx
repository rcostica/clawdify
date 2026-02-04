'use client';

import { useEffect, useState } from 'react';
import { useProjectStore } from '@/stores/project-store';
import { useGatewayStore } from '@/stores/gateway-store';
import { useTaskStore, type Task } from '@/stores/task-store';
import { AgentStatus } from '@/components/activity/agent-status';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Wifi,
  Keyboard,
  Rocket,
  ListTodo,
  ChevronRight,
  CheckCircle2,
  Loader2,
  XCircle,
  Circle,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const statusIcons: Record<Task['status'], typeof Circle> = {
  queued: Circle,
  active: Loader2,
  done: CheckCircle2,
  failed: XCircle,
  cancelled: Circle,
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

export default function AppHomePage() {
  const projects = useProjectStore((s) => s.projects);
  const loading = useProjectStore((s) => s.loading);
  const isConnected = useGatewayStore((s) => s.status === 'connected');
  const tasksByProject = useTaskStore((s) => s.tasksByProject);
  const loadTasks = useTaskStore((s) => s.loadTasks);

  // Load tasks for all projects
  useEffect(() => {
    for (const project of projects) {
      if (!tasksByProject[project.id]) {
        loadTasks(project.id);
      }
    }
  }, [projects, tasksByProject, loadTasks]);

  // Aggregate recent tasks across all projects
  const recentTasks: (Task & { projectName: string; projectIcon: string })[] = [];
  for (const project of projects) {
    const tasks = tasksByProject[project.id] ?? [];
    for (const task of tasks) {
      recentTasks.push({
        ...task,
        projectName: project.name,
        projectIcon: project.icon,
      });
    }
  }
  recentTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const topTasks = recentTasks.slice(0, 8);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-2xl">
            🐾
          </div>
          <div>
            <h2 className="text-2xl font-bold">Mission Control</h2>
            <p className="text-sm text-muted-foreground">
              Manage your AI agent tasks
            </p>
          </div>
        </div>

        {/* Agent Status */}
        <AgentStatus />

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          {!isConnected && (
            <>
              <Link href="/deploy">
                <Button variant="default" className="gap-2">
                  <Rocket className="h-4 w-4" />
                  Deploy Agent
                </Button>
              </Link>
              <Link href="/connect">
                <Button variant="outline" className="gap-2">
                  <Wifi className="h-4 w-4" />
                  Connect Gateway
                </Button>
              </Link>
            </>
          )}
          {isConnected && projects.length === 0 && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                document.querySelector<HTMLButtonElement>('[data-new-project]')?.click();
              }}
            >
              <Plus className="h-4 w-4" />
              Create First Project
            </Button>
          )}
        </div>

        {/* Recent Tasks */}
        {topTasks.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Recent Tasks</h3>
            </div>
            <div className="space-y-1.5">
              {topTasks.map((task) => {
                const Icon = statusIcons[task.status];
                return (
                  <Link
                    key={task.id}
                    href={`/project/${task.projectId}`}
                    className="flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-accent/50"
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0',
                        statusColors[task.status],
                        task.status === 'active' && 'animate-spin',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {task.projectIcon} {task.projectName} · {timeAgo(task.createdAt)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Projects quick access */}
        {projects.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Projects</h3>
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
              {projects.slice(0, 6).map((project) => {
                const projectTasks = tasksByProject[project.id] ?? [];
                const activeTasks = projectTasks.filter((t) => t.status === 'active').length;
                return (
                  <Link
                    key={project.id}
                    href={`/project/${project.id}`}
                    className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors hover:bg-accent/50"
                  >
                    <span className="text-lg">{project.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{project.name}</p>
                      {activeTasks > 0 && (
                        <Badge variant="secondary" className="text-[10px] mt-0.5">
                          {activeTasks} active
                        </Badge>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Keyboard shortcuts hint */}
        <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
          <div className="flex items-center gap-2">
            <Keyboard className="h-3.5 w-3.5" />
            <span>Keyboard shortcuts:</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <span>
              <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd>
              {' '}Search
            </span>
            <span>
              <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono">⌘N</kbd>
              {' '}New Project
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
