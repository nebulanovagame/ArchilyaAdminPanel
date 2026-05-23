import { NextResponse } from "next/server";

import { getOptionalSessionUser } from "@/lib/auth/session";
import { requireVerifiedFirebaseIdentity } from "@/lib/firebase/callable-server";
import { getFirebaseStorage } from "@/lib/firebase/client";
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

    const { idToken, workspaceId, logo: file } = validation.data;

    const firebaseUser = await requireVerifiedFirebaseIdentity(sessionUser, idToken);
    await requireWorkspacePermission(firebaseUser.uid, workspaceId, "workspace.branding");

    const storage = getFirebaseStorage();
    const logoUrl = await uploadWorkspaceLogo(storage, workspaceId, file);

    return NextResponse.json({ success: true, logoUrl });
  } catch (error) {
    return apiErrorResponse(error, { defaultMessage: "Logo yüklenemedi." });
  }
}

export const POST = withRateLimit(handler, { limit: 10, windowMs: 60_000 });
