import { NextResponse } from "next/server";

import { getOptionalSessionUser } from "@/lib/auth/session";
import { requireVerifiedSupabaseIdentity } from "@/lib/supabase/callable";
import { uploadWorkspaceLogo } from "@/lib/branding/service";
import { apiErrorResponse } from "@/lib/api/errors";
import { withRateLimit } from "@/lib/api/rate-limit";
import { brandingUploadLogoFormSchema, validateFormData } from "@/lib/api/validation";
import { requireWorkspacePermission } from "@/lib/rbac/server";

async function handler(request: Request) {
  const sessionUser = await getOptionalSessionUser();

  try {
    const validation = await validateFormData(brandingUploadLogoFormSchema, request);

    if (!validation.success) {
      return validation.errorResponse;
    }

    const { accessToken, workspaceId, logo: file } = validation.data;

    const verifiedUser = await requireVerifiedSupabaseIdentity(sessionUser, accessToken);
    await requireWorkspacePermission(verifiedUser.uid, workspaceId, "workspace.branding");

    const logoUrl = await uploadWorkspaceLogo(null, workspaceId, file);

    return NextResponse.json({ success: true, logoUrl });
  } catch (error) {
    return apiErrorResponse(error, { defaultMessage: "Logo yüklenemedi." });
  }
}

export const POST = withRateLimit(handler, { limit: 10, windowMs: 60_000 });
