import * as Sentry from "@sentry/nextjs";
import { getSentryBrowserOptions } from "@/lib/observability/sentry-options";

Sentry.init(getSentryBrowserOptions());
