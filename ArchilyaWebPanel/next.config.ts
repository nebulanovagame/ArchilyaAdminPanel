import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

    const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/ai-studyo/:path*",
        destination: "/ai-studio/:path*",
        permanent: true,
      },
      {
        source: "/gizlilik-politikasi",
        destination: "/gizlilik",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self' http://localhost:3000 ws://localhost:3000 http://127.0.0.1:3000 ws://127.0.0.1:3000 http://127.0.0.1:8080 http://localhost:8080 https://supabase.archilya.com wss://supabase.archilya.com https://*.ingest.de.sentry.io https://*.sentry.io; font-src 'self'",
          },
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

export default withSentryConfig(
  withNextIntl(nextConfig),
  sentryOptions,
);
