import { createClient } from "@/lib/supabase/client";

import type { RenderSession, RenderSessionInput, RenderSessionStatus } from "@/lib/types/render-session";

function normalizeTimestamp(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export function mapRenderSessionDocument(id: string, data: Record<string, unknown>): RenderSession {
  return {
    id,
    uid: String(data.uid || ""),
    workspaceId: String(data.workspace_id || ""),
    projectId: typeof data.project_id === "string" ? data.project_id : undefined,
    status: normalizeRenderSessionStatus(data.status),
    scenes: Array.isArray(data.scenes) ? data.scenes.map(normalizeSceneMetadata) : [],
    materials: Array.isArray(data.materials) ? data.materials.map(normalizeMaterialMetadata) : [],
    lightPreference: typeof data.light_preference === "string" ? data.light_preference : null,
    annotations: Array.isArray(data.annotations) ? data.annotations : [],
    constraints: Array.isArray(data.constraints) ? data.constraints : [],
    metricLocks: typeof data.metric_locks === "object" && data.metric_locks !== null
      ? data.metric_locks as Record<string, { aspectRatio: number; estimatedDepth: number; volumeScore: number; isLocked: boolean }>
      : {},
    consistencyScore: typeof data.consistency_score === "number" ? data.consistency_score : null,
    jobId: typeof data.job_id === "string" ? data.job_id : undefined,
    outputImageUrls: Array.isArray(data.output_image_urls) ? data.output_image_urls.filter((url): url is string => typeof url === "string") : undefined,
    createdAt: normalizeTimestamp(data.created_at) || new Date(),
    updatedAt: normalizeTimestamp(data.updated_at) || new Date(),
  };
}

function normalizeRenderSessionStatus(value: unknown): RenderSessionStatus {
  const status = String(value || "").toLowerCase();
  switch (status) {
    case "audited": return "audited";
    case "markup-done": return "markup-done";
    case "spatial-locked": return "spatial-locked";
    case "rendering": return "rendering";
    case "completed": return "completed";
    case "failed": return "failed";
    default: return "draft";
  }
}

function normalizeSceneMetadata(value: unknown): RenderSession["scenes"][number] {
  if (!value || typeof value !== "object") return { id: "", label: "", direction: "", type: "", hasFurnishing: false, frameQuality: 0, order: 0 };
  const data = value as Record<string, unknown>;
  return {
    id: String(data.id || ""),
    label: String(data.label || ""),
    direction: String(data.direction || ""),
    type: String(data.type || ""),
    hasFurnishing: typeof data.has_furnishing === "boolean" ? data.has_furnishing : false,
    frameQuality: typeof data.frame_quality === "number" ? data.frame_quality : 0,
    order: typeof data.order === "number" ? data.order : 0,
    imageUrl: typeof data.image_url === "string" ? data.image_url : undefined,
  };
}

function normalizeMaterialMetadata(value: unknown): RenderSession["materials"][number] {
  if (!value || typeof value !== "object") return { id: "", label: "", category: "" };
  const data = value as Record<string, unknown>;
  return {
    id: String(data.id || ""),
    label: String(data.label || ""),
    category: String(data.category || ""),
    imageUrl: typeof data.image_url === "string" ? data.image_url : undefined,
  };
}

export async function createRenderSession(input: RenderSessionInput): Promise<{ id: string }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("render_sessions")
    .insert({
      uid: input.uid,
      workspace_id: input.workspaceId,
      project_id: input.projectId,
      status: input.status || "draft",
      scenes: input.scenes || [],
      materials: input.materials || [],
      light_preference: input.lightPreference ?? null,
      annotations: input.annotations || [],
      constraints: input.constraints || [],
      metric_locks: input.metricLocks || {},
      consistency_score: input.consistencyScore ?? null,
      job_id: input.jobId,
      output_image_urls: input.outputImageUrls,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.warn("[render] createRenderSession error:", error.message);
    throw new Error("Render oturumu oluşturulamadı.");
  }

  return { id: data.id };
}

export async function updateRenderSession(
  sessionId: string,
  updates: Partial<Omit<RenderSessionInput, "uid" | "workspaceId">>,
): Promise<void> {
  const supabase = createClient();

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.scenes !== undefined) payload.scenes = updates.scenes;
  if (updates.materials !== undefined) payload.materials = updates.materials;
  if (updates.lightPreference !== undefined) payload.light_preference = updates.lightPreference;
  if (updates.annotations !== undefined) payload.annotations = updates.annotations;
  if (updates.constraints !== undefined) payload.constraints = updates.constraints;
  if (updates.metricLocks !== undefined) payload.metric_locks = updates.metricLocks;
  if (updates.consistencyScore !== undefined) payload.consistency_score = updates.consistencyScore;
  if (updates.jobId !== undefined) payload.job_id = updates.jobId;
  if (updates.outputImageUrls !== undefined) payload.output_image_urls = updates.outputImageUrls;

  const { error } = await supabase
    .from("render_sessions")
    .update(payload)
    .eq("id", sessionId);

  if (error) {
    console.warn("[render] updateRenderSession error:", error.message);
    throw new Error("Render oturumu güncellenemedi.");
  }
}

export async function getRenderSession(sessionId: string): Promise<RenderSession | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("render_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (error || !data) {
    if (error?.code !== "PGRST116") {
      console.warn("[render] getRenderSession error:", error?.message);
    }
    return null;
  }

  return mapRenderSessionDocument(data.id, data);
}

export function watchRenderSession(
  sessionId: string,
  onData: (session: RenderSession | null) => void,
  onError?: (error: Error) => void,
): () => void {
  const supabase = createClient();

  // Fetch initial data
  void getRenderSession(sessionId).then(onData).catch((err) => {
    if (onError) onError(err);
  });

  const channel = supabase
    .channel(`render-session-${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "render_sessions",
        filter: `id=eq.${sessionId}`,
      },
      (payload) => {
        if (payload.eventType === "DELETE") {
          onData(null);
          return;
        }
        onData(mapRenderSessionDocument(String(payload.new.id), payload.new as Record<string, unknown>));
      },
    )
    .subscribe((status, err) => {
      if (status === "CHANNEL_ERROR" && onError && err) {
        onError(new Error(String(err)));
      }
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function watchUserRenderSessions(
  uid: string,
  onData: (sessions: RenderSession[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const supabase = createClient();

  // Fetch initial data
  void supabase
    .from("render_sessions")
    .select("*")
    .eq("uid", uid)
    .order("updated_at", { ascending: false })
    .then(({ data, error }) => {
      if (error) {
        if (onError) onError(new Error(error.message));
        return;
      }
      onData((data || []).map((row) => mapRenderSessionDocument(row.id, row)));
    });

  const channel = supabase
    .channel(`user-render-sessions-${uid}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "render_sessions",
        filter: `uid=eq.${uid}`,
      },
      () => {
        // Re-fetch all sessions on any change to maintain correct ordering
        void supabase
          .from("render_sessions")
          .select("*")
          .eq("uid", uid)
          .order("updated_at", { ascending: false })
          .then(({ data, error }) => {
            if (error) {
              if (onError) onError(new Error(error.message));
              return;
            }
            onData((data || []).map((row) => mapRenderSessionDocument(row.id, row)));
          });
      },
    )
    .subscribe((status, err) => {
      if (status === "CHANNEL_ERROR" && onError && err) {
        onError(new Error(String(err)));
      }
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}
