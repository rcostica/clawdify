'use client';

import { useEffect, useState } from 'react';
import { 
  CheckCircle2, MessageSquare, Plus, Edit3, 
  FolderKanban, Clock, ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ActivityEntry {
  id: string;
  type: 'task_created' | 'task_updated' | 'task_completed' | 'message' | 'project_created';
  title: string;
  detail?: string;
  createdAt: string;
}

function getIcon(type: ActivityEntry['type']) {
  switch (type) {
    case 'task_created': return <Plus className="h-3.5 w-3.5 text-green-500" />;
    case 'task_updated': return <ArrowRight className="h-3.5 w-3.5 text-blue-500" />;
    case 'task_completed': return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    case 'message': return <MessageSquare className="h-3.5 w-3.5 text-purple-500" />;
    case 'project_created': return <FolderKanban className="h-3.5 w-3.5 text-orange-500" />;
  }
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function ActivityFeed() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActivity() {
      try {
        const [tasksRes, projectsRes, auditRes] = await Promise.all([
          fetch('/api/tasks').then(r => r.json()).catch(() => ({ tasks: [] })),
          fetch('/api/projects').then(r => r.json()).catch(() => ({ projects: [] })),
          fetch('/api/audit').then(r => r.json()).catch(() => ({ logs: [] })),
        ]);

        const items: ActivityEntry[] = [];

        // Recent task activity (created or updated)
        const tasks = (tasksRes.tasks || [])
          .filter((t: any) => t.updatedAt || t.createdAt)
          .sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
          .slice(0, 15);

        for (const task of tasks) {
          const isNew = task.createdAt === task.updatedAt;
          const isDone = task.status === 'done';
          items.push({
            id: `task-${task.id}`,
            type: isDone ? 'task_completed' : isNew ? 'task_created' : 'task_updated',
            title: task.title,
            detail: isDone ? 'Completed' : isNew ? 'Created' : `Moved to ${task.status.replace('-', ' ')}`,
            createdAt: task.updatedAt || task.createdAt,
          });
        }

        // Recent projects
        const projects = (projectsRes.projects || [])
          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5);

        for (const project of projects) {
          items.push({
            id: `project-${project.id}`,
            type: 'project_created',
            title: `${project.icon || '📁'} ${project.name}`,
            detail: 'Project created',
            createdAt: project.createdAt,
          });
        }

        // Meaningful audit entries (skip auth_login/auth_logout)
        const meaningfulAudit = (auditRes.logs || [])
          .filter((log: any) => !log.action?.startsWith('auth_'))
          .slice(0, 10);

        for (const log of meaningfulAudit) {
          let title = log.action;
          try {
            if (log.details) {
              const parsed = JSON.parse(log.details);
              title = parsed.name || parsed.title || log.action;
            }
          } catch { /* not JSON */ }
          items.push({
            id: `audit-${log.id}`,
            type: 'task_updated',
            title,
            detail: log.action,
            createdAt: log.createdAt,
          });
        }

        // Sort by date, take top 20
        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setEntries(items.slice(0, 20));
      } catch {
        setEntries([]);
      } finally {
        setLoading(false);
      }
    }
    fetchActivity();
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="h-4 w-4 rounded bg-muted mt-0.5" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-2.5 bg-muted rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent activity</p>
        ) : (
          <div className="space-y-1 overflow-x-hidden">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 py-1.5 overflow-hidden">
                <div className="mt-0.5 shrink-0">
                  {getIcon(entry.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{entry.title}</p>
                  <p className="text-xs text-muted-foreground">{entry.detail} · {formatTime(entry.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
