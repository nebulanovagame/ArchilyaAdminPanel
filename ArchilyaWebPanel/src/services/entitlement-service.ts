"use client";

import { httpsCallable } from "firebase/functions";

import { getFirebaseAuth, getFirebaseFunctions } from "@/lib/firebase/client";
import type { ChangeSubscriptionResult, ProrationQuote, SubscriptionPlanId } from "@/lib/subscription/types";
import type { BrandingUpdateInput } from "@/lib/branding/types";

type SecureResult<T> = Promise<T>;

async function callSecure<TPayload, TResult>(
  callableName: string,
  payload: TPayload,
  fallback: TResult,
): SecureResult<TResult> {
  const callable = httpsCallable<TPayload, TResult>(getFirebaseFunctions(), callableName);
  const result = await callable(payload);
  return result.data ?? fallback;
}

export async function ensureUserProfileSecure(payload: { email?: string | null; displayName?: string | null } = {}) {
  await callSecure("ensureUserProfile", payload, {});
}

async function postServerRoute<TResult>(path: string, payload: Record<string, unknown>) {
  const currentUser = getFirebaseAuth().currentUser;
  if (!currentUser) {
    throw new Error("Oturum açmanız gerekiyor.");
  }

  const idToken = await currentUser.getIdToken();
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...payload, idToken }),
  });

  const data = (await response.json().catch(() => null)) as { error?: string; ok?: boolean } | null;
  if (!response.ok) {
    throw new Error(data?.error || `Sunucu isteği başarısız oldu: ${path}`);
  }

  return data as TResult;
}

export async function deductCreditsSecure(workspaceId: string, amount: number, description: string) {
  await postServerRoute("/api/credits/deduct", { workspaceId, amount, description });
}

export async function refundCreditsSecure(workspaceId: string, amount: number, description: string) {
  await postServerRoute("/api/credits/refund", { workspaceId, amount, description });
}

export async function createWorkspaceSecure(name: string, displayName: string, email: string | null) {
  return callSecure(
    "createWorkspaceSecure",
    { name, displayName, email },
    { success: false, workspaceId: "" },
  );
}

export async function inviteWorkspaceMemberSecure(workspaceId: string, toEmail: string) {
  return callSecure(
    "inviteWorkspaceMemberSecure",
    { workspaceId, toEmail },
    { success: false, inviteId: "" },
  );
}

export async function acceptWorkspaceInviteSecure(inviteId: string) {
  return callSecure("acceptWorkspaceInviteSecure", { inviteId }, { success: false });
}

export async function declineWorkspaceInviteSecure(inviteId: string) {
  return callSecure("declineWorkspaceInviteSecure", { inviteId }, { success: false });
}

export async function removeWorkspaceMemberSecure(workspaceId: string, memberUid: string) {
  return callSecure(
    "removeWorkspaceMemberSecure",
    { workspaceId, memberUid },
    { success: false },
  );
}

export async function deleteWorkspaceSecure(workspaceId: string) {
  return callSecure("deleteWorkspaceSecure", { workspaceId }, { success: false });
}

export async function createIyzicoCheckoutFormSecure(
  planId: string,
  userId: string,
  userEmail: string,
  userName: string,
) {
  return callSecure(
    "createIyzicoCheckoutForm",
    { planId, userId, userEmail, userName },
    { token: "", checkoutFormContent: "" },
  );
}

export async function verifyIyzicoPaymentSecure(token: string, conversationId = "") {
  return callSecure(
    "verifyIyzicoPayment",
    { token, conversationId },
    { success: false, status: "failed", message: "" },
  );
}

export async function getAiPromptHistorySecure() {
  return postServerRoute<{ success: boolean; history: Record<string, unknown> }>(
    "/api/ai-studio/prompt-history",
    { action: "get" },
  );
}

export async function saveAiPromptHistorySecure(toolId: string, entry: Record<string, unknown>) {
  return postServerRoute<{ success: boolean; history: Record<string, unknown> }>(
    "/api/ai-studio/prompt-history",
    { action: "save", toolId, entry },
  );
}

export async function adjustWorkspaceStorageSecure(workspaceId: string, bytesDelta: number) {
  return callSecure(
    "adjustWorkspaceStorage",
    { workspaceId, bytesDelta },
    { success: false },
  );
}

export async function deductWorkspacePoolCreditsSecure(workspaceId: string, amount: number) {
  return postServerRoute(
    "/api/workspace-credits/deduct",
    { workspaceId, amount },
  );
}

export async function refundWorkspacePoolCreditsSecure(workspaceId: string, amount: number) {
  return postServerRoute(
    "/api/workspace-credits/refund",
    { workspaceId, amount },
  );
}

export async function getSubscriptionQuoteSecure(workspaceId: string, targetPlanId: SubscriptionPlanId) {
  return postServerRoute<ProrationQuote>(
    "/api/subscription/quote",
    { workspaceId, targetPlanId },
  );
}

export async function changeSubscriptionSecure(workspaceId: string, targetPlanId: SubscriptionPlanId) {
  return postServerRoute<ChangeSubscriptionResult>(
    "/api/subscription/change",
    { workspaceId, targetPlanId },
  );
}

export async function cancelSubscriptionSecure(workspaceId: string) {
  return postServerRoute<{ success: boolean; message?: string }>(
    "/api/subscription/cancel",
    { workspaceId },
  );
}

export async function reactivateSubscriptionSecure(workspaceId: string) {
  return postServerRoute<{ success: boolean; message?: string }>(
    "/api/subscription/reactivate",
    { workspaceId },
  );
}

export async function updateWorkspaceBrandingSecure(workspaceId: string, branding: BrandingUpdateInput) {
  return postServerRoute<{ success: boolean }>(
    "/api/branding/update",
    { workspaceId, branding },
  );
}

export async function uploadWorkspaceLogoSecure(workspaceId: string, file: File) {
  const currentUser = getFirebaseAuth().currentUser;
  if (!currentUser) {
    throw new Error("Oturum açmanız gerekiyor.");
  }

  const idToken = await currentUser.getIdToken();
  const formData = new FormData();
  formData.append("idToken", idToken);
  formData.append("workspaceId", workspaceId);
  formData.append("logo", file);

  const response = await fetch("/api/branding/upload-logo", {
    method: "POST",
    body: formData,
  });

  const data = (await response.json().catch(() => null)) as { error?: string; logoUrl?: string } | null;
  if (!response.ok) {
    throw new Error(data?.error || "Logo yüklenemedi.");
  }

  return data as { success: boolean; logoUrl: string };
}
