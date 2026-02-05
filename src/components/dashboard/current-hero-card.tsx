'use client';

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Zap, Wifi } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useGatewayStore } from '@/stores/gateway-store';
import { useTaskStore, type Task } from '@/stores/task-store';
import { useActivityStore } from '@/stores/activity-store';

export function CurrentHeroCard() {
  const status = useGatewayStore((s) => s.status);
  const tasks = useTaskStore((s) => s.tasks);
  const entriesByTask = useActivityStore((s) => s.entriesByTask);
  const streamingTaskIds = useActivityStore((s) => s.streamingTaskIds);

  // Find the first active task
  const activeTask = useMemo(() => {
    return tasks.find((t) => t.status === 'active') ?? null;
  }, [tasks]);

  const isConnected = status === 'connected';
  const isWorking = activeTask !== null || streamingTaskIds.size > 0;

  // Get activity data for the active task (or any streaming task)
  const activeTaskId = activeTask?.runId ?? 
    (streamingTaskIds.size > 0 ? Array.from(streamingTaskIds)[0] : null);
  const activityEntries = activeTaskId ? (entriesByTask[activeTaskId] ?? []) : [];
  
  // Get the last few entries for the activity trail
  const recentEntries = activityEntries.slice(-5);
  const activityTrail = recentEntries.map((e) => e.title);

  // Get current file from the most recent file_read or file_write entry
  const currentFile = useMemo(() => {
    for (let i = activityEntries.length - 1; i >= 0; i--) {
      const entry = activityEntries[i];
      if (entry && (entry.type === 'file_read' || entry.type === 'file_write') && entry.detail) {
        return entry.detail;
      }
    }
    return null;
  }, [activityEntries]);

  // Progress: rough estimate based on activity (just for visual feedback)
  const progress = Math.min(90, activityEntries.length * 10);

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent">
      <CardContent className="p-5">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Current
            </span>
          </div>

          {/* Agent status indicator */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Main</span>
            <div
              className={cn(
                'h-2.5 w-2.5 rounded-full transition-all',
                isWorking
                  ? 'bg-green-500 shadow-[0_0_8px_theme(colors.green.500)]'
                  : isConnected
                    ? 'bg-gray-400'
                    : 'bg-gray-600'
              )}
            />
            {!isWorking && (
              <span className="text-xs text-muted-foreground">
                {isConnected ? 'Idle' : 'Offline'}
              </span>
            )}
          </div>
        </div>

        {isWorking ? (
          <WorkingState
            task={activeTask}
            currentFile={currentFile}
            progress={progress}
            activityTrail={activityTrail}
            isStreaming={streamingTaskIds.size > 0}
          />
        ) : (
          <IdleState isConnected={isConnected} />
        )}
      </CardContent>
    </Card>
  );
}

interface WorkingStateProps {
  task: Task | null;
  currentFile: string | null;
  progress: number;
  activityTrail: string[];
  isStreaming: boolean;
}

function WorkingState({
  task,
  currentFile,
  progress,
  activityTrail,
  isStreaming,
}: WorkingStateProps) {
  // Title: use task title if available, otherwise indicate streaming
  const title = task?.title ?? (isStreaming ? 'Agent is working...' : 'Processing...');
  
  return (
    <div className="space-y-4">
      {/* Task title */}
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        {currentFile && (
          <p className="text-sm text-muted-foreground mt-0.5">
            Working on{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
              {currentFile}
            </code>
          </p>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <Progress value={progress} className="h-2" />
      </div>

      {/* Activity breadcrumb trail */}
      {activityTrail.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span className="text-muted-foreground/70">↳</span>
          {activityTrail.slice(-4).map((action, i, arr) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className="truncate max-w-[150px]">{action}</span>
              {i < arr.length - 1 && (
                <span className="text-muted-foreground/50">→</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface IdleStateProps {
  isConnected: boolean;
}

function IdleState({ isConnected }: IdleStateProps) {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">
        {isConnected
          ? 'Agent idle — waiting for a task...'
          : 'Connect your Gateway to start working'}
      </p>

      {!isConnected && (
        <Link href="/connect">
          <Button className="gap-2">
            <Wifi className="h-4 w-4" />
            Connect Gateway
          </Button>
        </Link>
      )}
    </div>
  );
}
