'use client';

import { useEffect, useState, useMemo, use } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Filter, X } from 'lucide-react';
import { KanbanBoard } from '@/components/kanban-board';
import { toast } from 'sonner';

interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  status: 'backlog' | 'in-progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
}

const PRIORITIES: Task['priority'][] = ['low', 'medium', 'high'];

export default function ProjectTasksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingToColumn, setAddingToColumn] = useState<Task['status'] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<Task['priority'] | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    async function fetchTasks() {
      try {
        const res = await fetch(`/api/tasks?projectId=${id}`);
        const data = await res.json();
        setTasks(data.tasks || []);
      } catch {
        toast.error('Failed to load tasks');
      } finally {
        setLoading(false);
      }
    }
    fetchTasks();
  }, [id]);

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

  const addTask = async (status: Task['status']) => {
    if (!newTaskTitle.trim()) return;
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: id, title: newTaskTitle.trim(), status }),
      });
      const data = await res.json();
      if (data.task) { setTasks((prev) => [...prev, data.task]); toast.success('Task created'); }
    } catch { toast.error('Failed to create task'); }
    setNewTaskTitle('');
    setAddingToColumn(null);
  };

  const deleteTask = async (taskId: string) => {
    const prev = tasks;
    setTasks((t) => t.filter((x) => x.id !== taskId));
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      toast.success('Task deleted');
    } catch {
      toast.error('Failed to delete task');
      setTasks(prev);
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
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Filter bar */}
      <div className="px-4 py-3 border-b flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tasks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9" />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button variant={showFilters ? 'secondary' : 'outline'} size="sm" onClick={() => setShowFilters(!showFilters)} className="h-9">
          <Filter className="h-4 w-4 mr-1.5" /> Filters
          {hasActiveFilters && <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-primary text-primary-foreground rounded-full">{(searchQuery ? 1 : 0) + (priorityFilter !== 'all' ? 1 : 0)}</span>}
        </Button>
        {hasActiveFilters && <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(''); setPriorityFilter('all'); }} className="h-9 text-muted-foreground">Clear all</Button>}
        <div className="text-xs text-muted-foreground ml-auto">{filteredTasks.length} of {tasks.length} tasks</div>
      </div>

      {showFilters && (
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Priority:</span>
            <div className="flex gap-1">
              <Button variant={priorityFilter === 'all' ? 'secondary' : 'ghost'} size="sm" onClick={() => setPriorityFilter('all')} className="h-7 text-xs">All</Button>
              {PRIORITIES.map((p) => (
                <Button key={p} variant={priorityFilter === p ? 'secondary' : 'ghost'} size="sm" onClick={() => setPriorityFilter(p)} className="h-7 text-xs capitalize">{p}</Button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-x-auto p-4">
        <KanbanBoard
          tasks={filteredTasks}
          setTasks={setTasks}
          addingToColumn={addingToColumn}
          setAddingToColumn={setAddingToColumn}
          newTaskTitle={newTaskTitle}
          setNewTaskTitle={setNewTaskTitle}
          onAddTask={addTask}
          onDeleteTask={deleteTask}
        />
      </div>
    </div>
  );
}
