import { create } from "zustand";
import { persist } from "zustand/middleware";

// Deliberate exception to ui-store.ts's "server data never lives here" rule
// — these ARE requests bound for the server, but ones that failed to reach
// it due to a genuine connectivity gap (not a validation/auth error). The
// anti-theft feature's whole promise depends on every sale and cash check
// actually landing; silently losing one because a trader's connection
// dropped for ten seconds would quietly defeat that promise for exactly the
// traders most likely to have unreliable connectivity. Persisted so a
// queued item survives a page reload, app close, or phone restart before
// the network comes back.
export type QueuedRequestPath = "/v1/sales" | "/v1/cash-checks";

export interface QueuedRequest {
  id: string;
  path: QueuedRequestPath;
  body: unknown;
  queuedAt: string;
}

interface OfflineQueueState {
  queue: QueuedRequest[];
  enqueue: (path: QueuedRequestPath, body: unknown) => void;
  dequeue: (id: string) => void;
}

export const useOfflineQueueStore = create<OfflineQueueState>()(
  persist(
    (set) => ({
      queue: [],
      enqueue: (path, body) =>
        set((s) => ({
          queue: [
            ...s.queue,
            { id: crypto.randomUUID(), path, body, queuedAt: new Date().toISOString() },
          ],
        })),
      dequeue: (id) => set((s) => ({ queue: s.queue.filter((q) => q.id !== id) })),
    }),
    { name: "vela-pos-offline-queue" },
  ),
);
