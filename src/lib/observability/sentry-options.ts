import type { BrowserOptions, EdgeOptions, NodeOptions } from "@sentry/nextjs";

type SharedSentryOptions = {
  dsn: string;
  enabled: boolean;
  environment: string;
  tracesSampleRate: number;
  tracePropagationTargets: string[];
};

function resolveBrowserDsn() {
  return String(process.env.NEXT_PUBLIC_SENTRY_DSN || "").trim();
}

function resolveServerDsn() {
  return String(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || "").trim();
}

function buildSharedOptions(dsn: string): SharedSentryOptions {
  const environment = process.env.NODE_ENV || "development";

  return {
    dsn,
    enabled: Boolean(dsn),
    environment,
    tracesSampleRate: environment === "production" ? 0.1 : 0,
    tracePropagationTargets: [
      "localhost",
      "127.0.0.1",
      "admin.archilya.com",
    ],
  };
}

export function getSentryBrowserOptions(): BrowserOptions {
  return buildSharedOptions(resolveBrowserDsn()) satisfies BrowserOptions;
}

export function getSentryServerOptions(): NodeOptions {
  return buildSharedOptions(resolveServerDsn()) satisfies NodeOptions;
}

export function getSentryEdgeOptions(): EdgeOptions {
  return buildSharedOptions(resolveServerDsn()) satisfies EdgeOptions;
}
