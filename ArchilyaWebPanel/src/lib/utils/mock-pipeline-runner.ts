import type { AgentRole, AgentStatus, PipelineStage } from "@/lib/types/agent";

export type PipelineRunnerEvent =
  | { type: "stage-active"; stageId: PipelineStage["id"] }
  | { type: "agent-status"; role: AgentRole; status: AgentStatus; currentTask?: string; progress?: number }
  | { type: "agent-message"; role: AgentRole; content: string; messageType: "thought" | "action" | "result" | "error" }
  | { type: "agent-progress"; role: AgentRole; progress: number }
  | { type: "stage-awaiting-approval"; stageId: PipelineStage["id"] }
  | { type: "pipeline-done" };

export type PipelineDispatch = (event: PipelineRunnerEvent) => void;

const stageMessages: Record<PipelineStage["id"], { role: AgentRole; content: string; messageType: "thought" | "action" | "result" }[]> = {
  1: [
    { role: "ORCHESTRATOR", content: "Sahne analizi başlatılıyor... 3 sahne tespit edildi", messageType: "thought" },
    { role: "ANALYST", content: "Salon - Kuzey: İç mekan, orta derinlik, tefrişat yeterli", messageType: "result" },
  ],
  2: [
    { role: "MATERIAL", content: "Zemin: Travertin eşleşti (%94 benzerlik). Duvar: Sıva + boyut tespiti", messageType: "result" },
    { role: "ORCHESTRATOR", content: "Malzeme kararları render ajanına aktarılıyor", messageType: "action" },
  ],
  3: [
    { role: "RENDER", content: "Stage 1 ControlNet depth pass başlatıldı...", messageType: "action" },
    { role: "RENDER", content: "Ön render çıktı tamponu oluşturuldu", messageType: "result" },
  ],
  4: [
    { role: "QC", content: "Kütle sapması: %0.3 — Kabul edilebilir. Oran kontrolü: GEÇTİ", messageType: "result" },
    { role: "ORCHESTRATOR", content: "Final kalite kapısı kullanıcı onayına hazır", messageType: "action" },
  ],
};

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const timeoutId = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      window.clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onAbort);
      reject(new DOMException("Aborted", "AbortError"));
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function startMockPipeline(
  dispatch: PipelineDispatch,
  startStageId: PipelineStage["id"] = 1,
  signal?: AbortSignal,
) {
  const stages: PipelineStage["id"][] = [startStageId];

  for (const stageId of stages) {
    if (signal?.aborted) return;

    dispatch({ type: "stage-active", stageId });
    const messages = stageMessages[stageId];

    for (const [index, message] of messages.entries()) {
      dispatch({
        type: "agent-status",
        role: message.role,
        status: index === 0 ? "THINKING" : "WORKING",
        currentTask: message.content,
          progress: 35 + index * 35,
        });
      try {
        await wait(520, signal);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        throw error;
      }
      dispatch({
        type: "agent-message",
        role: message.role,
        content: message.content,
        messageType: message.messageType,
      });
      dispatch({ type: "agent-progress", role: message.role, progress: 100 });
    }

    if (signal?.aborted) return;

    if (stageId === 4 && Math.random() < 0.2) {
      dispatch({
        type: "agent-message",
        role: "QC",
        content: "Uyarı: Yansıma yoğunluğu yüksek, ancak kalite kapısı FAIL değil.",
        messageType: "result",
      });
    }

    dispatch({ type: "stage-awaiting-approval", stageId });
  }
}
