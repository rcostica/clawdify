'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  MessageSquare,
  Activity,
  Cpu,
  Layers,
  RefreshCw,
  ArrowUpDown,
  Zap,
  BookOpen,
} from 'lucide-react';
import { ProjectIcon } from '@/components/project-icon';

interface Summary {
  totalMessages: number;
  totalSessions: number;
  totalTokens: number;
  totalCompactions: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheRead: number;
  totalCacheWrite: number;
}

interface ProjectUsage {
  projectId: string;
  name: string;
  icon: string;
  status: string;
  messageCount: number;
  totalTokens: number;
  compactionCount: number;
  model: string | null;
  sessionCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheRead: number;
  cacheWrite: number;
  lastActivity: string | null;
}

interface DailyActivity {
  date: string;
  user: number;
  assistant: number;
  total: number;
}

interface UsageData {
  summary: Summary;
  projects: ProjectUsage[];
  dailyActivity: DailyActivity[];
  roleBreakdown: { role: string; count: number }[];
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function timeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function shortDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
}

export default function UsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/usage');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-6xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usage</h1>
          <p className="text-sm text-muted-foreground">Token usage and activity overview</p>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-20 bg-muted rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-24 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="h-40 bg-muted rounded animate-pulse" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 space-y-6 max-w-6xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usage</h1>
          <p className="text-sm text-muted-foreground">Token usage and activity overview</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{error || 'No data available'}</p>
            <button
              onClick={fetchData}
              className="mt-4 text-sm text-primary hover:underline"
            >
              Try again
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { summary, projects, dailyActivity } = data;
  const maxDaily = Math.max(...dailyActivity.map(d => d.total), 1);

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usage</h1>
          <p className="text-sm text-muted-foreground">Token usage and activity overview</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          title="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Updated {timeAgo(lastRefresh.toISOString())}</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary.totalMessages.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {data.roleBreakdown.find(r => r.role === 'user')?.count.toLocaleString() || 0} user · {data.roleBreakdown.find(r => r.role === 'assistant')?.count.toLocaleString() || 0} assistant
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary.totalSessions}</p>
            <p className="text-xs text-muted-foreground mt-1">Clawdify sessions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5" />
              Total Tokens
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatNumber(summary.totalTokens)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatNumber(summary.totalInputTokens)} in · {formatNumber(summary.totalOutputTokens)} out
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              Compactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary.totalCompactions}</p>
            <p className="text-xs text-muted-foreground mt-1">Context window resets</p>
          </CardContent>
        </Card>
      </div>

      {/* Cache stats */}
      {(summary.totalCacheRead > 0 || summary.totalCacheWrite > 0) && (
        <div className="grid gap-4 grid-cols-2">
          <Card className="py-3">
            <CardContent className="px-4 py-0">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                <span className="text-xs text-muted-foreground">Cache Read</span>
              </div>
              <p className="text-2xl font-bold mt-1">{formatNumber(summary.totalCacheRead)}</p>
            </CardContent>
          </Card>
          <Card className="py-3">
            <CardContent className="px-4 py-0">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Cache Write</span>
              </div>
              <p className="text-2xl font-bold mt-1">{formatNumber(summary.totalCacheWrite)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Daily Activity Chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4" />
            Daily Activity (14 days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1.5 h-40">
            {dailyActivity.map((day) => {
              const userHeight = maxDaily > 0 ? (day.user / maxDaily) * 100 : 0;
              const assistantHeight = maxDaily > 0 ? (day.assistant / maxDaily) * 100 : 0;
              return (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col items-center gap-0 group relative"
                >
                  {/* Tooltip */}
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 bg-popover text-popover-foreground border rounded-md shadow-md px-2 py-1 text-xs whitespace-nowrap">
                    <span className="font-medium">{formatDate(day.date)}</span>
                    <span className="text-muted-foreground"> · {day.user}u / {day.assistant}a</span>
                  </div>
                  {/* Bar stack */}
                  <div className="w-full flex flex-col justify-end h-32">
                    <div
                      className="w-full bg-blue-500/70 rounded-t-sm transition-all"
                      style={{ height: `${userHeight}%`, minHeight: day.user > 0 ? '2px' : '0px' }}
                    />
                    <div
                      className="w-full bg-muted-foreground/30 rounded-b-sm transition-all"
                      style={{ height: `${assistantHeight}%`, minHeight: day.assistant > 0 ? '2px' : '0px' }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1 hidden md:block">
                    {shortDay(day.date)}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-blue-500/70" />
              <span>User</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-muted-foreground/30" />
              <span>Assistant</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-Project Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Per-Project Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No project data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Project</th>
                    <th className="pb-2 pr-4 font-medium text-right">Messages</th>
                    <th className="pb-2 pr-4 font-medium text-right">Tokens</th>
                    <th className="pb-2 pr-4 font-medium text-right hidden md:table-cell">Compactions</th>
                    <th className="pb-2 pr-4 font-medium hidden lg:table-cell">Model</th>
                    <th className="pb-2 font-medium text-right hidden sm:table-cell">Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr key={project.projectId} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <ProjectIcon icon={project.icon} size="sm" />
                          <span className="font-medium truncate max-w-[150px]">{project.name}</span>
                          {project.sessionCount > 1 && (
                            <span className="text-xs text-muted-foreground">({project.sessionCount}s)</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                        {project.messageCount.toLocaleString()}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                        {formatNumber(project.totalTokens)}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono tabular-nums hidden md:table-cell">
                        {project.compactionCount}
                      </td>
                      <td className="py-2.5 pr-4 hidden lg:table-cell">
                        {project.model ? (
                          <span className="text-xs font-mono text-muted-foreground">
                            {project.model.split('/').pop()}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right hidden sm:table-cell">
                        {project.lastActivity ? (
                          <span className="text-xs text-muted-foreground">{timeAgo(project.lastActivity)}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
