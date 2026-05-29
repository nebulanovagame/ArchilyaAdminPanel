import { describe, expect, it } from "vitest";

import { deriveProcessingStep, deriveCanvasState } from "./utils";

describe("deriveProcessingStep", () => {
  it("returns 0 while submitting (queued/prepare)", () => {
    expect(deriveProcessingStep(true, { status: "" })).toBe(0);
  });

  it("returns 0 when status is queued", () => {
    expect(deriveProcessingStep(false, { status: "queued" })).toBe(0);
  });

  it("returns 0 when progress message contains 'hazırl'", () => {
    expect(
      deriveProcessingStep(false, {
        status: "running",
        progressMessage: "Görsel hazırlanıyor...",
      }),
    ).toBe(0);
  });

  it("returns 0 when progress message contains 'prepar'", () => {
    expect(
      deriveProcessingStep(false, {
        status: "running",
        progressMessage: "Preparing image...",
      }),
    ).toBe(0);
  });

  it("returns 1 when progress message contains 'prompt'", () => {
    expect(
      deriveProcessingStep(false, {
        status: "running",
        progressMessage: "Oluşturulan prompt işleniyor...",
      }),
    ).toBe(1);
  });

  it("returns 1 when progress message contains 'oluştur'", () => {
    expect(
      deriveProcessingStep(false, {
        status: "running",
        progressMessage: "Prompt oluşturuluyor...",
      }),
    ).toBe(1);
  });

  it("returns 2 as default for running (generate)", () => {
    expect(
      deriveProcessingStep(false, {
        status: "running",
        progressMessage: "",
      }),
    ).toBe(2);
  });

  it("returns 3 when progress message contains 'işlen' (process)", () => {
    expect(
      deriveProcessingStep(false, {
        status: "running",
        progressMessage: "Sonuç işleniyor...",
      }),
    ).toBe(3);
  });

  it("returns 3 when progress message contains 'process'", () => {
    expect(
      deriveProcessingStep(false, {
        status: "running",
        progressMessage: "Processing result...",
      }),
    ).toBe(3);
  });

  it("returns 4 when status is completed (preview)", () => {
    expect(deriveProcessingStep(false, { status: "completed" })).toBe(4);
  });

  it("returns 0 for failed/cancelled status", () => {
    expect(deriveProcessingStep(false, { status: "failed" })).toBe(0);
    expect(deriveProcessingStep(false, { status: "cancelled" })).toBe(0);
  });
});

describe("deriveCanvasState", () => {
  it("returns welcome when no tool selected", () => {
    expect(
      deriveCanvasState({
        selectedTool: null,
        generating: false,
        hasPrimarySource: false,
        hasResultImage: false,
        hasResultText: false,
      }),
    ).toBe("welcome");
  });

  it("returns processing when generating", () => {
    expect(
      deriveCanvasState({
        selectedTool: { id: "img2img" },
        generating: true,
        hasPrimarySource: false,
        hasResultImage: false,
        hasResultText: false,
      }),
    ).toBe("processing");
  });

  it("returns result when hasResultImage", () => {
    expect(
      deriveCanvasState({
        selectedTool: { id: "img2img" },
        generating: false,
        hasPrimarySource: true,
        hasResultImage: true,
        hasResultText: false,
      }),
    ).toBe("result");
  });

  it("returns result-text when hasResultText", () => {
    expect(
      deriveCanvasState({
        selectedTool: { id: "analysis" },
        generating: false,
        hasPrimarySource: true,
        hasResultImage: false,
        hasResultText: true,
      }),
    ).toBe("result-text");
  });

  it("returns preview when hasPrimarySource but no result", () => {
    expect(
      deriveCanvasState({
        selectedTool: { id: "img2img" },
        generating: false,
        hasPrimarySource: true,
        hasResultImage: false,
        hasResultText: false,
      }),
    ).toBe("preview");
  });

  it("returns upload when tool selected but no primary source or result", () => {
    expect(
      deriveCanvasState({
        selectedTool: { id: "img2img" },
        generating: false,
        hasPrimarySource: false,
        hasResultImage: false,
        hasResultText: false,
      }),
    ).toBe("upload");
  });
});
