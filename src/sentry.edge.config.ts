import * as Sentry from "@sentry/nextjs";
import { getSentryEdgeOptions } from "@/lib/observability/sentry-options";

Sentry.init(getSentryEdgeOptions());
