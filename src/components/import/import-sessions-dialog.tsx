'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Download,
  CheckCircle2,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchGatewaySessions,
  importSessions,
  type GatewaySession,
  type ImportProgress,
} from '@/lib/import-sessions';
import { fetchProjects } from '@/lib/projects';
import { useProjectStore } from '@/stores/project-store';
import { cn } from '@/lib/utils';

interface ImportSessionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportSessionsDialog({
  open,
  onOpenChange,
}: ImportSessionsDialogProps) {
  const [sessions, setSessions] = useState<GatewaySession[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setProjects = useProjectStore((s) => s.setProjects);

  // Fetch sessions when dialog opens
  useEffect(() => {
    if (!open) return;
    let mounted = true;

    setLoading(true);
    setError(null);
    setSessions([]);
    setSelected(new Set());
    setProgress(null);

    fetchGatewaySessions()
      .then((result) => {
        if (!mounted) return;
        setSessions(result);
        setSelected(new Set(result.map((s) => s.key)));
      })
      .catch((err) => {
        if (!mounted) return;
        setError(
          err instanceof Error ? err.message : 'Failed to fetch sessions',
        );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [open]);

  const toggleSession = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === sessions.length) {
        return new Set();
      }
      return new Set(sessions.map((s) => s.key));
    });
  }, [sessions]);

  const handleImport = useCallback(async () => {
    const toImport = sessions.filter((s) => selected.has(s.key));
    if (toImport.length === 0) {
      toast.error('No sessions selected');
      return;
    }

    setImporting(true);
    try {
      const result = await importSessions(toImport, setProgress);
      toast.success(
        `Imported ${result.imported} sessions with ${result.totalMessages} messages`,
      );

      // Reload projects
      const projects = await fetchProjects();
      setProjects(projects);

      onOpenChange(false);
    } catch (err) {
      toast.error('Import failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setImporting(false);
    }
  }, [sessions, selected, setProjects, onOpenChange]);

  const getDisplayName = (s: GatewaySession) =>
    s.label || s.derivedTitle || s.key.split(':').pop() || s.key;

  const formatAge = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffDays = Math.floor(
        (now.getTime() - date.getTime()) / 86400000,
      );
      if (diffDays < 1) return 'today';
      if (diffDays === 1) return 'yesterday';
      if (diffDays < 30) return `${diffDays}d ago`;
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={importing ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Import from Gateway
          </DialogTitle>
          <DialogDescription>
            Import existing conversations from your OpenClaw Gateway into
            Clawdify projects.
          </DialogDescription>
        </DialogHeader>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Fetching sessions...
            </span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Session list */}
        {!loading && !error && sessions.length > 0 && !importing && (
          <>
            <div className="flex items-center justify-between px-1">
              <button
                className="text-xs text-primary hover:underline"
                onClick={toggleAll}
              >
                {selected.size === sessions.length
                  ? 'Deselect all'
                  : 'Select all'}
              </button>
              <span className="text-xs text-muted-foreground">
                {selected.size} of {sessions.length} selected
              </span>
            </div>

            <ScrollArea className="max-h-72">
              <div className="space-y-1 pr-3">
                {sessions.map((session) => {
                  const icon = session.key.includes('discord')
                    ? '💬'
                    : session.key.includes('slack')
                      ? '💼'
                      : session.key.includes('telegram')
                        ? '📱'
                        : '🤖';
                  return (
                    <button
                      key={session.key}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                        selected.has(session.key)
                          ? 'border-primary/50 bg-primary/5'
                          : 'border-transparent hover:bg-muted/50',
                      )}
                      onClick={() => toggleSession(session.key)}
                    >
                      <div
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
                          selected.has(session.key)
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-muted-foreground/30',
                        )}
                      >
                        {selected.has(session.key) && (
                          <Check className="h-3 w-3" />
                        )}
                      </div>
                      <span className="text-lg">{icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {getDisplayName(session)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {session.key}
                        </p>
                      </div>
                      {formatAge(session.updatedAt) && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatAge(session.updatedAt)}
                        </span>
                      )}
                      {session.lastMessage && (
                        <Badge
                          variant="secondary"
                          className="text-xs shrink-0"
                        >
                          has messages
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        )}

        {/* Empty */}
        {!loading && !error && sessions.length === 0 && !importing && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No sessions found on the Gateway.
          </div>
        )}

        {/* Progress */}
        {importing && progress && (
          <div className="space-y-3 py-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  progress.phase === 'done' ? 'bg-green-500' : 'bg-primary',
                )}
                style={{
                  width: `${progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0}%`,
                }}
              />
            </div>
            <div className="flex items-center gap-2 text-sm">
              {progress.phase === 'importing' && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>
                    Importing {progress.completed + 1} of {progress.total}
                    {progress.currentSession
                      ? ` — ${progress.currentSession}`
                      : ''}
                  </span>
                </>
              )}
              {progress.phase === 'done' && (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Done!</span>
                </>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {!importing && (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {sessions.length === 0 ? 'Close' : 'Cancel'}
              </Button>
              {sessions.length > 0 && (
                <Button
                  onClick={handleImport}
                  disabled={selected.size === 0}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Import {selected.size} session
                  {selected.size !== 1 ? 's' : ''}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
