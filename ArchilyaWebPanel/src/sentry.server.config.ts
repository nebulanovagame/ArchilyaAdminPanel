import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://60a232e38babeab0335701efb8388eee@o4511310686978048.ingest.de.sentry.io/4511310699757648",
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  environment: process.env.NODE_ENV || "development",
});
