// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const channel = {
    on: vi.fn(() => channel),
    subscribe: vi.fn(() => channel),
  };
  return {
    rows: [] as Array<Record<string, unknown>>,
    single: vi.fn(),
    channel,
    removeChannel: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: mocks.single,
        }),
      }),
    }),
    channel: vi.fn(() => mocks.channel),
    removeChannel: mocks.removeChannel,
  }),
}));

import { useRealtimeDoc } from "./use-realtime-doc";

type TestDoc = { status: string };

const mapTestRow = (row: Record<string, unknown>) => ({ status: String(row.status || "pending") });
const shouldPollTestDoc = (doc: TestDoc) => doc.status === "pending" || doc.status === "queued" || doc.status === "running";

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useRealtimeDoc polling fallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.rows = [{ status: "queued" }, { status: "completed" }];
    mocks.single.mockImplementation(async () => ({ data: mocks.rows.shift() ?? { status: "completed" }, error: null }));
    mocks.channel.on.mockClear();
    mocks.channel.subscribe.mockClear();
    mocks.removeChannel.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("polls until the mapped document reaches a terminal status", async () => {
    const { result, unmount } = renderHook(() => useRealtimeDoc<TestDoc>({
      table: "ai_studio_jobs",
      id: "job-1",
      initialData: { status: "pending" },
      mapRow: mapTestRow,
      shouldPoll: shouldPollTestDoc,
      pollingIntervalMs: 1000,
    }));

    await flushPromises();
    expect(result.current.data.status).toBe("queued");
    expect(mocks.single).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    await flushPromises();
    expect(result.current.data.status).toBe("completed");
    expect(mocks.single).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(mocks.single).toHaveBeenCalledTimes(2);
    unmount();
  });
});
