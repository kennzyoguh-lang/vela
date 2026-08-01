import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/client", () => ({
  api: { post: vi.fn() },
  ApiError: class ApiError extends Error {
    constructor(
      public code: string,
      message: string,
      public status: number,
    ) {
      super(message);
    }
  },
}));
vi.mock("@/stores/offline-queue-store", () => ({
  useOfflineQueueStore: { getState: vi.fn() },
}));

import { api, ApiError } from "@/lib/api/client";
import { useOfflineQueueStore } from "@/stores/offline-queue-store";
import { flushOfflineQueue } from "./flushOfflineQueue";

describe("flushOfflineQueue", () => {
  const dequeue = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends every queued item in order and dequeues each on success", async () => {
    const queue = [
      { id: "1", path: "/v1/sales" as const, body: { a: 1 }, queuedAt: "" },
      { id: "2", path: "/v1/cash-checks" as const, body: { b: 2 }, queuedAt: "" },
    ];
    vi.mocked(useOfflineQueueStore.getState).mockReturnValue({ queue, dequeue } as never);
    vi.mocked(api.post).mockResolvedValue({});

    await flushOfflineQueue();

    expect(api.post).toHaveBeenNthCalledWith(1, "/v1/sales", { a: 1 });
    expect(api.post).toHaveBeenNthCalledWith(2, "/v1/cash-checks", { b: 2 });
    expect(dequeue).toHaveBeenCalledWith("1");
    expect(dequeue).toHaveBeenCalledWith("2");
  });

  it("stops at the first item that still fails with a network error, preserving order for next time", async () => {
    const queue = [
      { id: "1", path: "/v1/sales" as const, body: { a: 1 }, queuedAt: "" },
      { id: "2", path: "/v1/sales" as const, body: { b: 2 }, queuedAt: "" },
    ];
    vi.mocked(useOfflineQueueStore.getState).mockReturnValue({ queue, dequeue } as never);
    vi.mocked(api.post).mockRejectedValue(new TypeError("Failed to fetch"));

    await flushOfflineQueue();

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(dequeue).not.toHaveBeenCalled();
  });

  it("drops (dequeues) an item that fails with a real ApiError instead of blocking every later item", async () => {
    const queue = [
      { id: "1", path: "/v1/sales" as const, body: { a: 1 }, queuedAt: "" },
      { id: "2", path: "/v1/sales" as const, body: { b: 2 }, queuedAt: "" },
    ];
    vi.mocked(useOfflineQueueStore.getState).mockReturnValue({ queue, dequeue } as never);
    vi.mocked(api.post)
      .mockRejectedValueOnce(new ApiError("VALIDATION_ERROR", "bad input", 400))
      .mockResolvedValueOnce({});

    await flushOfflineQueue();

    expect(api.post).toHaveBeenCalledTimes(2);
    expect(dequeue).toHaveBeenCalledWith("1");
    expect(dequeue).toHaveBeenCalledWith("2");
  });

  it("does nothing when the queue is empty", async () => {
    vi.mocked(useOfflineQueueStore.getState).mockReturnValue({ queue: [], dequeue } as never);

    await flushOfflineQueue();

    expect(api.post).not.toHaveBeenCalled();
  });
});
