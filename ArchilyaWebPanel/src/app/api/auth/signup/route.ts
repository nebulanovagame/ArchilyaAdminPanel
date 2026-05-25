import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRateLimit } from "@/lib/api/rate-limit";

const signupBodySchema = z.object({
  name: z.string().min(1, "Ad soyad gereklidir.").max(200),
  email: z.string().email("Geçerli bir e-posta adresi giriniz."),
  password: z
    .string()
    .min(8, "Şifre en az 8 karakter olmalıdır.")
    .regex(/[A-Z]/, "Şifre en az 1 büyük harf içermelidir.")
    .regex(/[a-z]/, "Şifre en az 1 küçük harf içermelidir.")
    .regex(/[0-9]/, "Şifre en az 1 rakam içermelidir.")
    .regex(
      /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
      "Şifre en az 1 özel karakter içermelidir.",
    ),
});

async function handler(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Geçersiz JSON gövdesi." },
      { status: 400 },
    );
  }

  const parsed = signupBodySchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join("; ");
    return NextResponse.json(
      { error: `Doğrulama hatası: ${message}` },
      { status: 400 },
    );
  }

  const { name, email, password } = parsed.data;

  const adminClient = createAdminClient();

  // Create user with email_confirm: true so no email verification is needed.
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (error) {
    // Handle duplicate email gracefully
    if (
      error.message.toLowerCase().includes("already") ||
      error.message.toLowerCase().includes("duplicate") ||
      error.status === 409 ||
      error.status === 422
    ) {
      return NextResponse.json(
        { error: "Bu e-posta adresi zaten kayıtlı." },
        { status: 409 },
      );
    }

    console.error("[auth/signup] Admin createUser failed:", error);
    return NextResponse.json(
      { error: "Kayıt oluşturulamadı. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: data.user.id,
      email: data.user.email,
    },
  });
}

export const POST = withRateLimit(handler, { limit: 5, windowMs: 60_000 });