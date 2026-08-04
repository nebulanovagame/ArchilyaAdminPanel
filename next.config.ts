import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  async headers() {
    // NOTE: Content-Security-Policy is NOT set here anymore.
    // src/proxy.ts generates a per-request nonce-based CSP header (Bulgu 8 fix).
    // Keep other security headers here.

    const isProd = process.env.NODE_ENV === "production";

    return [
      {
        source: "/:path*",
        headers: [
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
          // HSTS: enforce HTTPS for 2 years (production only)
          ...(isProd
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

const sentryOptions = {
  silent: !process.env.CI,
  widenClientFileUpload: true,
  authToken: process.env.SENTRY_AUTH_TOKEN || undefined,
};

export default withSentryConfig(nextConfig, sentryOptions);
