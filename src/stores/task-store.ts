import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Task {
  id: string;
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
  tasks: Task[];
  selectedTaskId: string | null;
  loading: boolean;

  // Actions
  createTask: (title: string, description?: string) => Task;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  updateTaskByRunId: (runId: string, updates: Partial<Task>) => void;
  selectTask: (taskId: string | null) => void;
  cancelTask: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
  clearTasks: () => void;
  getSelectedTask: () => Task | null;
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],
      selectedTaskId: null,
      loading: false,

      createTask: (title: string, description?: string) => {
        const task: Task = {
          id: crypto.randomUUID(),
          title: title.trim().slice(0, 500),
          description: description?.trim().slice(0, 2000),
          status: 'queued',
          createdAt: new Date().toISOString(),
          sortOrder: get().tasks.length,
        };

        set((state) => ({
          tasks: [task, ...state.tasks],
        }));

        return task;
      },

      updateTask: (taskId: string, updates: Partial<Task>) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, ...updates } : t,
          ),
        }));
      },

      updateTaskByRunId: (runId: string, updates: Partial<Task>) => {
        const task = get().tasks.find((t) => t.runId === runId);
        if (task) {
          get().updateTask(task.id, updates);
        }
      },

      selectTask: (taskId: string | null) => {
        set({ selectedTaskId: taskId });
      },

      cancelTask: (taskId: string) => {
        get().updateTask(taskId, {
          status: 'cancelled',
          completedAt: new Date().toISOString(),
        });
      },

      deleteTask: (taskId: string) => {
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== taskId),
          selectedTaskId:
            state.selectedTaskId === taskId ? null : state.selectedTaskId,
        }));
      },

      clearTasks: () => {
        set({ tasks: [], selectedTaskId: null });
      },

      getSelectedTask: () => {
        const state = get();
        if (!state.selectedTaskId) return null;
        return state.tasks.find((t) => t.id === state.selectedTaskId) ?? null;
      },
    }),
    {
      name: 'clawdify-tasks',
      partialize: (state) => ({
        tasks: state.tasks,
      }),
    },
  ),
);
