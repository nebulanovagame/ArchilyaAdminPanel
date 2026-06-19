import type { NextConfig } from "next";

function getOrigin(value: string | undefined): string | null {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function buildContentSecurityPolicy(): string {
  const isProduction = process.env.NODE_ENV === "production";
  const supabaseOrigin = getOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const adminApiOrigin = getOrigin(process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL);
  const appOrigin = getOrigin(process.env.NEXT_PUBLIC_ADMIN_APP_URL);

  const connectSources = [
    "'self'",
    supabaseOrigin,
    supabaseOrigin?.replace(/^https:/, "wss:"),
    adminApiOrigin,
    appOrigin,
    ...(isProduction
      ? []
      : [
          "http://localhost:3000",
          "http://127.0.0.1:3000",
          "ws://localhost:3000",
          "ws://127.0.0.1:3000",
          "http://localhost:4000",
          "http://127.0.0.1:4000",
        ]),
  ].filter(Boolean);

  const imgSources = ["'self'", "data:", "blob:", supabaseOrigin].filter(Boolean);

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSources.join(" ")}`,
    "font-src 'self' data:",
    `connect-src ${connectSources.join(" ")}`,
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: buildContentSecurityPolicy(),
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          ...(process.env.NODE_ENV === "production"
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
