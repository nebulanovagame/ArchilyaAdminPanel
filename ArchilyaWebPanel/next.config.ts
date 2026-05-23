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
              "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; img-src 'self' https://firebasestorage.googleapis.com blob: data:; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://*.cloudfunctions.net https://*.ingest.de.sentry.io https://*.sentry.io https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com; font-src 'self'",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
    ],
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
