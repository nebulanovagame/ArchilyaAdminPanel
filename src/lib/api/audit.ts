import type { SupabaseClient } from "@supabase/supabase-js";

type AdminAuditEvent = {
  actorId: string;
  actorEmail: string | null;
  action: string;
  resource: string;
  resourceId: string;
  workspaceId?: string | null;
  details?: Record<string, unknown>;
};

export async function writeAdminAuditLog(
  supabase: SupabaseClient,
  event: AdminAuditEvent,
): Promise<void> {
  const details = event.details ?? {};
  const primaryPayload = {
    actor_id: event.actorId,
    actor_email: event.actorEmail,
    action: event.action,
    workspace_id: event.workspaceId ?? null,
    target_type: event.resource,
    target_id: event.resourceId,
    metadata: details,
  };

  const { error: primaryError } = await supabase
    .from("workspace_activity_logs")
    .insert(primaryPayload);

  if (!primaryError) return;

  const fallbackPayload = {
    actor_id: event.actorId,
    actor_email: event.actorEmail,
    action: event.action,
    workspace_id: event.workspaceId ?? null,
    target_type: event.resource,
    target_id: event.resourceId,
    metadata: details,
  };

  const { error: fallbackError } = await supabase
    .from("workspace_activity_logs")
    .insert(fallbackPayload);

  if (fallbackError) {
    console.warn("[admin-audit] Audit log yazilamadi:", fallbackError.message);
  }
}
