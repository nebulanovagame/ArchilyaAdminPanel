import { describe, expect, it } from "vitest";

import { isAiStudioJobTerminal, mapAiStudioJobSnapshot, normalizeAiStudioJobStatus } from "./job-contract";

function snapshot(data: Record<string, unknown>, id = "job-1") {
  return { id, exists: true, data: () => data };
}

describe("mapAiStudioJobSnapshot", () => {
  it("maps snake_case Supabase rows to camelCase job documents", () => {
    const job = mapAiStudioJobSnapshot(snapshot({
      user_id: "user-1",
      workspace_id: "workspace-1",
      status: "completed",
      tool_id: "analysis",
      output_type: "text",
      result_text: "Analiz sonucu",
      result_url: "https://example.test/result.png",
      credit_cost: 2,
      error_message: "",
      metadata: { progressMessage: "Tamamlandı" },
      billing: { status: "charged" },
      started_at: "2026-05-25T10:00:00.000Z",
      completed_at: "2026-05-25T10:01:00.000Z",
      queued_at: "2026-05-25T09:59:00.000Z",
      attempt_count: 1,
      locked_at: "2026-05-25T10:00:00.000Z",
      last_attempt_error: { code: "internal" },
      created_at: "2026-05-25T09:59:00.000Z",
      updated_at: "2026-05-25T10:01:00.000Z",
    }));

    expect(job.userId).toBe("user-1");
    expect(job.uid).toBe("user-1");
    expect(job.workspaceId).toBe("workspace-1");
    expect(job.toolId).toBe("analysis");
    expect(job.outputType).toBe("text");
    expect(job.result.text).toBe("Analiz sonucu");
    expect(job.result.imageUrl).toBe("https://example.test/result.png");
    expect(job.creditCost).toBe(2);
    expect(job.attemptCount).toBe(1);
    expect(job.completedAt?.toISOString()).toBe("2026-05-25T10:01:00.000Z");
  });

  it("prefers snake_case values over camelCase fallbacks", () => {
    const job = mapAiStudioJobSnapshot(snapshot({
      user_id: "snake-user",
      userId: "camel-user",
      tool_id: "analysis",
      toolId: "img2img",
      result_text: "snake text",
      resultText: "camel text",
      error_message: "snake error",
      errorMessage: "camel error",
    }));

    expect(job.userId).toBe("snake-user");
    expect(job.toolId).toBe("analysis");
    expect(job.result.text).toBe("snake text");
    expect(job.error?.message).toBe("snake error");
    expect(job.errorMessage).toBe("snake error");
  });

  it("maps backend output image metadata when result_url is absent", () => {
    const job = mapAiStudioJobSnapshot(snapshot({
      status: "completed",
      tool_id: "img2img",
      output_type: "image",
      metadata: {
        result: {
          outputImage: {
            url: "https://supabase.archilya.com/storage/v1/object/sign/ai-studio/user/jobs/job-1/outputs/result.png?token=abc",
            mimeType: "image/png",
          },
        },
      },
    }));

    expect(job.result.imageUrl).toBe("https://supabase.archilya.com/storage/v1/object/sign/ai-studio/user/jobs/job-1/outputs/result.png?token=abc");
    expect(job.result.mimeType).toBe("image/png");
    expect(job.outputType).toBe("image");
  });
});

describe("normalizeAiStudioJobStatus", () => {
  it("supports cancelled and canceled terminal spellings", () => {
    expect(normalizeAiStudioJobStatus("cancelled")).toBe("cancelled");
    expect(normalizeAiStudioJobStatus("canceled")).toBe("cancelled");
    expect(isAiStudioJobTerminal({ status: normalizeAiStudioJobStatus("canceled") })).toBe(true);
  });
});
