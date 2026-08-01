import { api, ApiError } from "@/lib/api/client";
import { useOfflineQueueStore } from "@/stores/offline-queue-store";

let flushing = false;

// Retries every queued request in order, stopping at the first one that
// still fails on a genuine network error (still offline — preserve order,
// try again next trigger) rather than racing all of them at once. A
// queued item that fails with a real ApiError (rare — its input was
// already accepted once client-side) is dropped instead of blocking every
// later item forever.
export async function flushOfflineQueue(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const { queue, dequeue } = useOfflineQueueStore.getState();
    for (const item of queue) {
      try {
        await api.post(item.path, item.body);
        dequeue(item.id);
      } catch (err) {
        if (err instanceof ApiError) {
          dequeue(item.id);
        } else {
          break;
        }
      }
    }
  } finally {
    flushing = false;
  }
}
