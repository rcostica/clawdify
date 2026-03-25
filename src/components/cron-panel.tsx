'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Clock,
  Play,
  Trash2,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Power,
  PowerOff,
  Timer,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface CronSchedule {
  kind: string;
  expr: string;
  tz?: string;
}

interface CronState {
  nextRunAtMs?: number;
  lastRunAtMs?: number;
  lastRunStatus?: string;
  lastStatus?: string;
  lastDurationMs?: number;
  consecutiveErrors?: number;
  lastError?: string;
}

interface CronRun {
  runId?: string;
  ts?: number;
  startedAtMs?: number;
  runAtMs?: number;
  finishedAtMs?: number;
  status: string;
  error?: string;
  durationMs?: number;
  summary?: string;
  action?: string;
}

interface CronJob {
  id: string;
  name: string;
  enabled: boolean;
  schedule: CronSchedule;
  sessionTarget?: string;
  payload?: { kind: string; message: string };
  delivery?: { mode: string };
  state?: CronState;
  recentRuns?: CronRun[];
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelative(ms: number): string {
  const diff = ms - Date.now();
  const absDiff = Math.abs(diff);
  const isPast = diff < 0;

  if (absDiff < 60000) return isPast ? 'just now' : 'in <1m';
  if (absDiff < 3600000) {
    const mins = Math.round(absDiff / 60000);
    return isPast ? `${mins}m ago` : `in ${mins}m`;
  }
  if (absDiff < 86400000) {
    const hrs = Math.round(absDiff / 3600000);
    return isPast ? `${hrs}h ago` : `in ${hrs}h`;
  }
  const days = Math.round(absDiff / 86400000);
  return isPast ? `${days}d ago` : `in ${days}d`;
}

function cronToHuman(expr: string, tz?: string): string {
  const parts = expr.split(' ');
  if (parts.length !== 5) return expr;

  const [min, hour, dom, mon, dow] = parts;

  let desc = '';

  if (dom === '*' && mon === '*' && dow === '*') {
    if (hour === '*' && min === '*') desc = 'Every minute';
    else if (hour === '*') desc = `Every hour at :${min.padStart(2, '0')}`;
    else desc = `Daily at ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
  } else if (dom === '*' && mon === '*' && dow !== '*') {
    const dayNames: Record<string, string> = { '0': 'Sun', '1': 'Mon', '2': 'Tue', '3': 'Wed', '4': 'Thu', '5': 'Fri', '6': 'Sat', '7': 'Sun' };
    const days = dow.split(',').map(d => dayNames[d] || d).join(', ');
    desc = `${days} at ${hour.padStart(2, '0')}:${min.padStart(2, '0')}`;
  } else {
    desc = expr;
  }

  if (tz) desc += ` (${tz})`;
  return desc;
}

function StatusIcon({ status }: { status?: string }) {
  if (status === 'ok') return <CheckCircle className="h-4 w-4 text-green-500" />;
  if (status === 'error') return <XCircle className="h-4 w-4 text-red-500" />;
  return <Clock className="h-4 w-4 text-muted-foreground" />;
}

function JobRow({ job, onAction, actionLoading }: {
  job: CronJob;
  onAction: (action: string, jobId: string) => void;
  actionLoading: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [runs, setRuns] = useState<CronRun[]>(job.recentRuns || []);
  const [loadingRuns, setLoadingRuns] = useState(false);

  const lastStatus = job.state?.lastRunStatus || job.state?.lastStatus;
  const isLoading = actionLoading === job.id;

  const fetchRuns = useCallback(async () => {
    setLoadingRuns(true);
    try {
      const res = await fetch(`/api/cron/${job.id}/runs`);
      const data = await res.json();
      setRuns(data.runs || []);
    } catch {
      toast.error('Failed to load runs');
    } finally {
      setLoadingRuns(false);
    }
  }, [job.id]);

  const handleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) fetchRuns();
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Main row */}
      <div
        className="flex items-center gap-3 p-3 sm:p-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={handleExpand}
      >
        <button className="shrink-0 text-muted-foreground">
          {expanded
            ? <ChevronDown className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />
          }
        </button>

        <StatusIcon status={job.enabled ? lastStatus : undefined} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{job.name}</span>
            <Badge
              variant={job.enabled ? 'default' : 'secondary'}
              className={job.enabled
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800'
              }
            >
              {job.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
            {(job.state?.consecutiveErrors ?? 0) > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {job.state!.consecutiveErrors} errors
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {cronToHuman(job.schedule.expr, job.schedule.tz)}
            </span>
            {job.state?.lastRunAtMs && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last: {formatRelative(job.state.lastRunAtMs)}
              </span>
            )}
            {job.state?.nextRunAtMs && job.enabled && (
              <span className="flex items-center gap-1">
                <Timer className="h-3 w-3" />
                Next: {formatRelative(job.state.nextRunAtMs)}
              </span>
            )}
            {job.state?.lastDurationMs && (
              <span>⏱ {formatDuration(job.state.lastDurationMs)}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title={job.enabled ? 'Disable' : 'Enable'}
            onClick={() => onAction(job.enabled ? 'disable' : 'enable', job.id)}
            disabled={isLoading}
          >
            {job.enabled
              ? <PowerOff className="h-4 w-4 text-amber-500" />
              : <Power className="h-4 w-4 text-green-500" />
            }
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Run now"
            onClick={() => onAction('run', job.id)}
            disabled={isLoading}
          >
            {isLoading && actionLoading === job.id
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Play className="h-4 w-4 text-blue-500" />
            }
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Delete"
            onClick={() => {
              if (confirm(`Delete cron job "${job.name}"?`)) {
                onAction('delete', job.id);
              }
            }}
            disabled={isLoading}
          >
            <Trash2 className="h-4 w-4 text-red-400" />
          </Button>
        </div>
      </div>

      {/* Last error */}
      {job.state?.lastError && lastStatus === 'error' && !expanded && (
        <div className="px-4 pb-3 -mt-1">
          <p className="text-xs text-red-500 dark:text-red-400 truncate">
            ⚠ {job.state.lastError}
          </p>
        </div>
      )}

      {/* Expanded: run history */}
      {expanded && (
        <div className="border-t bg-muted/20 p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium">Recent Runs</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchRuns}
              disabled={loadingRuns}
              className="h-7 text-xs"
            >
              {loadingRuns ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              <span className="ml-1">Refresh</span>
            </Button>
          </div>

          {loadingRuns && runs.length === 0 ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : runs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No runs recorded yet</p>
          ) : (
            <div className="space-y-2">
              {runs.map((run, i) => {
                const runStatus = run.status || (run.action === 'finished' ? 'ok' : 'unknown');
                const startTime = run.startedAtMs || run.runAtMs || run.ts;
                return (
                  <div
                    key={run.runId || i}
                    className="flex items-start gap-2 p-2 rounded-md bg-background border text-xs"
                  >
                    <StatusIcon status={runStatus} />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {startTime && (
                          <span className="text-muted-foreground">{formatTime(startTime)}</span>
                        )}
                        <Badge
                          variant={runStatus === 'ok' || runStatus === 'error' ? 'outline' : 'secondary'}
                          className={
                            runStatus === 'ok'
                              ? 'text-green-600 border-green-300 dark:text-green-400 dark:border-green-700'
                              : runStatus === 'error'
                              ? 'text-red-600 border-red-300 dark:text-red-400 dark:border-red-700'
                              : ''
                          }
                        >
                          {runStatus}
                        </Badge>
                        {run.durationMs && (
                          <span className="text-muted-foreground">
                            {formatDuration(run.durationMs)}
                          </span>
                        )}
                      </div>
                      {run.error && (
                        <p className="text-red-500 dark:text-red-400 break-words">{run.error}</p>
                      )}
                      {run.summary && (
                        <details className="group">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            Show summary
                          </summary>
                          <p className="mt-1 text-muted-foreground whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                            {run.summary}
                          </p>
                        </details>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Job details */}
          {job.payload?.message && (
            <details className="mt-3 group">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                Job payload
              </summary>
              <pre className="mt-1 text-xs text-muted-foreground bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words max-h-40">
                {job.payload.message}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

export function CronPanel() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchJobs = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch('/api/cron');
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch {
      if (!isRefresh) toast.error('Failed to load cron jobs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(() => fetchJobs(true), 30000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const handleAction = async (action: string, jobId: string) => {
    setActionLoading(jobId);
    try {
      const res = await fetch('/api/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, jobId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Action failed');
        return;
      }
      const labels: Record<string, string> = {
        enable: 'Job enabled',
        disable: 'Job disabled',
        run: 'Job triggered',
        delete: 'Job deleted',
      };
      toast.success(labels[action] || 'Done');
      // Refresh after a short delay for state to propagate
      setTimeout(() => fetchJobs(true), 1000);
    } catch {
      toast.error('Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cron Jobs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scheduled tasks managed by OpenClaw
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchJobs(true)}
          disabled={refreshing}
        >
          {refreshing
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <RefreshCw className="h-4 w-4" />
          }
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="py-3">
          <CardContent className="px-4 py-0">
            <p className="text-xs text-muted-foreground">Total Jobs</p>
            <p className="text-2xl font-bold">{jobs.length}</p>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="px-4 py-0">
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {jobs.filter(j => j.enabled).length}
            </p>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="px-4 py-0">
            <p className="text-xs text-muted-foreground">Disabled</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {jobs.filter(j => !j.enabled).length}
            </p>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="px-4 py-0">
            <p className="text-xs text-muted-foreground">Erroring</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {jobs.filter(j => (j.state?.consecutiveErrors ?? 0) > 0).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Jobs list */}
      {jobs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No cron jobs configured</p>
            <p className="text-xs text-muted-foreground mt-1">
              Use <code className="bg-muted px-1 rounded">openclaw cron add</code> to create one
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {jobs.map(job => (
            <JobRow
              key={job.id}
              job={job}
              onAction={handleAction}
              actionLoading={actionLoading}
            />
          ))}
        </div>
      )}
    </div>
  );
}
