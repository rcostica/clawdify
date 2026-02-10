'use client';

import { useEffect, useState, useMemo, use } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, ArrowRight, Trash2, Loader2, Search, Filter, X } from 'lucide-react';
import { toast } from 'sonner';

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

const PRIORITIES: Task['priority'][] = ['low', 'medium', 'high'];

export default function ProjectTasksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingToColumn, setAddingToColumn] = useState<Task['status'] | null>(null);
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<Task['priority'] | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    async function fetchTasks() {
      try {
        const res = await fetch(`/api/tasks?projectId=${id}`);
        const data = await res.json();
        setTasks(data.tasks || []);
      } catch (err) {
        console.error('Failed to fetch tasks:', err);
        toast.error('Failed to load tasks');
      } finally {
        setLoading(false);
      }
    }
    fetchTasks();
  }, [id]);

  // Filter tasks based on search and priority
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(query);
        const matchesDesc = task.description?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc) return false;
      }
      
      // Priority filter
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
        return false;
      }
      
      return true;
    });
  }, [tasks, searchQuery, priorityFilter]);

  const hasActiveFilters = searchQuery || priorityFilter !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setPriorityFilter('all');
  };

  const addTask = async (status: Task['status']) => {
    if (!newTaskTitle.trim()) return;
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: id, title: newTaskTitle.trim(), status }),
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
    setAddingToColumn(null);
  };

  const moveTask = async (taskId: string, newStatus: Task['status']) => {
    // Optimistic update
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      toast.success(`Moved to ${COLUMNS.find(c => c.key === newStatus)?.label}`);
    } catch (err) {
      console.error('Failed to move task:', err);
      toast.error('Failed to move task');
      // Revert on error
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: t.status } : t)));
    }
  };

  const deleteTask = async (taskId: string) => {
    const taskToDelete = tasks.find(t => t.id === taskId);
    // Optimistic update
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      toast.success('Task deleted');
    } catch (err) {
      console.error('Failed to delete task:', err);
      toast.error('Failed to delete task');
      // Revert on error
      if (taskToDelete) {
        setTasks((prev) => [...prev, taskToDelete]);
      }
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
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Filter bar */}
      <div className="px-4 py-3 border-b flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        
        <Button
          variant={showFilters ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="h-9"
        >
          <Filter className="h-4 w-4 mr-1.5" />
          Filters
          {hasActiveFilters && (
            <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-primary text-primary-foreground rounded-full">
              {(searchQuery ? 1 : 0) + (priorityFilter !== 'all' ? 1 : 0)}
            </span>
          )}
        </Button>
        
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-muted-foreground">
            Clear all
          </Button>
        )}
        
        <div className="text-xs text-muted-foreground ml-auto">
          {filteredTasks.length} of {tasks.length} tasks
        </div>
      </div>
      
      {/* Expanded filters */}
      {showFilters && (
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Priority:</span>
            <div className="flex gap-1">
              <Button
                variant={priorityFilter === 'all' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setPriorityFilter('all')}
                className="h-7 text-xs"
              >
                All
              </Button>
              {PRIORITIES.map((p) => (
                <Button
                  key={p}
                  variant={priorityFilter === p ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setPriorityFilter(p)}
                  className="h-7 text-xs capitalize"
                >
                  {p}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-4 h-full min-w-max">
          {COLUMNS.map((column) => {
            const columnTasks = filteredTasks.filter((t) => t.status === column.key);
            const totalColumnTasks = tasks.filter((t) => t.status === column.key).length;
            
            return (
              <div key={column.key} className="w-64 flex flex-col">
                <div className={`rounded-t-lg border-t-4 ${column.color} bg-muted/50 px-3 py-2 flex items-center justify-between`}>
                  <h2 className="font-medium text-sm">{column.label}</h2>
                  <span className="text-xs text-muted-foreground bg-background rounded-full px-2 py-0.5">
                    {hasActiveFilters ? `${columnTasks.length}/${totalColumnTasks}` : columnTasks.length}
                  </span>
                </div>
                <ScrollArea className="flex-1 bg-muted/20 rounded-b-lg border border-t-0">
                  <div className="p-2 space-y-2">
                    {columnTasks.length === 0 && hasActiveFilters && totalColumnTasks > 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No matching tasks
                      </p>
                    )}
                    {columnTasks.map((task) => (
                      <Card key={task.id} className="shadow-sm">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium flex-1">
                              {searchQuery ? (
                                <HighlightText text={task.title} query={searchQuery} />
                              ) : (
                                task.title
                              )}
                            </p>
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
    </div>
  );
}

// Helper component to highlight search matches
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}
