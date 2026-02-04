import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: 'queued' | 'active' | 'done' | 'failed' | 'cancelled';
  runId?: string;
  sessionKey?: string;
  resultSummary?: string;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  sortOrder: number;
}

interface TaskState {
  tasksByProject: Record<string, Task[]>;
  selectedTaskId: string | null;
  loading: boolean;

  // Actions
  loadTasks: (projectId: string) => Promise<void>;
  createTask: (projectId: string, title: string, description?: string) => Promise<Task>;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  updateTaskByRunId: (runId: string, updates: Partial<Task>) => void;
  selectTask: (taskId: string | null) => void;
  cancelTask: (taskId: string) => Promise<void>;
  getSelectedTask: () => Task | null;
  getTasksByProject: (projectId: string) => Task[];
}

function mapDbToTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    title: row.title as string,
    description: (row.description as string) ?? undefined,
    status: row.status as Task['status'],
    runId: (row.run_id as string) ?? undefined,
    sessionKey: (row.session_key as string) ?? undefined,
    resultSummary: (row.result_summary as string) ?? undefined,
    errorMessage: (row.error_message as string) ?? undefined,
    createdAt: row.created_at as string,
    startedAt: (row.started_at as string) ?? undefined,
    completedAt: (row.completed_at as string) ?? undefined,
    sortOrder: (row.sort_order as number) ?? 0,
  };
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasksByProject: {},
  selectedTaskId: null,
  loading: false,

  loadTasks: async (projectId: string) => {
    set({ loading: true });
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const tasks = (data ?? []).map(mapDbToTask);
      set((state) => ({
        tasksByProject: {
          ...state.tasksByProject,
          [projectId]: tasks,
        },
        loading: false,
      }));
    } catch (err) {
      console.error('Failed to load tasks:', err);
      set({ loading: false });
    }
  },

  createTask: async (projectId: string, title: string, description?: string) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const sessionKey = `agent:main:clawdify:${projectId}`;

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        project_id: projectId,
        user_id: user.id,
        title: title.trim().slice(0, 500),
        description: description?.trim().slice(0, 2000) ?? null,
        status: 'queued',
        session_key: sessionKey,
      })
      .select()
      .single();

    if (error) throw error;

    const task = mapDbToTask(data);

    set((state) => ({
      tasksByProject: {
        ...state.tasksByProject,
        [projectId]: [task, ...(state.tasksByProject[projectId] ?? [])],
      },
    }));

    return task;
  },

  updateTask: (taskId: string, updates: Partial<Task>) => {
    set((state) => {
      const newByProject = { ...state.tasksByProject };
      for (const [pid, tasks] of Object.entries(newByProject)) {
        const idx = tasks.findIndex((t) => t.id === taskId);
        if (idx !== -1) {
          const updatedTasks = [...tasks];
          updatedTasks[idx] = { ...updatedTasks[idx]!, ...updates };
          newByProject[pid] = updatedTasks;

          // Persist status changes to Supabase (fire and forget)
          if (updates.status || updates.runId || updates.resultSummary || updates.errorMessage) {
            const dbUpdates: Record<string, unknown> = {};
            if (updates.status) dbUpdates.status = updates.status;
            if (updates.runId) dbUpdates.run_id = updates.runId;
            if (updates.resultSummary) dbUpdates.result_summary = updates.resultSummary;
            if (updates.errorMessage) dbUpdates.error_message = updates.errorMessage;
            if (updates.startedAt) dbUpdates.started_at = updates.startedAt;
            if (updates.completedAt) dbUpdates.completed_at = updates.completedAt;

            const supabase = createClient();
            supabase
              .from('tasks')
              .update(dbUpdates)
              .eq('id', taskId)
              .then(({ error }) => {
                if (error) console.error('Failed to persist task update:', error);
              });
          }

          break;
        }
      }
      return { tasksByProject: newByProject };
    });
  },

  updateTaskByRunId: (runId: string, updates: Partial<Task>) => {
    const state = get();
    for (const tasks of Object.values(state.tasksByProject)) {
      const task = tasks.find((t) => t.runId === runId);
      if (task) {
        get().updateTask(task.id, updates);
        return;
      }
    }
  },

  selectTask: (taskId: string | null) => {
    set({ selectedTaskId: taskId });
  },

  cancelTask: async (taskId: string) => {
    const supabase = createClient();
    await supabase
      .from('tasks')
      .update({ status: 'cancelled', completed_at: new Date().toISOString() })
      .eq('id', taskId);

    get().updateTask(taskId, {
      status: 'cancelled',
      completedAt: new Date().toISOString(),
    });
  },

  getSelectedTask: () => {
    const state = get();
    if (!state.selectedTaskId) return null;
    for (const tasks of Object.values(state.tasksByProject)) {
      const task = tasks.find((t) => t.id === state.selectedTaskId);
      if (task) return task;
    }
    return null;
  },

  getTasksByProject: (projectId: string) => {
    return get().tasksByProject[projectId] ?? [];
  },
}));
