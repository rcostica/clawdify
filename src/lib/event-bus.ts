/**
 * Simple in-memory event bus for cross-device message sync.
 * When a message is saved to DB, emit it here.
 * SSE clients subscribe per-project and receive new messages instantly.
 */

type MessageEvent = {
  type: 'message';
  projectId: string;
  tabId?: string;
  message: {
    id: string;
    role: string;
    content: string;
    createdAt: string;
  };
};

type Listener = (event: MessageEvent) => void;

class EventBus {
  private listeners = new Map<string, Set<Listener>>();

  subscribe(projectId: string, listener: Listener): () => void {
    if (!this.listeners.has(projectId)) {
      this.listeners.set(projectId, new Set());
    }
    this.listeners.get(projectId)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(projectId)?.delete(listener);
      if (this.listeners.get(projectId)?.size === 0) {
        this.listeners.delete(projectId);
      }
    };
  }

  emit(event: MessageEvent): void {
    const listeners = this.listeners.get(event.projectId);
    if (!listeners) return;
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[event-bus] Listener error:', err);
      }
    }
  }

  /** Number of active listeners for a project */
  listenerCount(projectId: string): number {
    return this.listeners.get(projectId)?.size ?? 0;
  }
}

// Singleton — shared across all API routes in the same process
export const eventBus = new EventBus();
