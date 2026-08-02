import * as Sentry from "@sentry/nextjs";
import { getSentryServerOptions } from "@/lib/observability/sentry-options";

Sentry.init(getSentryServerOptions());
