import { create } from 'zustand';

interface NotificationsState {
  unreadProjects: Set<string>;
  markUnread: (projectId: string) => void;
  markRead: (projectId: string) => void;
  isUnread: (projectId: string) => boolean;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  unreadProjects: new Set<string>(),

  markUnread: (projectId: string) =>
    set((state) => {
      const next = new Set(state.unreadProjects);
      next.add(projectId);
      return { unreadProjects: next };
    }),

  markRead: (projectId: string) =>
    set((state) => {
      const next = new Set(state.unreadProjects);
      next.delete(projectId);
      return { unreadProjects: next };
    }),

  isUnread: (projectId: string) => get().unreadProjects.has(projectId),
}));

// localStorage helpers for "last seen" timestamps
export function getLastSeen(projectId: string): number {
  if (typeof window === 'undefined') return 0;
  const val = localStorage.getItem(`clawdify-lastseen-${projectId}`);
  return val ? parseInt(val, 10) : 0;
}

export function setLastSeen(projectId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`clawdify-lastseen-${projectId}`, Date.now().toString());
}
