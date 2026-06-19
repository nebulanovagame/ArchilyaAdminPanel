import { NextResponse } from "next/server";

function toOrigin(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getRequestOrigin(request: Request): string | null {
  const host = request.headers.get("host");
  if (!host) return null;

  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${protocol}://${host}`;
}

function getAllowedOrigins(request: Request): Set<string> {
  const values = [
    getRequestOrigin(request),
    toOrigin(process.env.NEXT_PUBLIC_ADMIN_APP_URL),
    ...String(process.env.ADMIN_ALLOWED_ORIGINS || "")
      .split(",")
      .map((origin) => toOrigin(origin.trim())),
  ].filter((origin): origin is string => Boolean(origin));

  return new Set(values);
}

export function rejectCrossSiteMutation(request: Request): NextResponse | null {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method.toUpperCase())) {
    return null;
  }

  const origin = request.headers.get("origin");
  if (!origin) return null;

  const normalizedOrigin = toOrigin(origin);
  if (!normalizedOrigin || !getAllowedOrigins(request).has(normalizedOrigin)) {
    return NextResponse.json(
      { error: { message: "Bu kaynaktan admin islemi yapilamaz.", code: "invalid-origin" } },
      { status: 403 },
    );
  }

  return null;
}
