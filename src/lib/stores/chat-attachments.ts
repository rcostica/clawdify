import { create } from 'zustand';

export interface PendingAttachment {
  path: string;
  name: string;
  size?: number;
  extension?: string;
}

interface ChatAttachmentsStore {
  pending: PendingAttachment[];
  addAttachment: (file: PendingAttachment) => void;
  clearPending: () => void;
}

export const useChatAttachmentsStore = create<ChatAttachmentsStore>((set) => ({
  pending: [],
  addAttachment: (file) =>
    set((state) => ({
      pending: state.pending.some((f) => f.path === file.path)
        ? state.pending
        : [...state.pending, file],
    })),
  clearPending: () => set({ pending: [] }),
}));
