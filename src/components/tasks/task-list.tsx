'use client';

import { useMemo, useState } from 'react';
import type { Task } from '@/stores/task-store';
import { TaskCard } from './task-card';
import { TaskCreate } from './task-create';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, ListTodo } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskListProps {
  tasks: Task[];
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  onCreateTask: (title: string, description?: string) => void;
  onCancelTask?: (id: string) => void;
  isConnected: boolean;
}

export function TaskList({
  tasks,
  selectedTaskId,
  onSelectTask,
  onCreateTask,
  onCancelTask,
  isConnected,
}: TaskListProps) {
  const [showCompleted, setShowCompleted] = useState(false);

  const { active, queued, completed } = useMemo(() => {
    const active: Task[] = [];
    const queued: Task[] = [];
    const completed: Task[] = [];

    for (const task of tasks) {
      switch (task.status) {
        case 'active':
          active.push(task);
          break;
        case 'queued':
          queued.push(task);
          break;
        case 'done':
        case 'failed':
        case 'cancelled':
          completed.push(task);
          break;
      }
    }

    return { active, queued, completed };
  }, [tasks]);

  if (tasks.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
            <ListTodo className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">No tasks yet</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Create your first task to get started
            </p>
          </div>
        </div>
        <div className="border-t p-2">
          <TaskCreate
            onSubmit={onCreateTask}
            disabled={!isConnected}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {/* Active tasks */}
          {active.length > 0 && (
            <TaskSection label="Active" count={active.length} color="green">
              {active.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  selected={task.id === selectedTaskId}
                  onSelect={onSelectTask}
                  onCancel={onCancelTask}
                />
              ))}
            </TaskSection>
          )}

          {/* Queued tasks */}
          {queued.length > 0 && (
            <TaskSection label="Queued" count={queued.length} color="gray">
              {queued.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  selected={task.id === selectedTaskId}
                  onSelect={onSelectTask}
                />
              ))}
            </TaskSection>
          )}

          {/* Completed tasks */}
          {completed.length > 0 && (
            <div className="mt-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-1.5 text-xs text-muted-foreground h-7"
                onClick={() => setShowCompleted(!showCompleted)}
              >
                {showCompleted ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                Completed ({completed.length})
              </Button>
              {showCompleted && (
                <div className="mt-1 space-y-0.5 opacity-70">
                  {completed.slice(0, 10).map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      selected={task.id === selectedTaskId}
                      onSelect={onSelectTask}
                    />
                  ))}
                  {completed.length > 10 && (
                    <p className="px-3 py-1 text-xs text-muted-foreground">
                      +{completed.length - 10} more
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Task creation */}
      <div className="border-t p-2">
        <TaskCreate
          onSubmit={onCreateTask}
          disabled={!isConnected}
        />
      </div>
    </div>
  );
}

// ── Section helper ──

function TaskSection({
  label,
  count,
  color,
  children,
}: {
  label: string;
  count: number;
  color: 'green' | 'gray';
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 px-2 py-1.5">
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            color === 'green' ? 'bg-green-500 animate-pulse' : 'bg-gray-400',
          )}
        />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <span className="text-xs text-muted-foreground">({count})</span>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
