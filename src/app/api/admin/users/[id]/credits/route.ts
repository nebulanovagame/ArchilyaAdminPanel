import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    let body: { action?: string; amount?: number; description?: string };
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

    if (!amount || amount <= 0 || !Number.isInteger(amount)) {
      return NextResponse.json(
        { error: { message: "Gecerli bir miktar girin (pozitif tam sayi)", code: "invalid-amount" } },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    // Get current user credits
    const { data: profile, error: fetchError } = await supabase
      .from("profiles")
      .select("id, email, credits")
      .eq("id", id)
      .single();

    if (fetchError || !profile) {
      return NextResponse.json(
        { error: { message: "Kullanici bulunamadi", code: "not-found" } },
        { status: 404 },
      );
    }

    const currentCredits = profile.credits || 0;
    let newBalance: number;

    if (action === "grant") {
      newBalance = currentCredits + amount;
    } else {
      // deduct
      if (amount > currentCredits) {
        return NextResponse.json(
          { error: { message: "Kullanici bu kadar krediye sahip degil", code: "insufficient-credits" } },
          { status: 400 },
        );
      }
      newBalance = currentCredits - amount;
    }

    const transactionType = action === "grant" ? "credit_purchase" : "credit_deduct";

    // Update balance and insert transaction in a transaction
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ credits: newBalance })
      .eq("id", id);

    if (updateError) throw updateError;

    const { error: insertError } = await supabase
      .from("credit_transactions")
      .insert({
        user_id: id,
        amount: action === "grant" ? amount : -amount,
        type: transactionType,
        description: description || (action === "grant" ? "Admin panelinden kredi yuklemesi" : "Admin panelinden kredi dusumu"),
        balance_after: newBalance,
      });

    if (insertError) throw insertError;

    return NextResponse.json({
      data: { success: true, balanceAfter: newBalance },
    });
  } catch (err) {
    console.error("Admin API /users/[id]/credits error:", err);
    return NextResponse.json(
      { error: { message: "Kredi islemi sirasinda hata", code: "internal" } },
      { status: 500 },
    );
  }
}
