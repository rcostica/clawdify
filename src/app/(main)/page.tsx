'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ActivityFeed } from '@/components/activity-feed';
import { 
  Wifi, WifiOff, CheckCircle2, Circle, Clock, 
  ListTodo, FolderOpen, MessageSquare 
} from 'lucide-react';
import Link from 'next/link';

interface GatewayStatus {
  connected: boolean;
  url?: string;
  error?: string;
}

interface TaskCounts {
  backlog: number;
  'in-progress': number;
  review: number;
  done: number;
  total: number;
}

interface ProjectSummary {
  total: number;
  active: number;
  lastActivity?: string;
}

interface RecentMessage {
  id: string;
  role: string;
  content: string;
  projectName?: string;
  createdAt: string;
}

export default function DashboardPage() {
  const [gateway, setGateway] = useState<GatewayStatus | null>(null);
  const [tasks, setTasks] = useState<TaskCounts>({ backlog: 0, 'in-progress': 0, review: 0, done: 0, total: 0 });
  const [projects, setProjects] = useState<ProjectSummary>({ total: 0, active: 0 });
  const [messages, setMessages] = useState<RecentMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      const [gwRes, tasksRes, projRes] = await Promise.all([
        fetch('/api/gateway/status').then(r => r.json()).catch(() => ({ connected: false })),
        fetch('/api/tasks').then(r => r.json()).catch(() => ({ tasks: [] })),
        fetch('/api/projects').then(r => r.json()).catch(() => ({ projects: [] })),
      ]);

      setGateway(gwRes);

      // Count tasks by status
      const taskList = tasksRes.tasks || [];
      const counts: TaskCounts = { backlog: 0, 'in-progress': 0, review: 0, done: 0, total: taskList.length };
      for (const t of taskList) {
        const s = t.status as keyof typeof counts;
        if (s in counts && s !== 'total') counts[s]++;
      }
      setTasks(counts);

      // Projects
      const projList = projRes.projects || [];
      const activeProjects = projList.filter((p: any) => p.status === 'active');
      setProjects({
        total: projList.length,
        active: activeProjects.length,
        lastActivity: projList[0]?.updatedAt,
      });

      // Try to get recent messages from search API
      try {
        const msgRes = await fetch('/api/search?query=*&limit=3').then(r => r.json());
        setMessages((msgRes.messages || []).slice(0, 3).map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.snippet || m.content || '',
          projectName: m.projectName,
          createdAt: m.createdAt,
        })));
      } catch {
        setMessages([]);
      }

      setLoading(false);
    }
    fetchAll();

    // Refresh gateway status every 30s
    const interval = setInterval(async () => {
      const gw = await fetch('/api/gateway/status').then(r => r.json()).catch(() => ({ connected: false }));
      setGateway(gw);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const statusItems = [
    { key: 'backlog', label: 'Backlog', icon: Circle, count: tasks.backlog, color: 'text-muted-foreground' },
    { key: 'in-progress', label: 'In Progress', icon: Clock, count: tasks['in-progress'], color: 'text-blue-500' },
    { key: 'review', label: 'Review', icon: ListTodo, count: tasks.review, color: 'text-yellow-500' },
    { key: 'done', label: 'Done', icon: CheckCircle2, count: tasks.done, color: 'text-green-500' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your workspace</p>
      </div>

      {/* Top row: Gateway + Projects */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Gateway Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gateway</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-6 w-24 bg-muted rounded animate-pulse" />
            ) : (
              <div className="flex items-center gap-2">
                {gateway?.connected ? (
                  <>
                    <Wifi className="h-5 w-5 text-green-500" />
                    <span className="text-lg font-semibold text-green-500">Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-5 w-5 text-red-500" />
                    <span className="text-lg font-semibold text-red-500">Offline</span>
                  </>
                )}
              </div>
            )}
            {gateway?.url && (
              <p className="text-xs text-muted-foreground mt-1 font-mono">{gateway.url}</p>
            )}
          </CardContent>
        </Card>

        {/* Projects */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Projects</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-6 w-16 bg-muted rounded animate-pulse" />
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{projects.active}</span>
                  <span className="text-sm text-muted-foreground">active</span>
                  {projects.total > projects.active && (
                    <span className="text-xs text-muted-foreground">/ {projects.total} total</span>
                  )}
                </div>
                <Link href="/project/new" className="text-xs text-primary hover:underline mt-1 inline-block">
                  + New project
                </Link>
              </>
            )}
          </CardContent>
        </Card>

        {/* Tasks total */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-6 w-16 bg-muted rounded animate-pulse" />
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{tasks.total}</span>
                  <span className="text-sm text-muted-foreground">total</span>
                </div>
                <Link href="/kanban" className="text-xs text-primary hover:underline mt-1 inline-block">
                  Open Kanban →
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Task breakdown */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {statusItems.map(item => (
          <Card key={item.key} className="py-3">
            <CardContent className="px-4 py-0">
              <div className="flex items-center gap-2">
                <item.icon className={`h-4 w-4 ${item.color}`} />
                <span className="text-xs text-muted-foreground">{item.label}</span>
              </div>
              <p className="text-2xl font-bold mt-1">{item.count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom: Activity + Messages */}
      <div className="grid gap-4 md:grid-cols-2">
        <ActivityFeed />

        {/* Recent Conversations */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Recent Conversations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse space-y-1">
                    <div className="h-3 bg-muted rounded w-1/3" />
                    <div className="h-3 bg-muted rounded w-full" />
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent conversations. Select a project to start chatting.</p>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id} className="space-y-0.5">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {msg.projectName && <span className="font-medium">{msg.projectName}</span>}
                      <span>{msg.role}</span>
                    </div>
                    <p className="text-sm truncate">{msg.content}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
