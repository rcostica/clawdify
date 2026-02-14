'use client';

import { useEffect, useState } from 'react';
import { 
  CheckCircle2, MessageSquare, FileText, Plus, Edit3, 
  Activity, Clock 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AuditEntry {
  id: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: string;
  createdAt: string;
}

function getActionIcon(action: string, entityType?: string) {
  if (action?.includes('create') || action?.includes('Created')) return <Plus className="h-3.5 w-3.5 text-green-500" />;
  if (action?.includes('update') || action?.includes('Updated')) return <Edit3 className="h-3.5 w-3.5 text-blue-500" />;
  if (action?.includes('message') || entityType === 'message') return <MessageSquare className="h-3.5 w-3.5 text-purple-500" />;
  if (action?.includes('file') || entityType === 'file') return <FileText className="h-3.5 w-3.5 text-orange-500" />;
  if (action?.includes('complete') || action?.includes('done')) return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
  return <Activity className="h-3.5 w-3.5 text-muted-foreground" />;
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
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActivity() {
      try {
        const [auditRes, tasksRes] = await Promise.all([
          fetch('/api/audit').then(r => r.json()).catch(() => ({ logs: [] })),
          fetch('/api/tasks').then(r => r.json()).catch(() => ({ tasks: [] })),
        ]);

        const auditEntries: AuditEntry[] = (auditRes.logs || []).slice(0, 20).map((log: any) => ({
          id: log.id || String(Math.random()),
          action: log.action || 'Unknown action',
          entityType: log.entityType,
          entityId: log.entityId,
          details: log.details || log.description || `${log.action} ${log.entityType || ''}`.trim(),
          createdAt: log.createdAt,
        }));

        // If audit logs are sparse, supplement with recent task updates
        if (auditEntries.length < 5 && tasksRes.tasks) {
          const recentTasks = tasksRes.tasks
            .filter((t: any) => t.updatedAt)
            .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 10);
          
          for (const task of recentTasks) {
            if (!auditEntries.find(e => e.entityId === task.id && e.entityType === 'task')) {
              auditEntries.push({
                id: `task-${task.id}`,
                action: 'Updated',
                entityType: 'task',
                entityId: task.id,
                details: `Task "${task.title}" — ${task.status}`,
                createdAt: task.updatedAt,
              });
            }
          }
          auditEntries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }

        setEntries(auditEntries.slice(0, 20));
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
          <div className="space-y-1">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 py-1.5 group">
                <div className="mt-0.5 shrink-0">
                  {getActionIcon(entry.action, entry.entityType)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{entry.details || entry.action}</p>
                  <p className="text-xs text-muted-foreground">{formatTime(entry.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
