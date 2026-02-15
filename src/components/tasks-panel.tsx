'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Filter, X } from 'lucide-react';
import { KanbanBoard } from '@/components/kanban-board';
import { TaskDetailModal } from '@/components/task-detail-modal';
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

const PRIORITIES: Task['priority'][] = ['low', 'medium', 'high'];

export function TasksPanel({ projectId, showAll = false }: { projectId: string; showAll?: boolean }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingToColumn, setAddingToColumn] = useState<Task['status'] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<Task['priority'] | 'all'>('all');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('');
  const [projects, setProjects] = useState<Array<{ id: string; name: string; icon: string }>>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (showAll) {
      fetch('/api/projects').then(r => r.json()).then(d => setProjects(d.projects || [])).catch(() => {});
    }
  }, [showAll]);

  useEffect(() => {
    async function fetchTasks() {
      try {
        const params = showAll
          ? (selectedProjectFilter ? `?projectId=${selectedProjectFilter}` : '')
          : `?projectId=${projectId}`;
        const res = await fetch(`/api/tasks${params}`);
        const data = await res.json();
        setTasks(data.tasks || []);
      } catch {
        toast.error('Failed to load tasks');
      } finally {
        setLoading(false);
      }
    }
    fetchTasks();
  }, [projectId, showAll, selectedProjectFilter]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!task.title.toLowerCase().includes(q) && !task.description?.toLowerCase().includes(q)) return false;
      }
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
      return true;
    });
  }, [tasks, searchQuery, priorityFilter]);

  const hasActiveFilters = searchQuery || priorityFilter !== 'all';

  const addTask = useCallback(async (status: Task['status']) => {
    if (!newTaskTitle.trim()) return;
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: selectedProjectFilter || projectId, title: newTaskTitle.trim(), status }),
      });
      const data = await res.json();
      if (data.task) { setTasks((prev) => [...prev, data.task]); toast.success('Task created'); }
    } catch { toast.error('Failed to create task'); }
    setNewTaskTitle('');
    setAddingToColumn(null);
  }, [projectId, newTaskTitle]);

  const deleteTask = useCallback(async (taskId: string) => {
    const prev = tasks;
    setTasks((t) => t.filter((x) => x.id !== taskId));
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      toast.success('Task deleted');
    } catch {
      toast.error('Failed to delete task');
      setTasks(prev);
    }
  }, [tasks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* Filter bar */}
      <div className="px-3 py-2 border-b flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[140px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search tasks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 h-8 text-xs" />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button variant={showFilters ? 'secondary' : 'outline'} size="sm" onClick={() => setShowFilters(!showFilters)} className="h-8 text-xs">
          <Filter className="h-3.5 w-3.5 mr-1" /> Filters
          {hasActiveFilters && <span className="ml-1 px-1 py-0.5 text-[10px] bg-primary text-primary-foreground rounded-full">{(searchQuery ? 1 : 0) + (priorityFilter !== 'all' ? 1 : 0)}</span>}
        </Button>
        {hasActiveFilters && <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(''); setPriorityFilter('all'); }} className="h-8 text-xs text-muted-foreground">Clear</Button>}
        {showAll && (
          <select
            value={selectedProjectFilter}
            onChange={(e) => setSelectedProjectFilter(e.target.value)}
            className="h-8 text-xs rounded-md border bg-background px-2"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
            ))}
          </select>
        )}
        <div className="text-xs text-muted-foreground ml-auto">{filteredTasks.length}/{tasks.length}</div>
      </div>

      {showFilters && (
        <div className="px-3 py-2 border-b bg-muted/30 flex items-center gap-3 flex-wrap">
          <span className="text-xs text-muted-foreground">Priority:</span>
          <div className="flex gap-1">
            <Button variant={priorityFilter === 'all' ? 'secondary' : 'ghost'} size="sm" onClick={() => setPriorityFilter('all')} className="h-6 text-xs px-2">All</Button>
            {PRIORITIES.map((p) => (
              <Button key={p} variant={priorityFilter === p ? 'secondary' : 'ghost'} size="sm" onClick={() => setPriorityFilter(p)} className="h-6 text-xs px-2 capitalize">{p}</Button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-3">
        <KanbanBoard
          tasks={filteredTasks}
          setTasks={setTasks}
          addingToColumn={addingToColumn}
          setAddingToColumn={setAddingToColumn}
          newTaskTitle={newTaskTitle}
          setNewTaskTitle={setNewTaskTitle}
          onAddTask={addTask}
          onDeleteTask={deleteTask}
          onTaskClick={(task, e) => {
            if ((e.target as HTMLElement).closest('button')) return;
            setSelectedTask(task);
            setModalOpen(true);
          }}
        />
      </div>

      <TaskDetailModal
        task={selectedTask}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onUpdate={(updated) => {
          setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        }}
        onDelete={(taskId) => {
          setTasks((prev) => prev.filter((t) => t.id !== taskId));
        }}
      />
    </div>
  );
}
