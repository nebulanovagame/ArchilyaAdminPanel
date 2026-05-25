import { NextResponse } from "next/server";

import { getOptionalSessionUser } from "@/lib/auth/session";
import { requireVerifiedSupabaseIdentity } from "@/lib/supabase/callable";
import { updateWorkspaceBranding } from "@/lib/branding/service";
import { apiErrorResponse } from "@/lib/api/errors";
import { withRateLimit } from "@/lib/api/rate-limit";
import { validateRequestBody, brandingUpdateBodySchema } from "@/lib/api/validation";
import { requireWorkspacePermission } from "@/lib/rbac/server";

async function handler(request: Request) {
  const sessionUser = await getOptionalSessionUser();
  const validated = await validateRequestBody(brandingUpdateBodySchema, request);

  if (!validated.success) {
    return validated.errorResponse;
  }

  try {
    const { accessToken, workspaceId, branding } = validated.data;

    const verifiedUser = await requireVerifiedSupabaseIdentity(sessionUser, accessToken);
    await requireWorkspacePermission(verifiedUser.uid, workspaceId, "workspace.branding");

    await updateWorkspaceBranding(null, workspaceId, branding ?? {});

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error, { defaultMessage: "Marka ayarları güncellenemedi." });
  }
}

export const POST = withRateLimit(handler, { limit: 10, windowMs: 60_000 });
