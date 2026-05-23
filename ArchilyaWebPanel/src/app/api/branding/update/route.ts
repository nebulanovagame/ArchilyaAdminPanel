import { NextResponse } from "next/server";

import { getOptionalSessionUser } from "@/lib/auth/session";
import { requireVerifiedFirebaseIdentity } from "@/lib/firebase/callable-server";
import { getFirebaseFirestore } from "@/lib/firebase/client";
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
    const { idToken, workspaceId, branding } = validated.data;

    const firebaseUser = await requireVerifiedFirebaseIdentity(sessionUser, idToken);
    await requireWorkspacePermission(firebaseUser.uid, workspaceId, "workspace.branding");

    const db = getFirebaseFirestore();
    await updateWorkspaceBranding(db, workspaceId, branding ?? {});

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error, { defaultMessage: "Marka ayarları güncellenemedi." });
  }
}

export const POST = withRateLimit(handler, { limit: 10, windowMs: 60_000 });
