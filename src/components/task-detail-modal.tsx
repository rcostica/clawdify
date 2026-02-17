'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, Clock, Trash2, X, Save, Loader2, AlertTriangle, Plus, CheckSquare, Square } from 'lucide-react';
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

interface SubTask {
  id: string;
  title: string;
  status: string;
}

interface TaskDetailModalProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (task: Task) => void;
  onDelete: (taskId: string) => void;
}

const STATUS_OPTIONS = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  { value: 'high', label: 'High', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
];

export function TaskDetailModal({
  task,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
}: TaskDetailModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<Task['status']>('backlog');
  const [priority, setPriority] = useState<Task['priority']>('medium');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);
  const [addingSubTask, setAddingSubTask] = useState(false);
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('');

  // Sync form state when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setStatus(task.status);
      setPriority(task.priority);
      setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
    }
  }, [task]);

  // Fetch sub-tasks when task changes
  useEffect(() => {
    if (!task) { setSubTasks([]); return; }
    async function fetchSubTasks() {
      try {
        const res = await fetch(`/api/tasks?projectId=${task!.projectId}`);
        if (!res.ok) return;
        const data = await res.json();
        const subs = (data.tasks || []).filter((t: { parentTaskId?: string | null }) => t.parentTaskId === task!.id);
        setSubTasks(subs);
      } catch { /* ignore */ }
    }
    fetchSubTasks();
  }, [task]);

  const addSubTask = async () => {
    if (!task || !newSubTaskTitle.trim()) return;
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: task.projectId,
          title: newSubTaskTitle.trim(),
          status: 'backlog',
          parentTaskId: task.id,
        }),
      });
      if (!res.ok) throw new Error('Failed to create sub-task');
      const data = await res.json();
      setSubTasks(prev => [...prev, data.task]);
      setNewSubTaskTitle('');
      setAddingSubTask(false);
      toast.success('Sub-task added');
    } catch {
      toast.error('Failed to add sub-task');
    }
  };

  const toggleSubTask = async (subTask: SubTask) => {
    const newStatus = subTask.status === 'done' ? 'backlog' : 'done';
    setSubTasks(prev => prev.map(st => st.id === subTask.id ? { ...st, status: newStatus } : st));
    try {
      await fetch(`/api/tasks/${subTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      // Revert on failure
      setSubTasks(prev => prev.map(st => st.id === subTask.id ? { ...st, status: subTask.status } : st));
      toast.error('Failed to update sub-task');
    }
  };

  const deleteSubTask = async (subTaskId: string) => {
    const prev = subTasks;
    setSubTasks(st => st.filter(s => s.id !== subTaskId));
    try {
      await fetch(`/api/tasks/${subTaskId}`, { method: 'DELETE' });
    } catch {
      setSubTasks(prev);
      toast.error('Failed to delete sub-task');
    }
  };

  const hasChanges = task && (
    title !== task.title ||
    description !== (task.description || '') ||
    status !== task.status ||
    priority !== task.priority ||
    dueDate !== (task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '')
  );

  const handleSave = async () => {
    if (!task || !title.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          status,
          priority,
          dueDate: dueDate || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to update task');

      const data = await res.json();
      onUpdate(data.task);
      toast.success('Task updated');
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to update task:', err);
      toast.error('Failed to update task');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!task) return;

    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete task');

      onDelete(task.id);
      toast.success('Task deleted');
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to delete task:', err);
      toast.error('Failed to delete task');
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="sr-only">Edit Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              className="text-lg font-medium border-0 px-0 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent dark:text-zinc-100"
            />
          </div>

          {/* Description */}
          <div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              className="min-h-[100px] resize-none dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
            />
          </div>

          {/* Status and Priority row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Status
              </label>
              <Select value={status} onValueChange={(v) => setStatus(v as Task['status'])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Priority
              </label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Task['priority'])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-xs ${opt.color}`}>
                        {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Due Date
            </label>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="flex-1 text-sm border rounded-md px-3 py-2 bg-background dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
              />
              {dueDate && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setDueDate('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Sub-tasks */}
          <div className="pt-2 border-t dark:border-zinc-700">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <CheckSquare className="h-3.5 w-3.5" />
                Sub-tasks
                {subTasks.length > 0 && (
                  <span className="text-[10px] text-muted-foreground/70">
                    ({subTasks.filter(s => s.status === 'done').length}/{subTasks.length})
                  </span>
                )}
              </label>
              {!addingSubTask && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setAddingSubTask(true)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              )}
            </div>
            {subTasks.length > 0 && (
              <div className="space-y-1 mb-2">
                {subTasks.map((st) => (
                  <div key={st.id} className="flex items-center gap-2 group/sub">
                    <button
                      onClick={() => toggleSubTask(st)}
                      className="shrink-0"
                    >
                      {st.status === 'done' ? (
                        <CheckSquare className="h-4 w-4 text-green-500" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    <span className={`text-sm flex-1 ${st.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                      {st.title}
                    </span>
                    <button
                      onClick={() => deleteSubTask(st.id)}
                      className="opacity-0 group-hover/sub:opacity-100 transition-opacity p-0.5 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {addingSubTask && (
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Sub-task title..."
                  value={newSubTaskTitle}
                  onChange={(e) => setNewSubTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addSubTask();
                    if (e.key === 'Escape') { setAddingSubTask(false); setNewSubTaskTitle(''); }
                  }}
                  autoFocus
                  className="h-8 text-sm flex-1"
                />
                <Button size="sm" className="h-8 text-xs" onClick={addSubTask}>Add</Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setAddingSubTask(false); setNewSubTaskTitle(''); }}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="text-xs text-muted-foreground dark:text-zinc-400 pt-2 border-t dark:border-zinc-700">
            Created {new Date(task.createdAt).toLocaleDateString()}
            {task.updatedAt && task.updatedAt !== task.createdAt && (
              <> · Updated {new Date(task.updatedAt).toLocaleDateString()}</>
            )}
          </div>

          {/* Actions */}
          {confirmingDelete ? (
            <div className="flex items-center justify-between pt-2 px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Delete this task?</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                >
                  No
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-1" />
                  )}
                  Yes, delete
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleDelete}
                disabled={deleting || saving}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  disabled={saving || deleting}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!hasChanges || !title.trim() || saving || deleting}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Save
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
