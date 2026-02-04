import { create } from 'zustand';

export type ActivityType =
  | 'thinking'
  | 'tool_call'
  | 'file_read'
  | 'file_write'
  | 'command'
  | 'message'
  | 'error'
  | 'complete';

export interface ActivityEntry {
  id: string;
  taskId: string;
  timestamp: string;
  type: ActivityType;
  title: string;
  detail?: string;
  artifactId?: string;
}

interface ActivityState {
  entriesByTask: Record<string, ActivityEntry[]>;
  streamingTaskIds: Set<string>;

  // Actions
  addEntry: (taskId: string, entry: ActivityEntry) => void;
  clearEntries: (taskId: string) => void;
  setStreaming: (taskId: string, streaming: boolean) => void;
  getEntries: (taskId: string) => ActivityEntry[];
  isStreaming: (taskId: string) => boolean;
}

const MAX_ENTRIES_PER_TASK = 500;

export const useActivityStore = create<ActivityState>((set, get) => ({
  entriesByTask: {},
  streamingTaskIds: new Set(),

  addEntry: (taskId: string, entry: ActivityEntry) => {
    set((state) => {
      const existing = state.entriesByTask[taskId] ?? [];
      // Limit entries to prevent unbounded growth
      const entries = [...existing, entry];
      if (entries.length > MAX_ENTRIES_PER_TASK) {
        entries.splice(0, entries.length - MAX_ENTRIES_PER_TASK);
      }
      return {
        entriesByTask: {
          ...state.entriesByTask,
          [taskId]: entries,
        },
      };
    });
  },

  clearEntries: (taskId: string) => {
    set((state) => ({
      entriesByTask: {
        ...state.entriesByTask,
        [taskId]: [],
      },
    }));
  },

  setStreaming: (taskId: string, streaming: boolean) => {
    set((state) => {
      const newSet = new Set(state.streamingTaskIds);
      if (streaming) {
        newSet.add(taskId);
      } else {
        newSet.delete(taskId);
      }
      return { streamingTaskIds: newSet };
    });
  },

  getEntries: (taskId: string) => {
    return get().entriesByTask[taskId] ?? [];
  },

  isStreaming: (taskId: string) => {
    return get().streamingTaskIds.has(taskId);
  },
}));
