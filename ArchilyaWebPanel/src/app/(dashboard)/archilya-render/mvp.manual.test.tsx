// @vitest-environment jsdom

import { useEffect } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "../../../../messages/tr.json";
import SceneUploader from "@/components/dashboard/archilya-render/intake/scene-uploader";
import PipelinePage from "@/components/dashboard/archilya-render/pipeline/pipeline-page";
import FinalOutputViewer from "@/components/dashboard/archilya-render/pipeline/final-output-viewer";
import DepthMapViewer from "@/components/dashboard/archilya-render/spatial/depth-map-viewer";
import SceneConsistencyMatrix from "@/components/dashboard/archilya-render/spatial/scene-consistency-matrix";
import SpatialLockPage from "@/components/dashboard/archilya-render/spatial/spatial-lock-page";
import { IntakeProvider, useIntakeContext } from "@/stores/intake-store";
import { MarkupProvider, useMarkupContext } from "@/stores/markup-store";
import { PipelineProvider } from "@/stores/pipeline-store";
import type { Annotation } from "@/lib/types/markup";
import { getSceneDirectionLabelKey, type Scene } from "@/lib/types/scene";
import { SpatialProvider, useSpatialContext } from "@/stores/spatial-store";

vi.mock("@/services/nano-banana-service", () => ({
  generateEnhancedRender: vi.fn().mockResolvedValue({ dataUrl: "data:image/png;base64,enhanced", mimeType: "image/png" }),
  transformStyle: vi.fn().mockResolvedValue({ dataUrl: "data:image/png;base64,styled", mimeType: "image/png" }),
  queueAiStudioJob: vi.fn().mockResolvedValue({ jobId: "job-1" }),
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ currentUser: { uid: "user-1", email: "user@example.com" } }),
}));

vi.mock("@/hooks/use-ai-studio-job", () => ({
  useAiStudioJob: () => ({
    data: {
      id: "",
      exists: false,
      uid: "",
      email: "",
      status: "pending",
      progressMessage: "",
      toolId: "",
      toolLabel: "",
      outputType: "image",
      style: "",
      sceneEditMode: "",
      referenceCount: 0,
      extraNote: "",
      generationVariant: "default",
      sourceImageName: "",
      sourceImageMimeType: "",
      sourceImageUri: "",
      result: { text: "", imageUrl: "", mimeType: "" },
      error: null,
      createdAt: null,
      updatedAt: null,
      startedAt: null,
      completedAt: null,
      feedback: null,
    },
    loading: false,
    error: null,
  }),
}));

vi.mock("@/hooks/use-render-job", () => ({
  useRenderJob: () => ({
    job: null,
    isLoading: false,
    error: null,
    reset: vi.fn(),
    isTerminal: false,
    isCompleted: false,
    isFailed: false,
    isCancelled: false,
  }),
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => ({ path: "users/user-1/aiStudioJobs/job-1" })),
  onSnapshot: vi.fn(() => vi.fn()),
}));

vi.mock("@/lib/firebase/client", () => ({
  getFirebaseFirestore: vi.fn(() => ({})),
}));

vi.mock("@/hooks/use-credits", () => ({
  useCredits: () => ({
    credits: 100,
    hasEnough: (amount: number) => 100 >= amount,
    deductCredits: vi.fn().mockResolvedValue(true),
    refundCredits: vi.fn().mockResolvedValue(true),
    loading: false,
  }),
}));

function DraftWriter() {
  const { setLightPreference } = useIntakeContext();

  useEffect(() => {
    setLightPreference("sunny");
  }, [setLightPreference]);

  return null;
}

function DraftReader() {
  const { scenes } = useIntakeContext();
  return <span data-testid="restored-preview">{scenes[0]?.imagePreview ?? "none"}</span>;
}

function SceneOrderReader() {
  const { scenes } = useIntakeContext();
  return <span data-testid="scene-order">{scenes.map((item) => item.id).join(",")}</span>;
}

function MarkupHistoryProbe() {
  const { annotations, canUndo, canRedo, addAnnotation, undoAnnotation, redoAnnotation } = useMarkupContext();
  const annotation: Annotation = {
    id: "annotation-1",
    type: "circle",
    coordinates: { x: 10, y: 10, width: 30, height: 30 },
    color: "#FF4757",
    strokeWidth: 4,
    label: "circle",
  };

  return (
    <div>
      <span data-testid="markup-state">{annotations.length}:{String(canUndo)}:{String(canRedo)}</span>
      <button type="button" onClick={() => addAnnotation(annotation, scene.id)}>add</button>
      <button type="button" onClick={undoAnnotation}>undo</button>
      <button type="button" onClick={redoAnnotation}>redo</button>
    </div>
  );
}

function SingleSceneConsistencyProbe() {
  const { consistencyResult } = useSpatialContext();
  return <span data-testid="consistency-score">{consistencyResult?.consistencyScore ?? 0}</span>;
}

function DepthMapSetup() {
  const { setDepthMap } = useSpatialContext();

  useEffect(() => {
    setDepthMap({
      sceneId: scene.id,
      imageUrl: scene.imagePreview ?? "",
      depthDataUrl: "data:image/png;base64,depth",
      generatedAt: 1,
    });
  }, [setDepthMap]);

  return null;
}

function renderWithIntl(children: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="tr" messages={messages}>
      {children}
    </NextIntlClientProvider>,
  );
}

const scene: Scene = {
  id: "scene-1",
  label: "Salon",
  direction: "north",
  type: "interior",
  imageFile: null,
  imagePreview: "data:image/png;base64,original",
  thumbnailUrl: null,
  hasFurnishing: true,
  frameQuality: 90,
  order: 0,
  createdAt: 1,
};

const secondScene: Scene = {
  ...scene,
  id: "scene-2",
  label: "Mutfak",
  order: 1,
};

describe("manual MVP QA", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("persists intake draft state to localStorage", async () => {
    render(
      <IntakeProvider>
        <DraftWriter />
      </IntakeProvider>,
    );

    await waitFor(() => {
      expect(localStorage.getItem("archilya-render-intake-draft")).toContain("sunny");
    });
  });

  it("saves final output metadata to localStorage", async () => {
    renderWithIntl(
      <PipelineProvider>
        <FinalOutputViewer scenes={[scene]} />
      </PipelineProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /projeye kaydet/i }));

    expect(localStorage.getItem("archilya-render-saved-outputs")).toContain("data:image/png;base64,original");
  });

  it("uses scoped i18n keys for kebab-case scene directions", () => {
    expect(getSceneDirectionLabelKey("north-east")).toBe("directions.northEast");
  });

  it("does not restore stale blob previews from intake drafts", async () => {
    localStorage.setItem(
      "archilya-render-intake-draft",
      JSON.stringify({
        scenes: [{ ...scene, imagePreview: "blob:http://localhost/stale-preview" }],
        materials: [],
        moodboards: [],
        clientReferences: [],
        lightPreference: "sunny",
      }),
    );

    render(
      <IntakeProvider>
        <DraftReader />
      </IntakeProvider>,
    );

    expect(screen.getByTestId("restored-preview").textContent).toBe("none");
    await waitFor(() => {
      expect(localStorage.getItem("archilya-render-intake-draft")).not.toContain("blob:http://localhost/stale-preview");
    });
  });

  it("reorders scenes with drag and drop", async () => {
    localStorage.setItem(
      "archilya-render-intake-draft",
      JSON.stringify({
        scenes: [scene, secondScene],
        materials: [],
        moodboards: [],
        clientReferences: [],
        lightPreference: "sunny",
      }),
    );

    renderWithIntl(
      <IntakeProvider>
        <SceneUploader />
        <SceneOrderReader />
      </IntakeProvider>,
    );

    fireEvent.dragStart(screen.getByTestId("scene-card-scene-1"), { dataTransfer: { effectAllowed: "move" } });
    fireEvent.dragOver(screen.getByTestId("scene-card-scene-2"), { dataTransfer: { dropEffect: "move" } });
    fireEvent.drop(screen.getByTestId("scene-card-scene-2"), { dataTransfer: { dropEffect: "move" } });

    await waitFor(() => {
      expect(screen.getByTestId("scene-order").textContent).toBe("scene-2,scene-1");
    });
  });

  it("supports markup undo and redo history", async () => {
    render(
      <MarkupProvider>
        <MarkupHistoryProbe />
      </MarkupProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "add" }));
    await waitFor(() => {
      expect(screen.getByTestId("markup-state").textContent).toBe("1:true:false");
    });

    fireEvent.click(screen.getByRole("button", { name: "undo" }));
    await waitFor(() => {
      expect(screen.getByTestId("markup-state").textContent).toBe("0:false:true");
    });

    fireEvent.click(screen.getByRole("button", { name: "redo" }));
    await waitFor(() => {
      expect(screen.getByTestId("markup-state").textContent).toBe("1:true:false");
    });
  });

  it("renders depth before and after in a full-size comparison area", () => {
    renderWithIntl(
      <SpatialProvider>
        <DepthMapSetup />
        <DepthMapViewer scene={scene} />
      </SpatialProvider>,
    );

    const beforeImage = screen.getByAltText("Salon orijinal görsel");
    expect(beforeImage.parentElement?.className).toContain("min-h-[420px]");
  });

  it("shows pipeline progress estimated time after start", async () => {
    renderWithIntl(
      <IntakeProvider>
        <PipelineProvider>
          <PipelinePage scenes={[scene]} onBackToSpatial={vi.fn()} />
        </PipelineProvider>
      </IntakeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /konsey'i başlat/i }));

    await waitFor(() => {
      expect(screen.getByText(/tahmini süre hesaplanıyor|tahmini kalan süre/i)).toBeTruthy();
    });
  });

  it("assigns a passing consistency score for a single scene", async () => {
    renderWithIntl(
      <SpatialProvider>
        <SceneConsistencyMatrix scenes={[scene]} />
        <SingleSceneConsistencyProbe />
      </SpatialProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("consistency-score").textContent).toBe("100");
    });
  });

  it("allows a locked single scene to proceed to the council", async () => {
    const onProceedToPipeline = vi.fn();

    renderWithIntl(
      <SpatialProvider>
        <DepthMapSetup />
        <SpatialLockPage scenes={[scene]} onBackToMarkup={vi.fn()} onProceedToPipeline={onProceedToPipeline} />
      </SpatialProvider>,
    );

    const proceedButton = await screen.findByRole("button", { name: /konsey'e gönder/i });
    if (!(proceedButton instanceof HTMLButtonElement)) {
      throw new Error("Expected council proceed control to be a button.");
    }
    await waitFor(() => {
      expect(proceedButton.disabled).toBe(false);
    });

    fireEvent.click(proceedButton);

    expect(onProceedToPipeline).toHaveBeenCalledOnce();
  });
});
