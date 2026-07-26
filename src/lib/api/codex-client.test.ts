import { describe, expect, it } from "vitest";
import { formatRemainingTime } from "./codex-client";

describe("formatRemainingTime", () => {
  it("formats expiry windows for the admin connection screen", () => {
    expect(formatRemainingTime(null)).toBe("Bilinmiyor");
    expect(formatRemainingTime(0)).toBe("Suresi doldu");
    expect(formatRemainingTime(45)).toBe("45 sn");
    expect(formatRemainingTime(3_661)).toBe("1 saat 1 dk");
    expect(formatRemainingTime(90_000)).toBe("1 gun 1 saat");
  });
});
