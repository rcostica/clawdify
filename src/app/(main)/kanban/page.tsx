'use client';

import { useEffect, useState, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { TaskDetailModal } from '@/components/task-detail-modal';
import { KanbanBoard } from '@/components/kanban-board';
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

const COLUMNS = [
  { key: 'backlog', label: 'Backlog', color: 'border-t-slate-400' },
  { key: 'in-progress', label: 'In Progress', color: 'border-t-blue-500' },
  { key: 'review', label: 'Review', color: 'border-t-yellow-500' },
  { key: 'done', label: 'Done', color: 'border-t-green-500' },
];

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

  useEffect(() => { fetchProjects(); }, []);
  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const addTask = async (status: Task['status']) => {
    if (!newTaskTitle.trim()) return;
    const projectId = selectedProject || projects[0]?.id;
    if (!projectId) { toast.error('Create a project first!'); return; }

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, title: newTaskTitle.trim(), status, dueDate: newTaskDueDate || null }),
      });
      const data = await res.json();
      if (data.task) { setTasks((prev) => [...prev, data.task]); toast.success('Task created'); }
    } catch { toast.error('Failed to create task'); }

    setNewTaskTitle('');
    setNewTaskDueDate('');
    setAddingToColumn(null);
  };

  const deleteTask = async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      toast.success('Task deleted');
    } catch { toast.error('Failed to delete task'); }
  };

  const handleTaskClick = (task: Task, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setSelectedTask(task);
    setModalOpen(true);
  };

  const handleTaskUpdate = (updatedTask: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
  };

  const handleTaskDelete = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
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
                <div className={`rounded-t-lg border-t-4 ${column.color} bg-muted/50 px-3 py-2`}>
                  <Skeleton className="h-4 w-20" />
                </div>
                <div className="flex-1 bg-muted/20 rounded-b-lg border border-t-0 p-2 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full rounded" />
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
      <div className="border-b px-4 sm:px-6 py-3 flex items-center justify-between">
        <h1 className="text-lg sm:text-xl font-semibold">Kanban Board</h1>
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="text-sm border rounded-md px-2 py-1.5 bg-background"
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-x-auto p-4">
        <KanbanBoard
          tasks={tasks}
          setTasks={setTasks}
          onTaskClick={handleTaskClick}
          addingToColumn={addingToColumn}
          setAddingToColumn={setAddingToColumn}
          newTaskTitle={newTaskTitle}
          setNewTaskTitle={setNewTaskTitle}
          newTaskDueDate={newTaskDueDate}
          setNewTaskDueDate={setNewTaskDueDate}
          onAddTask={addTask}
          onDeleteTask={deleteTask}
          showDueDate
        />
      </div>

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
