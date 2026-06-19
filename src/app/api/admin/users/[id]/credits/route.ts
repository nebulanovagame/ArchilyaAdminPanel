import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { writeAdminAuditLog } from "@/lib/api/audit";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";
import { rejectCrossSiteMutation } from "@/lib/api/security";

const MAX_CREDIT_MUTATION_AMOUNT = 1_000_000;
const DESCRIPTION_MAX_LENGTH = 500;

type CreditAction = "grant" | "deduct";

type CreditMutationBody = {
  action?: string;
  amount?: number;
  description?: string;
  idempotencyKey?: string;
};

type CreditRpcRow = {
  success: boolean;
  balance_after: number;
  transaction_id: string | null;
  already_applied: boolean;
};

function isValidIdempotencyKey(value: string | undefined): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(value);
}

function getCreditRpcRow(data: CreditRpcRow | CreditRpcRow[] | null): CreditRpcRow | null {
  if (Array.isArray(data)) return data[0] ?? null;
  return data;
}

function creditRpcErrorResponse(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("profile not found") || lower.includes("not found")) {
    return NextResponse.json(
      { error: { message: "Kullanici bulunamadi", code: "not-found" } },
      { status: 404 },
    );
  }

  if (lower.includes("insufficient credits") || lower.includes("yetersiz")) {
    return NextResponse.json(
      { error: { message: "Kullanici bu kadar krediye sahip degil", code: "insufficient-credits" } },
      { status: 400 },
    );
  }

  return null;
}

async function handler(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = rejectCrossSiteMutation(_request);
  if (originError) return originError;

  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    const { id } = await params;

    let body: CreditMutationBody;
    try {
      body = await _request.json();
    } catch {
      return NextResponse.json(
        { error: { message: "Gecersiz JSON", code: "invalid-body" } },
        { status: 400 },
      );
    }

    const { action, amount, description } = body;

    if (!action || !["grant", "deduct"].includes(action)) {
      return NextResponse.json(
        { error: { message: "Gecersiz islem. Sadece 'grant' veya 'deduct'", code: "invalid-action" } },
        { status: 400 },
      );
    }

    if (!amount || amount <= 0 || !Number.isInteger(amount) || amount > MAX_CREDIT_MUTATION_AMOUNT) {
      return NextResponse.json(
        { error: { message: "Gecerli bir miktar girin (1-1000000 arasi tam sayi)", code: "invalid-amount" } },
        { status: 400 },
      );
    }

    if (description && description.length > DESCRIPTION_MAX_LENGTH) {
      return NextResponse.json(
        { error: { message: "Aciklama en fazla 500 karakter olabilir", code: "invalid-description" } },
        { status: 400 },
      );
    }

    if (!isValidIdempotencyKey(body.idempotencyKey)) {
      return NextResponse.json(
        { error: { message: "Gecerli bir idempotencyKey gereklidir", code: "invalid-idempotency-key" } },
        { status: 400 },
      );
    }

    const creditAction = action as CreditAction;
    const idempotencyKey = `admin:${guard.uid}:${id}:${creditAction}:${body.idempotencyKey}`;

    const supabase = createAdminClient();
    const rpcName = creditAction === "grant" ? "refund_user_credits" : "charge_user_credits";
    const rpcDescription = description || (creditAction === "grant" ? "Admin panelinden kredi yuklemesi" : "Admin panelinden kredi dusumu");
    const { data: rpcData, error: rpcError } = await supabase.rpc(rpcName, {
      p_user_id: id,
      p_amount: amount,
      p_description: rpcDescription,
      p_idempotency_key: idempotencyKey,
      p_metadata: {
        source: "admin_panel",
        actorId: guard.uid,
        actorEmail: guard.email,
        action: creditAction,
      },
    });

    if (rpcError) {
      const response = creditRpcErrorResponse(rpcError.message || "");
      if (response) return response;
      throw rpcError;
    }

    const rpcRow = getCreditRpcRow(rpcData as CreditRpcRow | CreditRpcRow[] | null);
    if (!rpcRow?.success) {
      throw new Error("Credit RPC did not return success");
    }

    await writeAdminAuditLog(supabase, {
      actorId: guard.uid,
      actorEmail: guard.email,
      action: `credits_${creditAction}`,
      resource: "profiles",
      resourceId: id,
      details: {
        amount,
        balanceAfter: rpcRow.balance_after,
        description: description || null,
        idempotencyKey,
        transactionId: rpcRow.transaction_id,
        alreadyApplied: rpcRow.already_applied,
      },
    });

    const response = {
      success: true,
      balanceAfter: rpcRow.balance_after,
      transactionId: rpcRow.transaction_id,
      alreadyApplied: rpcRow.already_applied,
    };

    return NextResponse.json({
      data: response,
    });
  } catch (err) {
    console.error("Admin API /users/[id]/credits error:", err);
    return NextResponse.json(
      { error: { message: "Kredi islemi sirasinda hata", code: "internal" } },
      { status: 500 },
    );
  }
}

export const POST = withRateLimit(handler, adminRateLimits.sensitiveMutation);
