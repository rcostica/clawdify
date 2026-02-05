'use client';

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Zap, Plus, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useGatewayStore } from '@/stores/gateway-store';
import { useTaskStore, type Task } from '@/stores/task-store';
import { useProjectStore } from '@/stores/project-store';

// Mock activity trail — will be replaced with real streaming in Phase 2
const MOCK_ACTIVITY_TRAIL = [
  'Installed deps',
  'Created page.tsx',
  'Added hero section',
];

interface CurrentHeroCardProps {
  onNewTask?: () => void;
}

export function CurrentHeroCard({ onNewTask }: CurrentHeroCardProps) {
  const status = useGatewayStore((s) => s.status);
  const tasksByProject = useTaskStore((s) => s.tasksByProject);
  const projects = useProjectStore((s) => s.projects);

  // Find the first active task across all projects
  const activeTaskWithProject = useMemo(() => {
    for (const project of projects) {
      const tasks = tasksByProject[project.id] ?? [];
      const activeTask = tasks.find((t) => t.status === 'active');
      if (activeTask) {
        return { task: activeTask, project };
      }
    }
    return null;
  }, [tasksByProject, projects]);

  const isConnected = status === 'connected';
  const isWorking = activeTaskWithProject !== null;

  // Mock progress — will be replaced with real progress tracking
  const mockProgress = isWorking ? 60 : 0;

  // Mock current file — will come from activity stream
  const mockCurrentFile = isWorking ? 'src/app/page.tsx' : null;

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

        {isWorking && activeTaskWithProject ? (
          <WorkingState
            task={activeTaskWithProject.task}
            projectName={activeTaskWithProject.project.name}
            currentFile={mockCurrentFile}
            progress={mockProgress}
            activityTrail={MOCK_ACTIVITY_TRAIL}
          />
        ) : (
          <IdleState isConnected={isConnected} onNewTask={onNewTask} />
        )}
      </CardContent>
    </Card>
  );
}

interface WorkingStateProps {
  task: Task;
  projectName: string;
  currentFile: string | null;
  progress: number;
  activityTrail: string[];
}

function WorkingState({
  task,
  projectName,
  currentFile,
  progress,
  activityTrail,
}: WorkingStateProps) {
  return (
    <div className="space-y-4">
      {/* Task title and project */}
      <div>
        <h3 className="text-lg font-semibold">{task.title}</h3>
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
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="text-muted-foreground/70">↳</span>
          {activityTrail.map((action, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span>{action}</span>
              {i < activityTrail.length - 1 && (
                <span className="text-muted-foreground/50">→</span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Link to task */}
      <Link href={`/project/${task.projectId}`}>
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 text-xs">
          View in {projectName}
          <ArrowRight className="h-3 w-3" />
        </Button>
      </Link>
    </div>
  );
}

interface IdleStateProps {
  isConnected: boolean;
  onNewTask?: () => void;
}

function IdleState({ isConnected, onNewTask }: IdleStateProps) {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">
        {isConnected
          ? 'Waiting for a task...'
          : 'Connect your Gateway to start working'}
      </p>

      <div className="flex gap-2">
        {isConnected ? (
          <Button onClick={onNewTask} className="gap-2">
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        ) : (
          <Link href="/connect">
            <Button className="gap-2">
              <Zap className="h-4 w-4" />
              Connect Gateway
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
