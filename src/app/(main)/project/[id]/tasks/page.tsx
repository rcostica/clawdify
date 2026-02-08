'use client';

import { useEffect, useState, use } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, ArrowRight, Trash2, Loader2 } from 'lucide-react';

interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  status: 'backlog' | 'in-progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
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

export default function ProjectTasksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingToColumn, setAddingToColumn] = useState<Task['status'] | null>(null);

  useEffect(() => {
    async function fetchTasks() {
      try {
        const res = await fetch(`/api/tasks?projectId=${id}`);
        const data = await res.json();
        setTasks(data.tasks || []);
      } catch (err) {
        console.error('Failed to fetch tasks:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchTasks();
  }, [id]);

  const addTask = async (status: Task['status']) => {
    if (!newTaskTitle.trim()) return;
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: id, title: newTaskTitle.trim(), status }),
      });
      const data = await res.json();
      if (data.task) setTasks((prev) => [...prev, data.task]);
    } catch (err) {
      console.error('Failed to add task:', err);
    }
    setNewTaskTitle('');
    setAddingToColumn(null);
  };

  const moveTask = async (taskId: string, newStatus: Task['status']) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
    } catch (err) {
      console.error('Failed to move task:', err);
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const getNextStatus = (status: Task['status']): Task['status'] | null => {
    const idx = COLUMNS.findIndex((c) => c.key === status);
    return idx < COLUMNS.length - 1 ? COLUMNS[idx + 1].key : null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-x-auto p-4">
      <div className="flex gap-4 h-full min-w-max">
        {COLUMNS.map((column) => {
          const columnTasks = tasks.filter((t) => t.status === column.key);
          return (
            <div key={column.key} className="w-64 flex flex-col">
              <div className={`rounded-t-lg border-t-4 ${column.color} bg-muted/50 px-3 py-2 flex items-center justify-between`}>
                <h2 className="font-medium text-sm">{column.label}</h2>
                <span className="text-xs text-muted-foreground bg-background rounded-full px-2 py-0.5">
                  {columnTasks.length}
                </span>
              </div>
              <ScrollArea className="flex-1 bg-muted/20 rounded-b-lg border border-t-0">
                <div className="p-2 space-y-2">
                  {columnTasks.map((task) => (
                    <Card key={task.id} className="shadow-sm">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium flex-1">{task.title}</p>
                          <div className="flex items-center gap-0.5 shrink-0">
                            {getNextStatus(task.status) && (
                              <Button variant="ghost" size="icon" className="h-6 w-6"
                                onClick={() => moveTask(task.id, getNextStatus(task.status)!)}>
                                <ArrowRight className="h-3 w-3" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteTask(task.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded mt-2 inline-block ${PRIORITY_COLORS[task.priority]}`}>
                          {task.priority}
                        </span>
                      </CardContent>
                    </Card>
                  ))}
                  {addingToColumn === column.key ? (
                    <div className="space-y-2">
                      <Input placeholder="Task title..." value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') addTask(column.key);
                          if (e.key === 'Escape') { setAddingToColumn(null); setNewTaskTitle(''); }
                        }}
                        autoFocus className="text-sm" />
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => addTask(column.key)} className="text-xs">Add</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setAddingToColumn(null); setNewTaskTitle(''); }} className="text-xs">Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground text-xs"
                      onClick={() => setAddingToColumn(column.key)}>
                      <Plus className="h-3 w-3 mr-1" /> Add task
                    </Button>
                  )}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>
    </div>
  );
}
