'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  MessageSquare,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Bell,
  ListChecks,
  Shield,
  RefreshCw,
  Inbox,
} from 'lucide-react';

interface ActivityEntry {
  id: string;
  type: string;
  title: string;
  detail: string;
  projectName: string;
  projectIcon: string;
  timestamp: string;
}

type TimeFilter = 'hour' | 'today' | 'week' | 'all' | 'gone';

function getTypeIcon(type: string) {
  switch (type) {
    case 'message':
      return <MessageSquare className="h-4 w-4" />;
    case 'task_completed':
      return <CheckCircle2 className="h-4 w-4" />;
    case 'task_created':
      return <ListChecks className="h-4 w-4" />;
    case 'task_updated':
      return <ListChecks className="h-4 w-4" />;
    case 'cron_run':
      return <Clock className="h-4 w-4" />;
    case 'audit':
      return <Shield className="h-4 w-4" />;
    default:
      return <Bell className="h-4 w-4" />;
  }
}

function getTypeColor(type: string, title: string) {
  if (title.includes('❌') || title.includes('Error') || title.includes('error')) {
    return 'text-red-500 bg-red-500/10';
  }
  switch (type) {
    case 'message':
      return 'text-blue-500 bg-blue-500/10';
    case 'task_completed':
      return 'text-green-500 bg-green-500/10';
    case 'task_created':
      return 'text-amber-500 bg-amber-500/10';
    case 'task_updated':
      return 'text-amber-500 bg-amber-500/10';
    case 'cron_run':
      return 'text-green-500 bg-green-500/10';
    case 'audit':
      return 'text-purple-500 bg-purple-500/10';
    default:
      return 'text-muted-foreground bg-muted';
  }
}

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDateGroup(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const entryDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (entryDay.getTime() === today.getTime()) return 'Today';
  if (entryDay.getTime() === yesterday.getTime()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getSinceParam(filter: TimeFilter): string | undefined {
  const now = Date.now();
  switch (filter) {
    case 'hour':
      return new Date(now - 60 * 60 * 1000).toISOString();
    case 'today':
      return new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    case 'week':
      return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    case 'gone':
      return new Date(now - 8 * 60 * 60 * 1000).toISOString();
    case 'all':
    default:
      return undefined;
  }
}

export default function ActivityPage() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TimeFilter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const fetchActivity = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const since = getSinceParam(filter);
      const url = since
        ? `/api/activity?since=${encodeURIComponent(since)}`
        : '/api/activity';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (err) {
      console.error('Failed to fetch activity:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    fetchActivity();
  }, [fetchActivity]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchActivity(), 30000);
    return () => clearInterval(interval);
  }, [fetchActivity]);

  // Group entries by date
  const grouped: { label: string; items: ActivityEntry[] }[] = [];
  for (const entry of entries) {
    const label = getDateGroup(entry.timestamp);
    const existing = grouped.find((g) => g.label === label);
    if (existing) {
      existing.items.push(entry);
    } else {
      grouped.push({ label, items: [entry] });
    }
  }

  const filterButtons: { key: TimeFilter; label: string }[] = [
    { key: 'gone', label: 'Since I was gone' },
    { key: 'hour', label: 'Last hour' },
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Last 7 days' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
            <p className="text-sm text-muted-foreground">
              What happened across your projects
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchActivity(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Time filters */}
        <div className="flex flex-wrap gap-2 pt-2">
          {filterButtons.map((btn) => (
            <Button
              key={btn.key}
              variant={filter === btn.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(btn.key)}
              className={btn.key === 'gone' ? 'border-dashed' : ''}
            >
              {btn.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="h-8 w-8 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No recent activity</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {filter === 'gone'
                ? 'Nothing happened while you were away'
                : 'Activity from your projects will appear here'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.label}>
              {/* Date separator */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {group.label}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Timeline entries */}
              <div className="space-y-1">
                {group.items.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    {/* Icon */}
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${getTypeColor(entry.type, entry.title)}`}
                    >
                      {getTypeIcon(entry.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug truncate">
                        {entry.projectIcon && (
                          <span className="mr-1">{entry.projectIcon}</span>
                        )}
                        <span className="font-medium">{entry.title}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {entry.detail}
                      </p>
                    </div>

                    {/* Timestamp */}
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 pt-0.5">
                      {relativeTime(entry.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
