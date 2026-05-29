import { describe, expect, it } from "vitest";
import { deriveAiStudioState, type DerivationInput } from "./derive-state";
import type { PromptHistoryEntry } from "../types";

function createInput(overrides: Partial<DerivationInput> = {}): DerivationInput {
  return {
    refImageFile: null,
    selectedFileUrl: "",
    sceneReferences: [],
    selectedTool: null,
    activeJobId: null,
    activeJob: { exists: false, status: "pending" } as DerivationInput["activeJob"],
    submittingJob: false,
    activeJobLoading: false,
    activeJobError: null,
    activeJobDraft: null,
    revisionCursor: -1,
    revisionSteps: [],
    promptHistoryByTool: {},
    ...overrides,
  };
}

describe("deriveAiStudioState", () => {
  describe("hasPrimarySource", () => {
    it("returns false when no ref image file or URL", () => {
      const result = deriveAiStudioState(createInput());
      expect(result.hasPrimarySource).toBe(false);
    });

    it("returns true when refImageFile is present", () => {
      const result = deriveAiStudioState(createInput({ refImageFile: new File([], "test.png") }));
      expect(result.hasPrimarySource).toBe(true);
    });

    it("returns true when selectedFileUrl is present", () => {
      const result = deriveAiStudioState(createInput({ selectedFileUrl: "https://example.com/img.png" }));
      expect(result.hasPrimarySource).toBe(true);
    });
  });

  describe("hasRequiredSceneReferences", () => {
    it("returns true when no tool selected", () => {
      const result = deriveAiStudioState(createInput());
      expect(result.hasRequiredSceneReferences).toBe(true);
    });

    it("returns true when selected tool is not sceneedit (no refs needed)", () => {
      const result = deriveAiStudioState(
        createInput({
          selectedTool: { id: "img2img" } as DerivationInput["selectedTool"],
        }),
      );
      expect(result.hasRequiredSceneReferences).toBe(true);
    });

    it("returns false for sceneedit tool with no scene references", () => {
      const result = deriveAiStudioState(
        createInput({
          selectedTool: { id: "sceneedit" } as DerivationInput["selectedTool"],
          sceneReferences: [],
        }),
      );
      expect(result.hasRequiredSceneReferences).toBe(false);
    });

    it("returns true for sceneedit tool when scene references exist", () => {
      const result = deriveAiStudioState(
        createInput({
          selectedTool: { id: "sceneedit" } as DerivationInput["selectedTool"],
          sceneReferences: [
            { id: "ref-1", file: new File([], "ref.png"), url: "", label: "Ref", note: "", type: "object" },
          ],
        }),
      );
      expect(result.hasRequiredSceneReferences).toBe(true);
    });
  });

  describe("revision navigation", () => {
    it("canUndoRevision is false when cursor is 0", () => {
      const result = deriveAiStudioState(createInput({ revisionCursor: 0, revisionSteps: [{ src: "a.png", mimeType: "image/png", meta: null }] }));
      expect(result.canUndoRevision).toBe(false);
    });

    it("canUndoRevision is true when cursor > 0", () => {
      const result = deriveAiStudioState(createInput({ revisionCursor: 1, revisionSteps: [{ src: "a.png", mimeType: "image/png", meta: null }, { src: "b.png", mimeType: "image/png", meta: null }] }));
      expect(result.canUndoRevision).toBe(true);
    });

    it("canRedoRevision is true when cursor < last step", () => {
      const result = deriveAiStudioState(createInput({ revisionCursor: 0, revisionSteps: [{ src: "a.png", mimeType: "image/png", meta: null }, { src: "b.png", mimeType: "image/png", meta: null }] }));
      expect(result.canRedoRevision).toBe(true);
    });

    it("canRedoRevision is false when cursor is at the last step", () => {
      const result = deriveAiStudioState(createInput({ revisionCursor: 1, revisionSteps: [{ src: "a.png", mimeType: "image/png", meta: null }, { src: "b.png", mimeType: "image/png", meta: null }] }));
      expect(result.canRedoRevision).toBe(false);
    });

    it("canRedoRevision is false when no steps", () => {
      const result = deriveAiStudioState(createInput({ revisionCursor: -1, revisionSteps: [] }));
      expect(result.canRedoRevision).toBe(false);
    });
  });

  describe("activePromptHistory", () => {
    it("returns empty array when no tool selected", () => {
      const result = deriveAiStudioState(createInput({ selectedTool: null }));
      expect(result.activePromptHistory).toEqual([]);
    });

    it("returns entries for selected tool", () => {
      const entry: PromptHistoryEntry = {
        id: "1", toolId: "img2img", toolLabel: "Render", outputType: "image",
        style: "modern", sceneEditMode: "", referenceCount: 0, extraNote: "",
        generationVariant: "default", statusLabel: "done", createdAt: new Date().toISOString(),
      };
      const result = deriveAiStudioState(
        createInput({
          selectedTool: { id: "img2img" } as DerivationInput["selectedTool"],
          promptHistoryByTool: { img2img: [entry] },
        }),
      );
      expect(result.activePromptHistory).toHaveLength(1);
      expect(result.activePromptHistory[0].id).toBe("1");
    });
  });

  describe("hasActiveJobInFlight", () => {
    it("returns false when no activeJobId", () => {
      const result = deriveAiStudioState(createInput());
      expect(result.hasActiveJobInFlight).toBe(false);
    });

    it("returns true when submitting", () => {
      const result = deriveAiStudioState(
        createInput({ activeJobId: "job-1", submittingJob: true, activeJob: { exists: true, status: "queued" } as DerivationInput["activeJob"] }),
      );
      expect(result.hasActiveJobInFlight).toBe(true);
    });

    it("returns true when job loading", () => {
      const result = deriveAiStudioState(
        createInput({ activeJobId: "job-1", activeJobLoading: true, activeJob: { exists: true, status: "queued" } as DerivationInput["activeJob"] }),
      );
      expect(result.hasActiveJobInFlight).toBe(true);
    });

    it("returns false when job is terminal (completed)", () => {
      const result = deriveAiStudioState(
        createInput({ activeJobId: "job-1", activeJob: { exists: true, status: "completed" } as DerivationInput["activeJob"] }),
      );
      expect(result.hasActiveJobInFlight).toBe(false);
    });

    it("returns false when job is terminal (failed)", () => {
      const result = deriveAiStudioState(
        createInput({ activeJobId: "job-1", activeJob: { exists: true, status: "failed" } as DerivationInput["activeJob"] }),
      );
      expect(result.hasActiveJobInFlight).toBe(false);
    });

    it("returns false when job error exists", () => {
      const result = deriveAiStudioState(
        createInput({ activeJobId: "job-1", activeJobError: new Error("permission"), activeJob: { exists: true, status: "running" } as DerivationInput["activeJob"] }),
      );
      expect(result.hasActiveJobInFlight).toBe(false);
    });
  });

  describe("generating", () => {
    it("returns true when submittingJob is true", () => {
      const result = deriveAiStudioState(createInput({ submittingJob: true }));
      expect(result.generating).toBe(true);
    });

    it("returns true when hasActiveJobInFlight is true", () => {
      const result = deriveAiStudioState(
        createInput({ activeJobId: "job-1", activeJob: { exists: true, status: "running" } as DerivationInput["activeJob"] }),
      );
      expect(result.generating).toBe(true);
    });

    it("returns false when idle", () => {
      const result = deriveAiStudioState(createInput());
      expect(result.generating).toBe(false);
    });
  });

  describe("activeJobTool and visibleTool", () => {
    it("visibleTool falls back to selectedTool when no active job", () => {
      const result = deriveAiStudioState(
        createInput({ selectedTool: { id: "img2img" } as DerivationInput["selectedTool"] }),
      );
      expect(result.visibleTool?.id).toBe("img2img");
    });

    it("activeJobTool is null when no toolId on job", () => {
      const result = deriveAiStudioState(
        createInput({ activeJob: { exists: true, status: "running", toolId: "" } as DerivationInput["activeJob"], activeJobDraft: null }),
      );
      expect(result.activeJobTool).toBeNull();
    });
  });
});
