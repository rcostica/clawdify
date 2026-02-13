'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { TaskDetailModal } from '@/components/task-detail-modal';
import { Plus, GripVertical, Trash2, ArrowRight, Loader2, Calendar, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  status: 'backlog' | 'in-progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
  assignedTo?: string | null;
  dueDate?: Date | string | null;
  createdAt: Date;
  updatedAt: Date;
}

function formatDueDate(date: Date | string | null | undefined): { text: string; isOverdue: boolean; isSoon: boolean } {
  if (!date) return { text: '', isOverdue: false, isSoon: false };
  
  const dueDate = new Date(date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDateDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const diffDays = Math.ceil((dueDateDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  const isOverdue = diffDays < 0;
  const isSoon = diffDays >= 0 && diffDays <= 2;
  
  let text: string;
  if (diffDays === 0) {
    text = 'Today';
  } else if (diffDays === 1) {
    text = 'Tomorrow';
  } else if (diffDays === -1) {
    text = 'Yesterday';
  } else if (diffDays < -1) {
    text = `${Math.abs(diffDays)}d overdue`;
  } else if (diffDays <= 7) {
    text = `${diffDays}d`;
  } else {
    text = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  
  return { text, isOverdue, isSoon };
}

const COLUMNS: { key: Task['status']; label: string; color: string }[] = [
  { key: 'backlog', label: 'Backlog', color: 'border-t-slate-400' },
  { key: 'in-progress', label: 'In Progress', color: 'border-t-blue-500' },
  { key: 'review', label: 'Review', color: 'border-t-yellow-500' },
  { key: 'done', label: 'Done', color: 'border-t-green-500' },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  high: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

export default function KanbanPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [addingToColumn, setAddingToColumn] = useState<Task['status'] | null>(null);
  const [projects, setProjects] = useState<Array<{ id: string; name: string; icon: string }>>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const params = selectedProject ? `?projectId=${selectedProject}` : '';
      const res = await fetch(`/api/tasks${params}`);
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects((data.projects || []).filter((p: { status: string }) => p.status === 'active'));
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const addTask = async (status: Task['status']) => {
    if (!newTaskTitle.trim()) return;
    
    // Use first project if none selected
    const projectId = selectedProject || projects[0]?.id;
    if (!projectId) {
      toast.error('Create a project first!');
      return;
    }

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title: newTaskTitle.trim(),
          status,
          dueDate: newTaskDueDate || null,
        }),
      });
      const data = await res.json();
      if (data.task) {
        setTasks((prev) => [...prev, data.task]);
        toast.success('Task created');
      }
    } catch (err) {
      console.error('Failed to add task:', err);
      toast.error('Failed to create task');
    }

    setNewTaskTitle('');
    setNewTaskDueDate('');
    setAddingToColumn(null);
  };

  const moveTask = async (taskId: string, newStatus: Task['status']) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );
      const statusLabel = COLUMNS.find(c => c.key === newStatus)?.label || newStatus;
      toast.success(`Moved to ${statusLabel}`);
    } catch (err) {
      console.error('Failed to move task:', err);
      toast.error('Failed to move task');
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      toast.success('Task deleted');
    } catch (err) {
      console.error('Failed to delete task:', err);
      toast.error('Failed to delete task');
    }
  };

  const handleTaskClick = (task: Task, e: React.MouseEvent) => {
    // Don't open modal if clicking on action buttons
    if ((e.target as HTMLElement).closest('button')) return;
    setSelectedTask(task);
    setModalOpen(true);
  };

  const handleTaskUpdate = (updatedTask: Task) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
    );
  };

  const handleTaskDelete = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const getNextStatus = (status: Task['status']): Task['status'] | null => {
    const idx = COLUMNS.findIndex((c) => c.key === status);
    return idx < COLUMNS.length - 1 ? COLUMNS[idx + 1].key : null;
  };

  if (loading) {
    return (
      <div className="flex flex-col h-[calc(100vh-3.5rem)]">
        <div className="border-b px-4 sm:px-6 py-3 flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-36" />
        </div>
        <div className="flex-1 overflow-x-auto p-4">
          <div className="flex gap-4 h-full min-w-max">
            {COLUMNS.map((column) => (
              <div key={column.key} className="w-64 sm:w-72 flex flex-col">
                <div className={`rounded-t-lg border-t-4 ${column.color} bg-muted/50 px-3 py-2 flex items-center justify-between`}>
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-6 rounded-full" />
                </div>
                <div className="flex-1 bg-muted/20 rounded-b-lg border border-t-0 p-2 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="shadow-sm">
                      <CardContent className="p-3 space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-5 w-12 rounded" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="border-b px-4 sm:px-6 py-3 flex items-center justify-between">
        <h1 className="text-lg sm:text-xl font-semibold">Kanban Board</h1>
        <div className="flex items-center gap-2">
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="text-sm border rounded-md px-2 py-1.5 bg-background"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.icon} {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-4 h-full min-w-max">
          {COLUMNS.map((column) => {
            const columnTasks = tasks.filter((t) => t.status === column.key);
            
            return (
              <div key={column.key} className="w-64 sm:w-72 flex flex-col">
                {/* Column Header */}
                <div className={`rounded-t-lg border-t-4 ${column.color} bg-muted/50 px-3 py-2 flex items-center justify-between`}>
                  <h2 className="font-medium text-sm">{column.label}</h2>
                  <span className="text-xs text-muted-foreground bg-background rounded-full px-2 py-0.5">
                    {columnTasks.length}
                  </span>
                </div>

                {/* Tasks */}
                <ScrollArea className="flex-1 bg-muted/20 rounded-b-lg border border-t-0">
                  <div className="p-2 space-y-2">
                    {columnTasks.map((task) => (
                      <Card 
                        key={task.id} 
                        className="shadow-sm cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={(e) => handleTaskClick(task, e)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium flex-1">{task.title}</p>
                            <div className="flex items-center gap-0.5 shrink-0">
                              {getNextStatus(task.status) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => moveTask(task.id, getNextStatus(task.status)!)}
                                  title={`Move to ${getNextStatus(task.status)}`}
                                >
                                  <ArrowRight className="h-3 w-3" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteTask(task.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          {task.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {task.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${PRIORITY_COLORS[task.priority]}`}>
                              {task.priority}
                            </span>
                            {task.dueDate && (() => {
                              const { text, isOverdue, isSoon } = formatDueDate(task.dueDate);
                              return (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ${
                                  isOverdue 
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' 
                                    : isSoon 
                                      ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                }`}>
                                  {isOverdue ? <Clock className="h-2.5 w-2.5" /> : <Calendar className="h-2.5 w-2.5" />}
                                  {text}
                                </span>
                              );
                            })()}
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {/* Add Task */}
                    {addingToColumn === column.key ? (
                      <div className="space-y-2">
                        <Input
                          placeholder="Task title..."
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) addTask(column.key);
                            if (e.key === 'Escape') {
                              setAddingToColumn(null);
                              setNewTaskTitle('');
                              setNewTaskDueDate('');
                            }
                          }}
                          autoFocus
                          className="text-sm"
                        />
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <input
                            type="date"
                            value={newTaskDueDate}
                            onChange={(e) => setNewTaskDueDate(e.target.value)}
                            className="flex-1 text-xs border rounded px-2 py-1 bg-background"
                            placeholder="Due date (optional)"
                          />
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => addTask(column.key)} className="text-xs">
                            Add
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setAddingToColumn(null);
                              setNewTaskTitle('');
                              setNewTaskDueDate('');
                            }}
                            className="text-xs"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-muted-foreground text-xs"
                        onClick={() => setAddingToColumn(column.key)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add task
                      </Button>
                    )}
                  </div>
                </ScrollArea>
              </div>
            );
          })}
        </div>
      </div>

      {/* Task Detail Modal */}
      <TaskDetailModal
        task={selectedTask}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onUpdate={handleTaskUpdate}
        onDelete={handleTaskDelete}
      />
    </div>
  );
}
