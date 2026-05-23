import { afterEach, describe, expect, it, vi } from "vitest";

import { collectStoragePaths, isOlderThanRetention } from "./cleanup";

describe("isOlderThanRetention", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true only for values older than 30 days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T00:00:00.000Z"));

    expect(isOlderThanRetention(new Date("2026-03-31T23:59:59.999Z"))).toBe(true);
    expect(isOlderThanRetention(new Date("2026-04-01T00:00:00.000Z"))).toBe(false);
    expect(isOlderThanRetention(new Date("2026-04-02T00:00:00.000Z"))).toBe(false);
  });

  it("supports Firestore Timestamp-like values", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T00:00:00.000Z"));

    expect(
      isOlderThanRetention({
        toDate: () => new Date("2026-03-01T00:00:00.000Z"),
      }),
    ).toBe(true);
  });

  it("returns false for missing or invalid date values", () => {
    expect(isOlderThanRetention(null)).toBe(false);
    expect(isOlderThanRetention(undefined)).toBe(false);
    expect(isOlderThanRetention("not-a-date")).toBe(false);
    expect(isOlderThanRetention(new Date("not-a-date"))).toBe(false);
  });
});

describe("collectStoragePaths", () => {
  it("collects file, deleted file, and file version paths safely", () => {
    const projectData: Record<string, unknown> = {
      files: [
        {
          path: " files/current.glb ",
          versions: [
            { path: "files/current-v1.glb" },
            { path: "files/current-v2.glb" },
            { path: "" },
            null,
          ],
        },
        { path: "files/current.glb" },
        { name: "missing-path" },
        null,
      ],
      deletedFiles: [
        {
          path: "files/deleted.glb",
          versions: [
            { path: "files/deleted-v1.glb" },
            { path: "files/current-v2.glb" },
          ],
        },
        { path: null },
        undefined,
      ],
    };

    expect(collectStoragePaths(projectData)).toEqual([
      "files/current.glb",
      "files/current-v1.glb",
      "files/current-v2.glb",
      "files/deleted.glb",
      "files/deleted-v1.glb",
    ]);
  });

  it("returns an empty array when file arrays are missing or malformed", () => {
    expect(collectStoragePaths({})).toEqual([]);
    expect(collectStoragePaths({ files: null, deletedFiles: "invalid" })).toEqual([]);
  });
});
