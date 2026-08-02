import * as Sentry from "@sentry/nextjs";

/**
 * Captures an exception in Sentry with route context.
 * Safe to call in any server-side API route — no-ops if Sentry DSN is not configured.
 *
 * @param err   The caught error
 * @param route Route label for tagging (e.g. "admin/credits", "admin/invoices PATCH")
 */
export function captureApiError(err: unknown, route: string): void {
  Sentry.captureException(err, {
    tags: { apiRoute: route },
  });
}
